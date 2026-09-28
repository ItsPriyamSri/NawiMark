/**
 * Deterministic bullets from resultJson only — no LLM, no free text.
 * Corner-error wording here is the product's locked USP line.
 * Clause strings checked against the published R 76-1:2006 / R 76-2:2007.
 */
import { Decimal } from "decimal.js";
import type { Evaluation, Instrument, Procedure, ProcedureKey, ProcedureStatus } from "@prisma/client";
import { MPE_BAND, MPE_BAND_INSPECTION, NEVER_MARK, PACK_ID, PACK_MARKS, PROCEDURE_LABELS } from "@/engine/pack";

export const CLAUSES: Partial<Record<ProcedureKey, string>> = {
  WEIGHING: "OIML R 76-1 3.5.1 Table 6 / A.4.4.1 (weighing test)",
  ZERO_SETTING: "OIML R 76-1 4.5.2 / A.4.2.3 (accuracy of zero-setting)",
  TARE_SETTING: "OIML R 76-1 4.6.3 / A.4.6.2 (accuracy of tare setting)",
  STATIC_TEMP: "OIML R 76-1 3.9.2.1 / A.5.3.1 (static temperatures)",
  ECCENTRICITY: "OIML R 76-1 3.6.2 / 3.6.2.1 / A.4.7 (eccentricity)",
  REPEATABILITY: "OIML R 76-1 3.6.1 / A.4.10 (repeatability)",
  TARE: "OIML R 76-1 3.5.3.3 / A.4.6.1 (tare weighing test)",
  DISCRIMINATION: "OIML R 76-1 3.8.2.2 / A.4.8.2 (discrimination, digital)",
  SENSITIVITY: "OIML R 76-1 6.1 / A.4.9 (sensitivity, non-self-indicating)",
  ZERO_RETURN: "OIML R 76-1 3.9.4.2 / A.4.11.2 (zero return)",
  CREEP: "OIML R 76-1 3.9.4.1 / A.4.11.1 (creep)",
  STABILITY: "OIML R 76-1 4.4.2 / A.4.12 (stability of equilibrium)",
  TILT: "OIML R 76-1 3.9.1.1 / A.5.1 (tilting)",
  WARMUP: "OIML R 76-1 5.3.5 / A.5.2 (warm-up time)",
  VOLTAGE: "OIML R 76-1 3.9.3 / A.5.4 (voltage variations)",
  TEMP_NOLOAD: "OIML R 76-1 3.9.2.3 / A.5.3.2 (temperature effect on no-load)",
  DAMP_HEAT: "OIML R 76-1 5.3.2 / B.2 (damp heat, steady state)",
  SPAN_STABILITY: "OIML R 76-1 5.3.3 / B.4 (span stability)",
  ENDURANCE: "OIML R 76-1 3.9.4.3 / A.6 (endurance)",
  ROLLING_ECC: "OIML R 76-1 3.6.2.4 / A.4.7.4 (rolling loads)",
};

export type MpeView = "initial" | "in-service";

type R = Record<string, unknown>;

const abs = (v: unknown) => new Decimal(String(v)).abs();
const str = (v: unknown) => new Decimal(String(v)).toString();

function worst<T extends R>(rows: T[], field: keyof T): T {
  return rows.reduce((a, b) => (abs(b[field]).gt(abs(a[field])) ? b : a));
}

/** Row closest to (or furthest past) its own limit: rows can carry different MPEs. */
function worstVs<T extends R>(rows: T[], field: keyof T, limit: keyof T = "mpe"): T {
  const ratio = (r: T) => abs(r[field]).div(abs(r[limit]).isZero() ? 1 : abs(r[limit]));
  return rows.reduce((a, b) => (ratio(b).gt(ratio(a)) ? b : a));
}

function bandLines(view: MpeView, mpe: Decimal, errorAbs: Decimal): string[] {
  const doubled = mpe.mul(2);
  if (view === "in-service") {
    const would = errorAbs.lte(doubled) ? "passed" : "still failed";
    return [
      `Band shown: ${MPE_BAND_INSPECTION}. Allowed here: ${doubled.toString()} g.`,
      `This case would have ${would} on 2×. Stored mark still uses type-evaluation.`,
    ];
  }
  const lines = [`Band used: type-evaluation / initial, not the later shop 2×.`];
  if (errorAbs.gt(mpe) && errorAbs.lte(doubled)) {
    lines.push(`If we had used 2×, allowed would be ${doubled.toString()} g and this would have passed.`);
  }
  return lines;
}

function clauseLine(key: ProcedureKey, packId: string) {
  return `Clause: ${CLAUSES[key]}. Pack: ${packId}.`;
}

/** Locked wording: "Corner C: 11 g error. Allowed at this load: 10 g." */
function explainEccentricity(r: R, view: MpeView): string[] {
  const errors = r.errors as Record<string, string> | undefined;
  if (!errors || r.mpe == null || Object.keys(errors).length === 0) return [];
  const [pos, err] = Object.entries(errors).reduce((a, b) => (abs(b[1]).gt(abs(a[1])) ? b : a));
  const mpe = new Decimal(String(r.mpe));
  const allowed = view === "in-service" ? mpe.mul(2) : mpe;
  const lines = [`Corner ${pos}: ${abs(err).toString()} g error. Allowed at this load: ${allowed.toString()} g.`];
  const reading = (r.readings as Record<string, { i: string; dL: string | null; p: string }> | undefined)?.[pos];
  if (reading?.dL != null) {
    lines.push(`Corner ${pos}: I = ${reading.i} g, dL = ${reading.dL} g, P = I + 1/2 e - dL = ${reading.p} g, L = ${str(r.trueLoad)} g.`);
  }
  if (r.e0 != null && !abs(r.e0).isZero()) lines.push(`Corrected for zero error E0 = ${str(r.e0)} g.`);
  return [...lines, ...bandLines(view, mpe, abs(err))];
}

function explainRepeatability(r: R, view: MpeView): string[] {
  const series = (r.series as R[] | undefined) ?? (r.spread != null ? [{ label: "Series", ...r }] : []);
  if (series.length === 0) return [];
  const lines = series.map((s) => {
    const mpe = new Decimal(String(s.mpe));
    const allowed = view === "in-service" ? mpe.mul(2) : mpe;
    const errs = (s.errors as string[] | undefined) ?? [];
    const worstErr = errs.length ? Decimal.max(...errs.map((x) => abs(x))) : null;
    return `${s.label} (${str(s.trueLoad)} g): spread ${str(s.spread)} g, allowed ${allowed.toString()} g${
      worstErr ? `; worst error ${worstErr.toString()} g` : ""
    }.`;
  });
  const margin = (s: R) => abs(s.spread).sub(abs(s.mpe));
  const worstSeries = series.reduce((a, b) => (margin(b).gt(margin(a)) ? b : a));
  return [...lines, ...bandLines(view, new Decimal(String(worstSeries.mpe)), abs(worstSeries.spread))];
}

function explainRows(r: R, view: MpeView): string[] {
  const rows = r.rows as R[] | undefined;
  if (!rows?.length) return [];
  const w = worstVs(rows, "error");
  const mpe = new Decimal(String(w.mpe));
  const allowed = view === "in-service" ? mpe.mul(2) : mpe;
  const at = w.voltage != null ? `Load ${str(w.load)} g at ${w.voltage} V` : `Load ${str(w.load)} g`;
  const lines = [
    ...(r.tare != null ? [`Tare T = ${str(r.tare)} g; loads are net values.`] : []),
    `${at}: ${abs(w.error).toString()} g error. Allowed: ${allowed.toString()} g.`,
  ];
  if (r.e0 != null && !abs(r.e0).isZero()) lines.push(`Errors corrected for zero error E0 = ${str(r.e0)} g (Ec = E - E0).`);
  return [...lines, ...bandLines(view, mpe, abs(w.error))];
}

function explainEndurance(r: R): string[] {
  const rows = r.rows as R[] | undefined;
  if (!rows?.length) return [];
  const w = worstVs(rows, "durability");
  return [
    `Worst durability error at ${str(w.load)} g: ${abs(w.durability).toString()} g (E before ${str(w.eBefore)} g, after ${str(w.eAfter)} g). Allowed |MPE|: ${str(w.mpe)} g.`,
  ];
}

function explainWarmup(r: R): string[] {
  const rows = r.rows as R[] | undefined;
  if (!rows?.length) return [];
  const w = worst(rows, "diff");
  return [`Worst at ${w.minute} min: |EL - E0| = ${abs(w.diff).toString()} g at ${str(r.load)} g. Allowed |MPE|: ${str(r.mpe)} g.`];
}

function explainDiscrimination(r: R): string[] {
  const rows = r.rows as R[] | undefined;
  if (!rows?.length) return [];
  const w = rows.reduce((a, b) => (new Decimal(String(b.change)).lt(new Decimal(String(a.change))) ? b : a));
  return [
    `Smallest change after 1.4d: ${str(w.change)} g at ${str(w.load)} g. Required: at least d = ${str(w.requiredChange)} g.`,
    ...(rows.some((x) => x.extraOk === false) ? ["An extra load was not 1.4d."] : []),
  ];
}

function explainCreep(r: R): string[] {
  const lines = [
    `30-min change ${str(r.d30)} g (allowed 0.5e = ${str(r.allow30)} g); 15 to 30 min ${str(r.d15)} g (allowed 0.2e = ${str(r.allow15)} g).`,
  ];
  if (r.earlyOk) lines.push("Early-stop conditions met at 30 min.");
  else if (r.d240 != null) lines.push(`Early stop not met; 4 h change ${str(r.d240)} g vs |MPE| ${str(r.mpe)} g at ${str(r.load)} g.`);
  return lines;
}

function explainTilt(r: R): string[] {
  const loads = (r.loads as R[] | undefined) ?? [];
  const lines = [
    ...(Array.isArray(r.directions) ? [`Worst of ${(r.directions as string[]).join(", ")} against the reference position.`] : []),
    r.noLoadApplies === false
      ? `No-load change ${str(r.noLoadDelta)} g (2e limit not applied to class II).`
      : `No-load change ${str(r.noLoadDelta)} g. Allowed 2e = ${str(r.noLoadAllowed)} g.`,
  ];
  if (loads.length) {
    const w = worstVs(loads, "diff");
    lines.push(`Loaded, worst: ${str(w.diff)} g at ${str(w.load)} g. Allowed |MPE|: ${str(w.mpe)} g.`);
  }
  return lines;
}

function explainTemp(r: R): string[] {
  const pairs = r.pairs as R[] | undefined;
  if (!pairs?.length) return [];
  const w = worst(pairs, "perStep");
  const perStep = new Decimal(String(w.perStep)).toDecimalPlaces(2).toString();
  return [`Worst zero change: ${perStep} g per ${r.step} °C (over ${str(w.dT)} °C). Allowed: e = ${str(w.allowed)} g.`];
}

function explainSpan(r: R): string[] {
  const errs = (r.errors as string[] | undefined) ?? [];
  const worstErr = errs.length ? Decimal.max(...errs.map((x) => abs(x))) : null;
  return [
    `Variation of error ${str(r.spread)} g over ${errs.length} measurements. Allowed: ${str(r.allowed)} g (greater of 1/2 e and 1/2 |MPE|).`,
    ...(worstErr ? [`Worst error ${worstErr.toString()} g at ${str(r.load)} g. Allowed |MPE|: ${str(r.mpe)} g.`] : []),
  ];
}

function explainConditions(r: R, view: MpeView): string[] {
  const conds = (r.conditions as R[] | undefined) ?? [];
  if (!conds.length) return [];
  const all: R[] = conds.flatMap((c) => ((c.rows as R[]) ?? []).map((row) => ({ ...row, cond: c })));
  if (!all.length) return [];
  const w = worstVs(all, "error");
  const c = w.cond as R;
  const mpe = new Decimal(String(w.mpe));
  const allowed = view === "in-service" ? mpe.mul(2) : mpe;
  const at = `${c.label} (${str(c.tempC)} °C${c.rhPct != null ? `, ${str(c.rhPct)} % RH` : ""})`;
  return [
    `Conditions: ${conds.map((x) => `${x.label} ${str(x.tempC)} °C${x.rhPct != null ? `/${str(x.rhPct)} %` : ""}`).join("; ")}.`,
    `Worst: load ${str(w.load)} g at ${at}: ${abs(w.error).toString()} g error. Allowed: ${allowed.toString()} g.`,
    ...bandLines(view, mpe, abs(w.error)),
  ];
}

function explainZeroSetting(r: R): string[] {
  const trials = (r.trials as R[] | undefined) ?? [];
  if (!trials.length) return [];
  const w = worst(trials, "e0");
  return [
    `${r.tare != null ? `Tare ${str(r.tare)} g. ` : ""}Worst of ${trials.length}: E0 = ${str(w.e0)} g after setting (L0 = ${str(r.load)} g). Allowed: 0.25e = ${str(r.allowed)} g.`,
  ];
}

export function explainProcedure(
  key: ProcedureKey,
  resultJson: unknown,
  view: MpeView = "initial",
  packId = PACK_ID,
): string[] | null {
  if (!resultJson || typeof resultJson !== "object") return null;
  const r = resultJson as R;
  if (typeof r.reason === "string" && r.passed == null) return null;
  let body: string[];
  try {
    switch (key) {
      case "ECCENTRICITY":
      case "ROLLING_ECC":
        body = explainEccentricity(r, view);
        break;
      case "REPEATABILITY":
        body = explainRepeatability(r, view);
        break;
      case "WEIGHING":
      case "TARE":
      case "VOLTAGE":
        body = explainRows(r, view);
        break;
      case "DAMP_HEAT":
      case "STATIC_TEMP":
        body = r.conditions ? explainConditions(r, view) : explainRows(r, view);
        break;
      case "ZERO_SETTING":
      case "TARE_SETTING":
        body = explainZeroSetting(r);
        break;
      case "ENDURANCE":
        body = explainEndurance(r);
        break;
      case "WARMUP":
        body = explainWarmup(r);
        break;
      case "DISCRIMINATION":
        body = explainDiscrimination(r);
        break;
      case "ZERO_RETURN":
        body = r.delta != null ? [`|P30 - P0| = ${str(r.delta)} g. Allowed 0.5e = ${str(r.allowed)} g.`] : [];
        break;
      case "CREEP":
        body = r.d30 != null ? explainCreep(r) : [];
        break;
      case "STABILITY": {
        const trials = (r.trials as R[] | undefined) ?? [];
        body = trials.length
          ? [
              `Worst of ${trials.length} trials: printed and 5 s readings span ${str(worst(trials, "deviation").deviation)} g. Allowed: e = ${str(r.allowed)} g.`,
            ]
          : [];
        break;
      }
      case "TILT":
        body = explainTilt(r);
        break;
      case "TEMP_NOLOAD":
        body = explainTemp(r);
        break;
      case "SPAN_STABILITY":
        body = r.spread != null ? explainSpan(r) : [];
        break;
      default:
        body = [];
    }
  } catch {
    // A result stored by an older pack may lack fields this pack prints.
    body = [];
  }
  if (body.length === 0) {
    body = [`${PROCEDURE_LABELS[key] ?? key}: ${r.passed === true ? "PASS" : "FAIL"} (stored result has no detail).`];
  }
  return CLAUSES[key] ? [...body, clauseLine(key, packId)] : body;
}

export interface ResultTable {
  headers: string[];
  rows: string[][];
}

const ok = (v: unknown) => (v === true ? "yes" : v === false ? "NO" : "");
const s = (v: unknown) => (v == null || v === "" ? "" : String(v));

/** Every reading behind a mark, in R 76-2 column order. No numbers invented here. */
export function resultTable(key: ProcedureKey, resultJson: unknown): ResultTable | null {
  if (!resultJson || typeof resultJson !== "object") return null;
  try {
    return tableFor(key, resultJson as R);
  } catch {
    // A result stored by an older pack may lack fields; the explainer lines still print.
    return null;
  }
}

function tableFor(key: ProcedureKey, r: R): ResultTable | null {
  const rows = (r.rows as R[] | undefined) ?? [];
  switch (key) {
    case "DAMP_HEAT":
    case "STATIC_TEMP": {
      const conds = (r.conditions as R[] | undefined) ?? [];
      if (!conds.length) break;
      return {
        headers: ["Condition", "", "L (g)", "I (g)", "dL (g)", "P (g)", "Ec (g)", "MPE (g)", "OK"],
        rows: conds.flatMap((c) =>
          ((c.rows as R[]) ?? []).map((x) => [
            `${c.label} ${s(c.tempC)} °C${c.rhPct != null ? ` ${s(c.rhPct)} %` : ""}`,
            x.direction === "down" ? "down" : "up",
            s(x.load),
            s(x.i),
            s(x.dL),
            s(x.p),
            s(x.error),
            s(x.mpe),
            ok(x.ok),
          ]),
        ),
      };
    }
    case "ZERO_SETTING":
    case "TARE_SETTING": {
      const trials = (r.trials as R[] | undefined) ?? [];
      if (!trials.length) return null;
      return {
        headers: ["Trial", "E0 (g)", "0.25e (g)", "OK"],
        rows: trials.map((t, i) => [String(i + 1), s(t.e0), s(r.allowed), ok(t.ok)]),
      };
    }
    default:
  }
  switch (key) {
    case "WEIGHING":
    case "TARE":
    case "DAMP_HEAT":
    case "STATIC_TEMP":
      if (!rows.length) return null;
      return {
        headers: ["", "L (g)", "I (g)", "dL (g)", "P (g)", "E (g)", "Ec (g)", "MPE (g)", "OK"],
        rows: rows.map((x) => [
          x.direction === "down" ? "down" : "up",
          s(x.load),
          s(x.i),
          s(x.dL),
          s(x.p ?? x.indicated),
          s(x.rawError ?? x.error),
          s(x.error),
          s(x.mpe),
          ok(x.ok),
        ]),
      };
    case "VOLTAGE":
      if (!rows.length) return null;
      return {
        headers: ["U (V)", "L (g)", "I (g)", "dL (g)", "P (g)", "E (g)", "MPE (g)", "OK"],
        rows: rows.map((x) => [s(x.voltage), s(x.load), s(x.i), s(x.dL), s(x.p), s(x.error), s(x.mpe), ok(x.ok)]),
      };
    case "ECCENTRICITY":
    case "ROLLING_ECC": {
      const errors = (r.errors as Record<string, string> | undefined) ?? {};
      const readings = (r.readings as Record<string, R> | undefined) ?? {};
      if (!Object.keys(errors).length) return null;
      const mpe = new Decimal(String(r.mpe));
      return {
        headers: ["Position", "L (g)", "I (g)", "dL (g)", "P (g)", "Ec (g)", "MPE (g)", "OK"],
        rows: Object.entries(errors).map(([pos, err]) => [
          pos,
          s(r.trueLoad),
          s(readings[pos]?.i),
          s(readings[pos]?.dL),
          s(readings[pos]?.p),
          err,
          mpe.toString(),
          ok(abs(err).lte(mpe)),
        ]),
      };
    }
    case "REPEATABILITY": {
      const series = (r.series as R[] | undefined) ?? [];
      if (!series.length) return null;
      return {
        headers: ["Series", "L (g)", "E of each weighing (g)", "Pmax - Pmin (g)", "MPE (g)", "OK"],
        rows: series.map((x) => [
          s(x.label),
          s(x.trueLoad),
          ((x.errors as string[] | undefined) ?? []).join(", "),
          s(x.spread),
          s(x.mpe),
          ok(x.passed),
        ]),
      };
    }
    case "DISCRIMINATION":
      if (!rows.length) return null;
      return {
        headers: ["L (g)", "Extra (g)", "I2 - I1 (g)", "Required d (g)", "OK"],
        rows: rows.map((x) => [s(x.load), s(x.extra), s(x.change), s(x.requiredChange), ok(x.ok)]),
      };
    case "ZERO_RETURN":
      if (r.delta == null) return null;
      return { headers: ["P0 (g)", "P30 (g)", "|P30 - P0| (g)", "0.5e (g)", "OK"], rows: [[s(r.p0), s(r.p30), s(r.delta), s(r.allowed), ok(r.passed)]] };
    case "CREEP":
      if (r.d30 == null) return null;
      return {
        headers: ["Check", "Change (g)", "Limit (g)"],
        rows: [
          ["0 to 30 min", s(r.d30), `0.5e = ${s(r.allow30)}`],
          ["15 to 30 min", s(r.d15), `0.2e = ${s(r.allow15)}`],
          ...(r.d240 != null ? [["0 to 4 h", s(r.d240), `|MPE| = ${s(r.mpe)}`]] : []),
        ],
      };
    case "STABILITY": {
      const trials = (r.trials as R[] | undefined) ?? [];
      if (!trials.length) return null;
      return {
        headers: ["Trial", "Printed vs 5 s span (g)", "e (g)", "OK"],
        rows: trials.map((t, i) => [String(i + 1), s(t.deviation), s(r.allowed), ok(t.ok)]),
      };
    }
    case "TILT": {
      const loads = (r.loads as R[] | undefined) ?? [];
      return {
        headers: ["Condition", "|tilted - reference| (g)", "Limit (g)", "OK"],
        rows: [
          ["No load", s(r.noLoadDelta), r.noLoadApplies === false ? "n/a (class II)" : `2e = ${s(r.noLoadAllowed)}`, ok(r.noLoadOk)],
          ...loads.map((l) => [`${s(l.load)} g, worst direction`, s(l.diff), `MPE = ${s(l.mpe)}`, ok(l.ok)]),
        ],
      };
    }
    case "WARMUP":
      if (!rows.length) return null;
      return {
        headers: ["Minute", "E0 (g)", "EL (g)", "EL - E0 (g)", "MPE (g)", "OK"],
        rows: rows.map((x) => [s(x.minute), s(x.e0), s(x.eL), s(x.diff), s(r.mpe), ok(x.ok)]),
      };
    case "TEMP_NOLOAD": {
      const pairs = (r.pairs as R[] | undefined) ?? [];
      if (!pairs.length) return null;
      return {
        headers: ["dT (°C)", "Zero change (g)", `Per ${s(r.step) || "5"} °C (g)`, "e (g)", "OK"],
        rows: pairs.map((x) => [
          s(x.dT),
          s(x.dZero),
          x.perStep == null ? "" : new Decimal(String(x.perStep)).toDecimalPlaces(2).toString(),
          s(x.allowed),
          ok(x.ok),
        ]),
      };
    }
    case "SPAN_STABILITY": {
      const errs = (r.errors as string[] | undefined) ?? [];
      if (!errs.length) return null;
      return {
        headers: ["Measurement", "E (g)", "MPE (g)"],
        rows: [...errs.map((x, i) => [String(i + 1), x, s(r.mpe)]), ["Variation", s(r.spread), `limit ${s(r.allowed)}`]],
      };
    }
    case "ENDURANCE":
      if (!rows.length) return null;
      return {
        headers: ["L (g)", "E before (g)", "E after (g)", "Durability (g)", "MPE (g)", "OK"],
        rows: rows.map((x) => [s(x.load), s(x.eBefore), s(x.eAfter), s(x.durability), s(x.mpe), ok(x.ok)]),
      };
    default:
      return null;
  }
}

export interface ShowWorkingRow {
  key: ProcedureKey;
  status: ProcedureStatus;
  computed: boolean;
  lines: string[];
  note: string | null;
  table: ResultTable | null;
}

/** Report / screen order: pack marks in pack order, then inspector-only sheets. */
const ORDER = [...PACK_MARKS, ...NEVER_MARK] as readonly string[];
const byOrder = (a: { key: string }, b: { key: string }) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key);

function reasonOf(resultJson: unknown, fallback: string): string {
  if (resultJson && typeof resultJson === "object" && "reason" in resultJson) {
    return String((resultJson as { reason: unknown }).reason);
  }
  return fallback;
}

export function buildShowWorking(
  procedures: Procedure[],
  view: MpeView = "initial",
  packId = PACK_ID,
): ShowWorkingRow[] {
  return [...procedures].sort(byOrder).map((p): ShowWorkingRow => {
    const base = { key: p.key, status: p.status, lines: [] as string[], table: null };
    const computed = (PACK_MARKS as readonly string[]).includes(p.key);
    if (!computed) {
      const never = (NEVER_MARK as readonly string[]).includes(p.key);
      return {
        ...base,
        computed: false,
        note:
          p.status === "EMPTY"
            ? "Not entered."
            : never
              ? "Entered, not marked — inspector judgement only. Never auto-PASS."
              : "Entered, not marked in this pack.",
      };
    }
    if (p.status === "NOT_APPLICABLE") {
      const by = (p.resultJson as { by?: string } | null)?.by === "tester" ? "declared by tester" : "per pack scope";
      return { ...base, computed: true, note: `Not applicable (${by}): ${reasonOf(p.resultJson, "no reason stored")}` };
    }
    if (p.status === "CANNOT_COMPUTE") {
      return { ...base, computed: true, note: reasonOf(p.resultJson, "cannot-compute") };
    }
    if (p.status === "EMPTY") {
      return { ...base, computed: true, note: "Not entered." };
    }
    return {
      ...base,
      computed: true,
      lines: explainProcedure(p.key, p.resultJson, view, packId) ?? [],
      note: null,
      table: resultTable(p.key, p.resultJson),
    };
  });
}

export type Verdict = "FAIL" | "CANNOT COMPUTE" | "INCOMPLETE" | "PASS";

/** The one Grant rule: every pack mark present and either PASS or not applicable. */
export function grantable(procedures: Array<Pick<Procedure, "key" | "status">>): boolean {
  return PACK_MARKS.every((k) => {
    const st = procedures.find((p) => p.key === k)?.status;
    return st === "MARKED_PASS" || st === "NOT_APPLICABLE";
  });
}

/** Same precedence as verdictLine, for list views. */
export function shortVerdict(procedures: Array<Pick<Procedure, "key" | "status">>): Verdict {
  const marks = procedures.filter((p) => (PACK_MARKS as readonly string[]).includes(p.key));
  if (marks.some((p) => p.status === "MARKED_FAIL")) return "FAIL";
  if (marks.some((p) => p.status === "CANNOT_COMPUTE")) return "CANNOT COMPUTE";
  return grantable(procedures) ? "PASS" : "INCOMPLETE";
}

/** Tester-declared not-applicable sheets, named so a reviewer cannot miss them. */
export function testerWaivers(procedures: Procedure[]): string[] {
  return procedures
    .filter((p) => p.status === "NOT_APPLICABLE" && (p.resultJson as { by?: string } | null)?.by === "tester")
    .sort(byOrder)
    .map((p) => `${PROCEDURE_LABELS[p.key] ?? p.key} — ${reasonOf(p.resultJson, "no reason")}`);
}

/** One-line verdict for the report head. Never says PASS while a sheet is open. */
export function verdictLine(procedures: Procedure[]): string {
  const marks = procedures.filter((p) => (PACK_MARKS as readonly string[]).includes(p.key)).sort(byOrder);
  const named = (st: ProcedureStatus) => marks.filter((p) => p.status === st).map((p) => PROCEDURE_LABELS[p.key] ?? p.key);
  const fails = named("MARKED_FAIL");
  const cannot = named("CANNOT_COMPUTE");
  const missing = PACK_MARKS.filter((k) => !marks.some((p) => p.key === k)).map((k) => PROCEDURE_LABELS[k] ?? k);
  const empty = [...named("EMPTY"), ...missing];
  const na = named("NOT_APPLICABLE").length;
  const passes = named("MARKED_PASS").length;
  if (fails.length) return `Result: FAIL — ${fails.join(", ")}. ${passes} other marks pass, ${na} not applicable.`;
  if (cannot.length) return `Result: CANNOT COMPUTE — ${cannot.join(", ")}.`;
  if (empty.length) return `Result: INCOMPLETE — not entered: ${empty.join(", ")}.`;
  return `Result: PASS on ${passes} pack sheets within R 76-1 limits, ${na} not applicable. Not covered by this pack: EMC and disturbances (B.3), construction examination and software checklist (inspector-only), multi-interval rules.`;
}

export const MPE_USED_LINE = `MPE used: ${MPE_BAND}`;

const STATUS_LABEL: Record<ProcedureStatus, string> = {
  MARKED_PASS: "PASS",
  MARKED_FAIL: "FAIL",
  CANNOT_COMPUTE: "CANNOT-COMPUTE",
  NOT_APPLICABLE: "not applicable",
  ENTERED_NOT_MARKED: "entered, not marked in this pack",
  EMPTY: "not entered",
};

export type ReportEvaluation = Evaluation & {
  instrument: Instrument;
  procedures: Procedure[];
  attachments?: Array<{ filename: string }>;
};

export interface ReportSection {
  title: string;
  status: string;
  lines: string[];
  table: ResultTable | null;
}

/** Shared by PDF and Word so both files say exactly what the screen says. */
export function buildReport(evaluation: ReportEvaluation): { head: string[]; sections: ReportSection[]; foot: string[] } {
  const packId = evaluation.packId || PACK_ID;
  const head = [
    `Instrument: ${evaluation.instrument.manufacturer} ${evaluation.instrument.model} — Class ${evaluation.instrument.class}, Max ${evaluation.instrument.maxG} g, e ${evaluation.instrument.eG} g, n=${evaluation.instrument.n ?? "?"}`,
    `Min ${evaluation.instrument.minG ?? "?"} g, Unom ${evaluation.instrument.unomV ?? "?"} V, serial ${evaluation.instrument.serialNo ?? "?"}${evaluation.instrument.specs ? `; ${evaluation.instrument.specs}` : ""}`,
    `Evaluation: ${evaluation.id}`,
    `Pack: ${packId}`,
    MPE_USED_LINE,
    `Lab: temperature ${evaluation.tempC ?? "?"} °C, RH ${evaluation.rhPct ?? "?"} %, resolution during test ${evaluation.resolutionG ?? "?"} g, observer ${evaluation.observer ?? "?"}`,
    "Errors: P = I + 1/2 e - dL (A.4.4.3); E = P - L; Ec = E - E0 where a zero error is recorded.",
    ...(evaluation.attachments?.length ? [`Attachments: ${evaluation.attachments.map((a) => a.filename).join(", ")}`] : []),
    verdictLine(evaluation.procedures),
    ...testerWaivers(evaluation.procedures).map((w) => `Tester waiver: ${w}`),
  ];
  const sections = buildShowWorking(evaluation.procedures, "initial", packId).map((row) => ({
    title: PROCEDURE_LABELS[row.key] ?? row.key,
    status: STATUS_LABEL[row.status],
    lines: row.note ? [...row.lines, row.note] : row.lines,
    table: row.table,
  }));
  const when = evaluation.reviewedAt ? ` at ${evaluation.reviewedAt.toISOString()}` : "";
  const foot = [`Review: ${evaluation.reviewDecision}${when}${evaluation.reviewNote ? ` — ${evaluation.reviewNote}` : ""}`];
  return { head, sections, foot };
}

export const REPORT_TITLE = "SIH26035 — OIML R 76 type-evaluation report";

/** Plain-text form of the report (tests and smoke greps). */
export function buildReportLines(evaluation: ReportEvaluation): string[] {
  const { head, sections, foot } = buildReport(evaluation);
  const lines = ["NawiMark", REPORT_TITLE, "", ...head, "", "Procedures:"];
  for (const sec of sections) {
    lines.push(`  ${sec.title}: ${sec.status}`);
    for (const line of sec.lines) lines.push(`    ${line}`);
  }
  return [...lines, "", ...foot];
}

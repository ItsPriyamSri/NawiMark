/**
 * Deterministic bullets from resultJson only — no LLM, no free text.
 * Corner-error wording here is the product's locked USP line.
 */
import { Decimal } from "decimal.js";
import type { Evaluation, Instrument, Procedure, ProcedureKey, ProcedureStatus } from "@prisma/client";
import { MPE_BAND, MPE_BAND_INSPECTION, NEVER_MARK, PACK_ID, PACK_MARKS } from "@/engine/pack";

export const CLAUSES: Partial<Record<ProcedureKey, string>> = {
  WEIGHING: "OIML R 76-1 3.5 (weighing performance)",
  ECCENTRICITY: "OIML R 76-1 3.6.2 / 3.6.2.1 (eccentricity)",
  REPEATABILITY: "OIML R 76-1 3.6.1 (repeatability)",
  TARE: "OIML R 76-1 3.5 / A.4.6.2 (tare weighing)",
  DISCRIMINATION: "OIML R 76-1 3.8.2 (digital discrimination)",
  SENSITIVITY: "OIML R 76-1 3.8.1 (analogue sensitivity)",
  ZERO_RETURN: "OIML R 76-1 3.5.3 / A.4.2.3 (zero return)",
  CREEP: "OIML R 76-1 A.4.5 (creep)",
  STABILITY: "OIML R 76-1 4.5 (stability of equilibrium)",
  TILT: "OIML R 76-1 3.9.1.1 / A.5.1 (tilt)",
  WARMUP: "OIML R 76-1 A.4.4 (warm-up)",
  VOLTAGE: "OIML R 76-1 A.5.4 (voltage variations)",
  TEMP_NOLOAD: "OIML R 76-1 3.9.2.1 (temperature effect on no-load)",
  DAMP_HEAT: "OIML R 76-1 A.5.3 (damp heat)",
  SPAN_STABILITY: "OIML R 76-1 A.6 (span stability)",
  ENDURANCE: "OIML R 76-1 A.6 (endurance)",
  ROLLING_ECC: "OIML R 76-1 3.6.2 (rolling-load eccentricity)",
};

export type MpeView = "initial" | "in-service";

interface EccentricityResult {
  passed: boolean;
  mpe: string;
  errors: Record<string, string>;
}

interface RepeatabilityResult {
  passed: boolean;
  spread: string;
  mpe: string;
  spreadOk: boolean;
  errorsOk: boolean;
  errors: string[];
}

interface WeighingResult {
  passed: boolean;
  rows: Array<{ load: string; indicated: string; error: string; mpe: string; ok: boolean }>;
}

function bandLines(view: MpeView, mpe: Decimal, errorAbs: Decimal): string[] {
  if (view === "in-service") {
    const doubled = mpe.mul(2);
    const would = errorAbs.lte(doubled) ? "passed" : "still failed";
    return [
      `Band shown: ${MPE_BAND_INSPECTION}. Allowed here: ${doubled.toString()} g.`,
      `This case would have ${would} on 2×. Stored mark still uses type-evaluation.`,
    ];
  }
  const lines = [`Band used: type-evaluation / initial, not the later shop 2×.`];
  const doubled = mpe.mul(2);
  if (errorAbs.gt(mpe) && errorAbs.lte(doubled)) {
    lines.push(`If we had used 2×, allowed would be ${doubled.toString()} g and this would have passed.`);
  }
  return lines;
}

/** Locked wording: "Corner C: 11 g error. Allowed at this load: 10 g." */
export function explainEccentricity(result: EccentricityResult, view: MpeView = "initial"): string[] {
  const entries = Object.entries(result.errors).map(([pos, err]) => ({
    pos,
    err: new Decimal(err),
  }));
  const worst = entries.reduce((a, b) => (b.err.abs().gt(a.err.abs()) ? b : a));
  const mpe = new Decimal(result.mpe);
  const allowed = view === "in-service" ? mpe.mul(2) : mpe;
  const lines = [
    `Corner ${worst.pos}: ${worst.err.abs().toString()} g error. Allowed at this load: ${allowed.toString()} g.`,
    ...bandLines(view, mpe, worst.err.abs()),
    `Clause: ${CLAUSES.ECCENTRICITY}. Pack: ${PACK_ID}.`,
  ];
  return lines;
}

export function explainRepeatability(result: RepeatabilityResult, view: MpeView = "initial"): string[] {
  const mpe = new Decimal(result.mpe);
  const spread = new Decimal(result.spread);
  const allowed = view === "in-service" ? mpe.mul(2) : mpe;
  return [
    `Spread across readings: ${spread.toString()} g. Allowed: ${allowed.toString()} g.`,
    ...bandLines(view, mpe, spread),
    `Clause: ${CLAUSES.REPEATABILITY}. Pack: ${PACK_ID}.`,
  ];
}

export function explainWeighing(result: WeighingResult, view: MpeView = "initial", clause = CLAUSES.WEIGHING): string[] {
  const worst = result.rows.reduce((a, b) =>
    new Decimal(b.error).abs().gt(new Decimal(a.error).abs()) ? b : a,
  );
  const mpe = new Decimal(worst.mpe);
  const allowed = view === "in-service" ? mpe.mul(2) : mpe;
  return [
    `Load ${worst.load} g: ${new Decimal(worst.error).abs().toString()} g error. Allowed: ${allowed.toString()} g.`,
    ...bandLines(view, mpe, new Decimal(worst.error).abs()),
    `Clause: ${clause}. Pack: ${PACK_ID}.`,
  ];
}

function genericLines(key: ProcedureKey, result: Record<string, unknown>, view: MpeView): string[] {
  const passed = result.passed === true;
  const mpe = typeof result.mpe === "string" ? new Decimal(result.mpe) : null;
  const lines = [`${key}: ${passed ? "PASS" : "FAIL"} on stored type-eval mark.`];
  if (mpe) lines.push(...bandLines(view, mpe, new Decimal(0)));
  if (CLAUSES[key]) lines.push(`Clause: ${CLAUSES[key]}. Pack: ${PACK_ID}.`);
  return lines;
}

export function explainProcedure(key: ProcedureKey, resultJson: unknown, view: MpeView = "initial"): string[] | null {
  if (!resultJson || typeof resultJson !== "object") return null;
  const r = resultJson as Record<string, unknown>;
  switch (key) {
    case "ECCENTRICITY":
    case "ROLLING_ECC":
      return explainEccentricity(r as unknown as EccentricityResult, view);
    case "REPEATABILITY":
      return explainRepeatability(r as unknown as RepeatabilityResult, view);
    case "WEIGHING":
    case "TARE":
    case "DAMP_HEAT":
      return explainWeighing(r as unknown as WeighingResult, view, CLAUSES[key]);
    default:
      if ("rows" in r) return explainWeighing(r as unknown as WeighingResult, view, CLAUSES[key]);
      return genericLines(key, r, view);
  }
}

export interface ShowWorkingRow {
  key: ProcedureKey;
  status: ProcedureStatus;
  computed: boolean;
  lines: string[];
  note: string | null;
}

export function buildShowWorking(procedures: Procedure[], view: MpeView = "initial"): ShowWorkingRow[] {
  return procedures.map((p) => {
    const computed = (PACK_MARKS as readonly string[]).includes(p.key);
    if (!computed) {
      const never = (NEVER_MARK as readonly string[]).includes(p.key);
      return {
        key: p.key,
        status: p.status,
        computed: false,
        lines: [],
        note:
          p.status === "EMPTY"
            ? "Not entered."
            : never
              ? "Entered, not marked — inspector judgement only. Never auto-PASS."
              : "Entered, not marked in this pack.",
      };
    }
    const lines = explainProcedure(p.key, p.resultJson, view) ?? [];
    return {
      key: p.key,
      status: p.status,
      computed: true,
      lines,
      note: p.status === "CANNOT_COMPUTE" ? cannotComputeNote(p.resultJson) : null,
    };
  });
}

function cannotComputeNote(resultJson: unknown): string {
  if (resultJson && typeof resultJson === "object" && "reason" in resultJson) {
    return String((resultJson as { reason: unknown }).reason);
  }
  return "cannot-compute";
}

export const MPE_USED_LINE = `MPE used: ${MPE_BAND}`;

const STATUS_LABEL: Record<ProcedureStatus, string> = {
  MARKED_PASS: "PASS",
  MARKED_FAIL: "FAIL",
  CANNOT_COMPUTE: "CANNOT-COMPUTE",
  ENTERED_NOT_MARKED: "entered, not marked in this pack",
  EMPTY: "not entered",
};

export function buildReportLines(
  evaluation: Evaluation & { instrument: Instrument; procedures: Procedure[] },
): string[] {
  const lines: string[] = [];
  lines.push("NawiMark");
  lines.push("SIH26035 — OIML R-76 type-evaluation report");
  lines.push("");
  lines.push(
    `Instrument: ${evaluation.instrument.manufacturer} ${evaluation.instrument.model} — Class ${evaluation.instrument.class}, Max ${evaluation.instrument.maxG} g, e ${evaluation.instrument.eG} g, n=${evaluation.instrument.n ?? "?"}`,
  );
  lines.push(`Pack: ${PACK_ID}`);
  lines.push(MPE_USED_LINE);
  lines.push(
    `Lab: temperature ${evaluation.tempC ?? "?"} °C, RH ${evaluation.rhPct ?? "?"} %, observer ${evaluation.observer ?? "?"}`,
  );
  lines.push("");
  lines.push("Procedures:");
  for (const row of buildShowWorking(evaluation.procedures)) {
    lines.push(`  ${row.key}: ${STATUS_LABEL[row.status]}`);
    for (const line of row.lines) lines.push(`    ${line}`);
    if (row.note && row.computed) lines.push(`    ${row.note}`);
    if (row.note && !row.computed) lines.push(`    ${row.note}`);
  }
  lines.push("");
  lines.push(
    `Review: ${evaluation.reviewDecision}${evaluation.reviewNote ? ` — ${evaluation.reviewNote}` : ""}`,
  );
  return lines;
}

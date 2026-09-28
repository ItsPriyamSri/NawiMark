/**
 * markEvaluation: the one place payloadJson becomes resultJson. Never fakes
 * a PASS — an invalid instrument, out-of-band env, missing resolution, or an
 * incomplete payload marks the affected procedures CANNOT_COMPUTE instead of
 * guessing. Minimum reading counts are the ones R 76-1:2006 Annex A/B states.
 */
import { Prisma, ProcedureKey } from "@prisma/client";
import { Decimal } from "decimal.js";
import type { AccuracyClass } from "@/engine/r76";
import {
  creepResult,
  discriminationResult,
  durabilityResult,
  eccentricityResult,
  indicationError,
  mpeInitial,
  priorToRounding,
  repeatabilityResult,
  spanStabilityResult,
  stabilityResult,
  tempNoLoadResult,
  tiltResult,
  validateInstrument,
  warmupResult,
  weighingPerformanceResult,
  zeroReturnResult,
  zeroSettingResult,
} from "@/engine/r76";
import {
  ABOUT_HALF_MAX,
  CLOSE_TO_MAX,
  PACK_ID,
  PACK_MARKS,
  RH_MAX,
  RH_MIN,
  TEMP_MAX,
  TEMP_MIN,
  TESTER_MAY_WAIVE,
  notApplicableReason,
} from "@/engine/pack";
import { db } from "@/lib/db";

const ECC_POSITIONS = ["A", "B", "C", "D"] as const;
const ECC_LOAD_TOLERANCE = new Decimal("0.02"); // 2% of Max/3
const WARMUP_MINUTES = [0, 5, 15, 30];

type Status = "MARKED_PASS" | "MARKED_FAIL" | "CANNOT_COMPUTE" | "NOT_APPLICABLE";
type Outcome = { status: Status; resultJson: object };

/** An observation: displayed indication I, plus ΔL when read at resolution e. */
export type Reading = string | { i?: string; dL?: string };

export interface Ctx {
  class_: AccuracyClass;
  e: Decimal;
  Max: Decimal;
  /** true when the test resolution is ≤ 0.2e, so no ΔL is needed (3.5.3.2). */
  fine: boolean;
  /** nominal mains voltage from the instrument record, for A.5.4 */
  unom?: Decimal | null;
}

function cannotCompute(reason: string): Outcome {
  return { status: "CANNOT_COMPUTE", resultJson: { reason } };
}

function emptyPayload(payload: unknown): boolean {
  if (payload == null || typeof payload !== "object") return true;
  return Object.keys(payload as object).length === 0;
}

function finiteNumber(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function dec(raw: unknown, what: string): Decimal {
  if (typeof raw !== "string" || raw.trim() === "") throw new Error(`cannot-compute: ${what} missing`);
  let x: Decimal;
  try {
    x = new Decimal(raw.trim());
  } catch {
    throw new Error(`cannot-compute: ${what} "${raw}" is not a number`);
  }
  if (!x.isFinite()) throw new Error(`cannot-compute: ${what} "${raw}" is not a finite number`);
  return x;
}

/** 4.5.2: after zero-setting the zero deviation is within 0.25e; a larger E0 means the run is invalid. */
function gateE0(ctx: Ctx, e0: Decimal, what: string) {
  const limit = ctx.e.mul("0.25");
  if (e0.abs().gt(limit)) {
    throw new Error(`cannot-compute: ${what} zero error E0 = ${e0} g exceeds 0.25e = ${limit} g (R 76-1 4.5.2); re-zero and repeat`);
  }
}

function requireLoad(ctx: Ctx, load: Decimal, what: string, where: "half" | "max", clause: string) {
  const f = load.div(ctx.Max);
  const ok = where === "max" ? f.gte(CLOSE_TO_MAX) : f.gte(ABOUT_HALF_MAX[0]) && f.lte(ABOUT_HALF_MAX[1]);
  if (!ok) {
    const want = where === "max" ? `close to Max (≥ ${CLOSE_TO_MAX * 100} %)` : `about ½ Max (${ABOUT_HALF_MAX[0] * 100}–${ABOUT_HALF_MAX[1] * 100} %)`;
    throw new Error(`cannot-compute: ${what} load ${load} g is not ${want} of Max ${ctx.Max} g (${clause})`);
  }
}

/** Reading → P (indication prior to rounding). */
function p(ctx: Ctx, r: Reading | undefined, what: string): Decimal {
  const i = typeof r === "string" ? r : r?.i;
  const dL = typeof r === "string" ? undefined : r?.dL;
  const I = dec(i, what);
  if (ctx.fine) return I;
  if (dL == null || dL.trim() === "") {
    throw new Error(
      `cannot-compute: ${what} needs ΔL — rounding error must be eliminated at resolution e (R 76-1 3.5.3.2, A.4.4.3)`,
    );
  }
  return priorToRounding(I, dec(dL, `${what} ΔL`), ctx.e);
}

function readingJson(r: Reading | undefined, P: Decimal) {
  return {
    i: typeof r === "string" ? r : (r?.i ?? ""),
    dL: typeof r === "string" ? null : (r?.dL ?? null),
    p: P.toString(),
  };
}

function pass(ok: boolean): Status {
  return ok ? "MARKED_PASS" : "MARKED_FAIL";
}

/**
 * Re-mark every pack sheet from its stored payload. Pass `tx` to run inside a
 * caller's transaction (save-and-mark, grant) so readings and marks commit together.
 */
export async function markEvaluation(evaluationId: string, tx?: Prisma.TransactionClient) {
  return tx ? markIn(evaluationId, tx) : db.$transaction((t) => markIn(evaluationId, t), { timeout: 30000 });
}

async function markIn(evaluationId: string, tx: Prisma.TransactionClient) {
  // Evaluations created before a sheet existed get an empty row, so they read INCOMPLETE, not PASS.
  const have = await tx.procedure.findMany({ where: { evaluationId }, select: { key: true } });
  const missing = Object.values(ProcedureKey).filter((k) => !have.some((p) => p.key === k));
  if (missing.length) {
    await tx.procedure.createMany({ data: missing.map((key) => ({ evaluationId, key, status: "EMPTY" as const, payloadJson: {} })) });
  }

  const evaluation = await tx.evaluation.findUniqueOrThrow({
    where: { id: evaluationId },
    include: { instrument: true, procedures: true },
  });
  const { instrument, procedures } = evaluation;

  let class_: AccuracyClass;
  let e: Decimal;
  let instrumentReason: string | null = null;
  try {
    class_ = instrument.class as AccuracyClass;
    e = new Decimal(instrument.eG);
    validateInstrument(class_, new Decimal(instrument.maxG), e);
  } catch (err) {
    instrumentReason = err instanceof Error ? err.message : "cannot-compute: bad instrument";
  }

  let envReason: string | null = null;
  let fine = false;
  if (!instrumentReason) {
    const temp = finiteNumber(evaluation.tempC);
    const rh = finiteNumber(evaluation.rhPct);
    const res = finiteNumber(evaluation.resolutionG);
    if (temp === null || rh === null) {
      envReason = "cannot-compute: lab temperature/humidity not entered or not a number";
    } else if (temp < TEMP_MIN || temp > TEMP_MAX) {
      envReason = `cannot-compute: temperature ${temp}°C outside pack band [${TEMP_MIN}, ${TEMP_MAX}]`;
    } else if (rh < RH_MIN || rh > RH_MAX) {
      envReason = `cannot-compute: RH ${rh}% outside pack band [${RH_MIN}, ${RH_MAX}]`;
    } else if (res === null || res <= 0 || new Decimal(res).gt(e!)) {
      envReason = `cannot-compute: resolution during test must be a number in (0, e=${e!}] g`;
    } else {
      fine = new Decimal(res).lte(e!.mul("0.2"));
    }
  }

  const blockedReason = instrumentReason ?? envReason;

  {
    await tx.evaluation.update({ where: { id: evaluationId }, data: { packId: PACK_ID } });
    for (const proc of procedures) {
      if (!(PACK_MARKS as readonly string[]).includes(proc.key)) continue;

      const na = notApplicableReason(proc.key, instrument.class, instrument.maxG, instrument.eG);
      if (na) {
        await tx.procedure.update({
          where: { id: proc.id },
          data: { status: "NOT_APPLICABLE", resultJson: { reason: na, by: "pack" }, markedByPack: PACK_ID },
        });
        continue;
      }

      const waived = (proc.payloadJson as { notApplicable?: unknown } | null)?.notApplicable;
      if ((TESTER_MAY_WAIVE as readonly string[]).includes(proc.key) && typeof waived === "string" && waived.trim()) {
        const reason = waived.trim();
        const outcome =
          reason.length >= 10
            ? { status: "NOT_APPLICABLE" as const, resultJson: { reason, by: "tester" } }
            : cannotCompute("cannot-compute: a not-applicable waiver needs a reason of at least 10 characters");
        await tx.procedure.update({ where: { id: proc.id }, data: { ...outcome, markedByPack: PACK_ID } });
        continue;
      }

      if (emptyPayload(proc.payloadJson) && !blockedReason) {
        await tx.procedure.update({
          where: { id: proc.id },
          data: { status: "EMPTY", resultJson: Prisma.DbNull, markedByPack: null },
        });
        continue;
      }

      if (blockedReason) {
        const { status, resultJson } = cannotCompute(blockedReason);
        await tx.procedure.update({ where: { id: proc.id }, data: { status, resultJson, markedByPack: PACK_ID } });
        continue;
      }

      const unom = finiteNumber(instrument.unomV);
      const ctx: Ctx = { class_: class_!, e: e!, Max: new Decimal(instrument.maxG), fine, unom: unom === null ? null : new Decimal(unom) };
      const outcome = markOne(proc.key, proc.payloadJson, ctx);
      await tx.procedure.update({
        where: { id: proc.id },
        data: { status: outcome.status, resultJson: outcome.resultJson, markedByPack: PACK_ID },
      });
    }
  }

  return tx.evaluation.findUniqueOrThrow({
    where: { id: evaluationId },
    include: { instrument: true, procedures: true },
  });
}

export function markOne(key: string, payload: unknown, ctx: Ctx): Outcome {
  try {
    switch (key) {
      case "WEIGHING":
        return markWeighing(payload, ctx);
      case "TARE":
        return markTare(payload, ctx);
      case "DAMP_HEAT":
      case "STATIC_TEMP":
        return markConditions(payload, ctx, key);
      case "ZERO_SETTING":
        return markZeroSetting(payload, ctx, false);
      case "TARE_SETTING":
        return markZeroSetting(payload, ctx, true);
      case "VOLTAGE":
        return markVoltage(payload, ctx);
      case "ENDURANCE":
        return markEndurance(payload, ctx);
      case "WARMUP":
        return markWarmup(payload, ctx);
      case "REPEATABILITY":
        return markRepeatability(payload, ctx);
      case "ECCENTRICITY":
        return markEccentricity(payload, ctx, false);
      case "ROLLING_ECC":
        return markEccentricity(payload, ctx, true);
      case "DISCRIMINATION":
        return markDiscrimination(payload, ctx);
      case "ZERO_RETURN":
        return markZeroReturn(payload, ctx);
      case "CREEP":
        return markCreep(payload, ctx);
      case "STABILITY":
        return markStability(payload, ctx);
      case "TILT":
        return markTilt(payload, ctx);
      case "TEMP_NOLOAD":
        return markTempNoLoad(payload, ctx);
      case "SPAN_STABILITY":
        return markSpan(payload, ctx);
      default:
        throw new Error(`cannot-compute: ${key} is not in ${PACK_ID}`);
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : "cannot-compute: unknown error";
    return { status: "CANNOT_COMPUTE", resultJson: { reason } };
  }
}

type RowIn = { load?: string; indicated?: Reading; direction?: "up" | "down" };

function weighRows(ctx: Ctx, rows: RowIn[] | undefined, what: string) {
  if (!rows?.length) throw new Error(`cannot-compute: ${what} has no load/indication rows`);
  return rows.map((r, i) => {
    const load = dec(r.load, `${what} row ${i + 1} load`);
    const P = p(ctx, r.indicated, `${what} row ${i + 1}`);
    return { load, indicated: P, direction: r.direction ?? ("up" as const), raw: r.indicated };
  });
}

function distinctLoads(rows: Array<{ load: Decimal }>) {
  return new Set(rows.map((r) => r.load.toString())).size;
}

type WRows = ReturnType<typeof weighRows>;

function weighJson(ctx: Ctx, rows: WRows, what: string) {
  const result = weighingPerformanceResult(rows, ctx.class_, ctx.e);
  gateE0(ctx, result.e0, what);
  return {
    passed: result.passed,
    e0: result.e0.toString(),
    rows: result.rows.map((r, i) => ({
      load: r.load.toString(),
      ...readingJson(rows[i].raw, r.indicated),
      indicated: r.indicated.toString(),
      direction: r.direction,
      error: r.corrected.toString(),
      rawError: r.error.toString(),
      mpe: r.mpe.toString(),
      ok: r.ok,
    })),
  };
}

function markWeighing(payload: unknown, ctx: Ctx): Outcome {
  const rows = weighRows(ctx, (payload as { rows?: RowIn[] })?.rows, "weighing");
  if (distinctLoads(rows) < 10) throw new Error("cannot-compute: weighing needs at least 10 different test loads (A.4.4.1)");
  if (!rows.some((r) => r.load.eq(ctx.Max))) throw new Error("cannot-compute: weighing test must include Max (A.4.4.1)");
  if (!rows.some((r) => r.direction === "down")) throw new Error("cannot-compute: weighing test must unload back to zero (A.4.4.1)");
  const out = weighJson(ctx, rows, "weighing");
  return { status: pass(out.passed), resultJson: { ...out, kind: "WEIGHING", mpeBand: "initial" } };
}

/** A.4.6.1: net loads after a subtractive tare T; net + T never exceeds Max; MPE on the net value (3.5.3.3). */
function markTare(payload: unknown, ctx: Ctx): Outcome {
  const pl = payload as { tare?: string; rows?: RowIn[] };
  const tare = dec(pl.tare, "tare value");
  if (tare.lte(0) || tare.gte(ctx.Max)) throw new Error(`cannot-compute: tare value ${tare} g must be between 0 and Max`);
  const rows = weighRows(ctx, pl.rows, "tare");
  if (distinctLoads(rows) < 5) throw new Error("cannot-compute: tare weighing needs at least 5 net load steps (A.4.6.1)");
  const over = rows.find((r) => r.load.add(tare).gt(ctx.Max));
  if (over) throw new Error(`cannot-compute: net load ${over.load} g + tare ${tare} g exceeds Max ${ctx.Max} g`);
  const out = weighJson(ctx, rows, "tare");
  return { status: pass(out.passed), resultJson: { ...out, kind: "TARE", tare: tare.toString(), mpeBand: "initial" } };
}

type ConditionIn = { label?: string; tempC?: string; rhPct?: string; rows?: RowIn[] };

/**
 * Weighing tests under stated conditions. B.2 damp heat: reference 20 °C / 50 %,
 * high temperature / 85 %, reference again. A.5.3.1 static temperatures: 20 °C,
 * high, low, 5 °C when low ≤ 0 °C, 20 °C. Each at least 5 loads; each |Ec| ≤ MPE.
 */
function markConditions(payload: unknown, ctx: Ctx, key: "DAMP_HEAT" | "STATIC_TEMP"): Outcome {
  const conditions = ((payload as { conditions?: ConditionIn[] })?.conditions ?? []).filter(
    (c) => c.tempC?.trim() || c.rows?.length,
  );
  const damp = key === "DAMP_HEAT";
  const need = damp ? 3 : 4;
  const clause = damp ? "B.2" : "A.5.3.1";
  if (conditions.length < need) {
    throw new Error(
      damp
        ? "cannot-compute: damp heat needs three conditions: reference, high temperature at 85 % RH, reference (B.2)"
        : "cannot-compute: static temperatures need 20 °C, high, low (and 5 °C if low ≤ 0 °C), then 20 °C again (A.5.3.1)",
    );
  }
  const out = conditions.map((c, i) => {
    const what = `${damp ? "damp heat" : "static temperature"} condition ${i + 1}`;
    const tempC = dec(c.tempC, `${what} temperature`);
    const rhPct = damp ? dec(c.rhPct, `${what} RH`) : null;
    const rows = weighRows(ctx, c.rows, what);
    if (distinctLoads(rows) < 5) throw new Error(`cannot-compute: ${what} needs at least 5 loads (${clause}, A.4.4.1)`);
    return { label: c.label?.trim() || `#${i + 1}`, tempC: tempC.toString(), rhPct: rhPct?.toString() ?? null, ...weighJson(ctx, rows, what) };
  });
  if (!damp) {
    const temps = out.map((c) => Number(c.tempC));
    if (Math.min(...temps) <= 0 && !temps.includes(5)) {
      throw new Error("cannot-compute: low temperature ≤ 0 °C, so a test at 5 °C is also required (A.5.3.1)");
    }
  } else if (!out.some((c) => Number(c.rhPct) >= 85)) {
    throw new Error("cannot-compute: no damp heat condition at 85 % RH (B.2)");
  }
  const passed = out.every((c) => c.passed);
  return { status: pass(passed), resultJson: { passed, mpeBand: "initial", conditions: out } };
}

/** 4.5.2 / A.4.2.3 zero-setting or 4.6.3 / A.4.6.2 tare setting: each |E0| ≤ 0.25e. */
function markZeroSetting(payload: unknown, ctx: Ctx, tare: boolean): Outcome {
  const what = tare ? "tare setting" : "zero-setting";
  const pl = payload as { tare?: string; load?: string; trials?: Reading[] };
  const l0 = pl.load?.trim() ? dec(pl.load, `${what} load L0`) : new Decimal(0);
  const tareValue = tare ? dec(pl.tare, "tare value") : null;
  const trials = (pl.trials ?? []).filter((r) => (typeof r === "string" ? r : r?.i || r?.dL)?.trim());
  if (trials.length < 1) throw new Error(`cannot-compute: ${what} needs at least one reading at zero`);
  const result = zeroSettingResult(
    l0,
    trials.map((r, i) => p(ctx, r, `${what} #${i + 1}`)),
    ctx.e,
  );
  return {
    status: pass(result.passed),
    resultJson: {
      passed: result.passed,
      load: l0.toString(),
      tare: tareValue?.toString() ?? null,
      allowed: result.allowed.toString(),
      trials: result.trials.map((t) => ({ e0: t.e0.toString(), ok: t.ok })),
    },
  };
}

function markVoltage(payload: unknown, ctx: Ctx): Outcome {
  const rows = (payload as { rows?: Array<{ voltage?: string; load?: string; indicated?: Reading }> })?.rows;
  if (!rows || rows.length < 2) throw new Error("cannot-compute: voltage needs at least 2 readings");
  const parsed = rows.map((r, i) => ({
    voltage: dec(r.voltage, `voltage row ${i + 1} voltage`),
    load: dec(r.load, `voltage row ${i + 1} load`),
    P: p(ctx, r.indicated, `voltage row ${i + 1}`),
    raw: r.indicated,
  }));
  if (!ctx.unom) throw new Error("cannot-compute: record Unom on the instrument; voltage limits are 0.85 and 1.10 Unom (3.9.3, A.5.4.1)");
  const volts = parsed.map((r) => r.voltage.toDecimalPlaces(1).toString());
  for (const f of ["0.85", "1.1"]) {
    const v = ctx.unom.mul(f).toDecimalPlaces(1);
    if (!volts.includes(v.toString())) {
      throw new Error(`cannot-compute: no reading at ${f} Unom = ${v} V (3.9.3, A.5.4.1, AC mains)`);
    }
  }
  const tenE = ctx.e.mul(10);
  const half = ctx.Max.div(2);
  if (!parsed.some((r) => r.load.eq(tenE)) || !parsed.some((r) => r.load.gte(half) && r.load.lte(ctx.Max))) {
    throw new Error(`cannot-compute: voltage test needs loads of 10e (${tenE} g) and one in [½ Max, Max] (A.5.4)`);
  }
  const out = parsed.map((r) => {
    const mpe = mpeInitial(ctx.class_, ctx.e, r.load);
    const error = indicationError(r.P, r.load);
    return {
      voltage: r.voltage.toString(),
      load: r.load.toString(),
      ...readingJson(r.raw, r.P),
      error: error.toString(),
      mpe: mpe.toString(),
      ok: error.abs().lte(mpe),
    };
  });
  const passed = out.every((r) => r.ok);
  return { status: pass(passed), resultJson: { passed, mpeBand: "initial", rows: out } };
}

function markEndurance(payload: unknown, ctx: Ctx): Outcome {
  const pl = payload as { before?: { rows?: RowIn[] }; after?: { rows?: RowIn[] } };
  const before = weighRows(ctx, pl.before?.rows, "endurance before");
  const after = weighRows(ctx, pl.after?.rows, "endurance after");
  if (distinctLoads(before) < 5) throw new Error("cannot-compute: endurance weighing tests need at least 5 loads (A.6, A.4.4.1)");
  const result = durabilityResult(before, after, ctx.class_, ctx.e);
  return {
    status: pass(result.passed),
    resultJson: {
      passed: result.passed,
      mpeBand: "initial",
      rows: result.rows.map((r) => ({
        load: r.load.toString(),
        eBefore: r.eBefore.toString(),
        eAfter: r.eAfter.toString(),
        durability: r.durability.toString(),
        mpe: r.mpe.toString(),
        ok: r.ok,
      })),
    },
  };
}

function markWarmup(payload: unknown, ctx: Ctx): Outcome {
  const pl = payload as { load?: string; rows?: Array<{ minute?: string; zero?: Reading; loaded?: Reading }> };
  const load = dec(pl.load, "warm-up load");
  requireLoad(ctx, load, "warm-up", "max", "A.5.2");
  const rows = (pl.rows ?? []).map((r, i) => ({
    minute: Number(r.minute ?? WARMUP_MINUTES[i]),
    zero: p(ctx, r.zero, `warm-up ${WARMUP_MINUTES[i]} min zero`),
    loaded: p(ctx, r.loaded, `warm-up ${WARMUP_MINUTES[i]} min loaded`),
  }));
  if (rows.length !== WARMUP_MINUTES.length) {
    throw new Error("cannot-compute: warm-up needs zero and loaded readings at 0, 5, 15 and 30 min (A.5.2)");
  }
  const result = warmupResult(load, rows, ctx.class_, ctx.e);
  return {
    status: pass(result.passed),
    resultJson: {
      passed: result.passed,
      mpeBand: "initial",
      load: load.toString(),
      mpe: result.mpe.toString(),
      rows: result.rows.map((r) => ({
        minute: r.minute,
        e0: r.e0.toString(),
        eL: r.eL.toString(),
        diff: r.diff.toString(),
        ok: r.ok,
      })),
    },
  };
}

function markRepeatability(payload: unknown, ctx: Ctx): Outcome {
  const pl = payload as { series?: Array<{ trueLoad?: string; indications?: Reading[] }> };
  const series = pl.series ?? [];
  const perSeries = ctx.Max.lt(1000000) ? 10 : 3;
  if (series.length !== 2) {
    throw new Error("cannot-compute: repeatability needs two series, about ½ Max and close to Max (A.4.10)");
  }
  const labels = ["~½ Max", "~Max"];
  const out = series.map((s, si) => {
    const trueLoad = dec(s.trueLoad, `repeatability ${labels[si]} load`);
    requireLoad(ctx, trueLoad, `repeatability ${labels[si]}`, si === 0 ? "half" : "max", "A.4.10");
    const readings = (s.indications ?? []).filter((r) => (typeof r === "string" ? r : r?.i || r?.dL)?.trim());
    if (readings.length < perSeries) {
      throw new Error(`cannot-compute: repeatability ${labels[si]} needs ${perSeries} weighings (A.4.10)`);
    }
    const Ps = readings.map((r, i) => p(ctx, r, `repeatability ${labels[si]} #${i + 1}`));
    const r = repeatabilityResult(trueLoad, Ps, ctx.class_, ctx.e);
    return {
      label: labels[si],
      trueLoad: trueLoad.toString(),
      passed: r.passed,
      spread: r.spread.toString(),
      mpe: r.mpe.toString(),
      spreadOk: r.spreadOk,
      errorsOk: r.errorsOk,
      errors: r.errors.map((x) => x.toString()),
    };
  });
  const passed = out.every((s) => s.passed);
  return { status: pass(passed), resultJson: { passed, mpeBand: "initial", series: out } };
}

function markEccentricity(payload: unknown, ctx: Ctx, rolling: boolean): Outcome {
  const pl = payload as { trueLoad?: string; positions?: Record<string, Reading>; zero?: Reading };
  if (!pl?.positions) throw new Error("cannot-compute: eccentricity needs position readings");
  const trueLoad = dec(pl.trueLoad, "eccentricity load");
  const keys = Object.keys(pl.positions);
  if (rolling) {
    if (keys.length < 3) {
      throw new Error("cannot-compute: rolling load needs beginning, middle and end positions (A.4.7.4)");
    }
    if (trueLoad.gt(ctx.Max.mul("0.8"))) {
      throw new Error(`cannot-compute: rolling load ${trueLoad} exceeds 0.8 Max (3.6.2.4)`);
    }
  } else {
    if (keys.length !== 4 || ECC_POSITIONS.some((k) => !(k in pl.positions!))) {
      throw new Error("cannot-compute: eccentricity needs exactly corners A, B, C, D");
    }
    const targetLoad = ctx.Max.div(3);
    if (trueLoad.sub(targetLoad).abs().div(targetLoad).gt(ECC_LOAD_TOLERANCE)) {
      throw new Error(`cannot-compute: eccentricity load ${trueLoad} is not within 2% of Max/3 (${targetLoad}) (3.6.2.1)`);
    }
  }
  const Ps: Record<string, Decimal> = {};
  const readings: Record<string, object> = {};
  for (const [pos, r] of Object.entries(pl.positions)) {
    Ps[pos] = p(ctx, r, `eccentricity ${pos}`);
    readings[pos] = readingJson(r, Ps[pos]);
  }
  const hasZero = pl.zero != null && (typeof pl.zero === "string" ? pl.zero : pl.zero.i)?.trim();
  const e0 = hasZero ? indicationError(p(ctx, pl.zero, "eccentricity zero"), new Decimal(0)) : new Decimal(0);
  gateE0(ctx, e0, "eccentricity");
  const result = eccentricityResult(trueLoad, Ps, ctx.class_, ctx.e, e0);
  const errors: Record<string, string> = {};
  for (const [pos, err] of Object.entries(result.errors)) errors[pos] = err.toString();
  return {
    status: pass(result.passed),
    resultJson: {
      passed: result.passed,
      mpeBand: "initial",
      trueLoad: trueLoad.toString(),
      mpe: result.mpe.toString(),
      e0: result.e0.toString(),
      errors,
      readings,
      rolling,
    },
  };
}

function markDiscrimination(payload: unknown, ctx: Ctx): Outcome {
  const rows = (payload as { rows?: Array<{ load?: string; before?: string; after?: string; extra?: string }> })?.rows;
  if (!rows || rows.length < 3) {
    throw new Error("cannot-compute: discrimination needs three loads, e.g. Min, ½ Max and Max (A.4.8)");
  }
  const out = rows.map((r, i) => {
    const res = discriminationResult(
      dec(r.before, `discrimination row ${i + 1} I1`),
      dec(r.after, `discrimination row ${i + 1} I2`),
      dec(r.extra, `discrimination row ${i + 1} extra load`),
      ctx.e,
    );
    return {
      load: dec(r.load, `discrimination row ${i + 1} load`).toString(),
      extra: r.extra,
      change: res.change.toString(),
      requiredChange: res.requiredChange.toString(),
      extraOk: res.extraOk,
      ok: res.passed,
    };
  });
  const passed = out.every((r) => r.ok);
  return { status: pass(passed), resultJson: { passed, rows: out } };
}

function markZeroReturn(payload: unknown, ctx: Ctx): Outcome {
  const pl = payload as { before?: Reading; after?: Reading };
  const p0 = p(ctx, pl.before, "zero return P0 (before loading)");
  const p30 = p(ctx, pl.after, "zero return P30 (after 30 min load)");
  const result = zeroReturnResult(p0, p30, ctx.e);
  return {
    status: pass(result.passed),
    resultJson: { passed: result.passed, p0: p0.toString(), p30: p30.toString(), delta: result.delta.toString(), allowed: result.allowed.toString() },
  };
}

function markCreep(payload: unknown, ctx: Ctx): Outcome {
  const pl = payload as { load?: string; i0?: Reading; i15?: Reading; i30?: Reading; i240?: Reading };
  const load = dec(pl.load, "creep load");
  requireLoad(ctx, load, "creep", "max", "A.4.11.1");
  const has240 = pl.i240 != null && (typeof pl.i240 === "string" ? pl.i240 : pl.i240.i)?.trim();
  const result = creepResult(
    load,
    p(ctx, pl.i0, "creep 0 min"),
    p(ctx, pl.i15, "creep 15 min"),
    p(ctx, pl.i30, "creep 30 min"),
    ctx.class_,
    ctx.e,
    has240 ? p(ctx, pl.i240, "creep 4 h") : null,
  );
  if (result.needsFourHours) {
    return cannotCompute(
      `cannot-compute: creep 30-min early stop not met (change ${result.d30} g vs 0.5e = ${result.allow30} g, 15→30 min ${result.d15} g vs 0.2e = ${result.allow15} g); continue to 4 h and enter the reading furthest from the first (3.9.4.1)`,
    );
  }
  return {
    status: pass(result.passed),
    resultJson: {
      passed: result.passed,
      mpeBand: "initial",
      load: load.toString(),
      earlyOk: result.earlyOk,
      d30: result.d30.toString(),
      d15: result.d15.toString(),
      allow30: result.allow30.toString(),
      allow15: result.allow15.toString(),
      d240: result.d240?.toString() ?? null,
      mpe: result.mpe.toString(),
    },
  };
}

function markStability(payload: unknown, ctx: Ctx): Outcome {
  const trials = (payload as { trials?: Array<{ printed?: string; min?: string; max?: string }> })?.trials;
  if (!trials || trials.length < 5) {
    throw new Error("cannot-compute: stability of equilibrium needs 5 trials (A.4.12)");
  }
  const result = stabilityResult(
    trials.map((t, i) => ({
      printed: dec(t.printed, `stability trial ${i + 1} printed value`),
      min: dec(t.min, `stability trial ${i + 1} min`),
      max: dec(t.max, `stability trial ${i + 1} max`),
    })),
    ctx.e,
  );
  return {
    status: pass(result.passed),
    resultJson: {
      passed: result.passed,
      allowed: result.allowed.toString(),
      trials: result.trials.map((t) => ({ deviation: t.deviation.toString(), ok: t.ok })),
    },
  };
}

const TILT_DIRECTIONS = ["forward", "backward", "left", "right"];

function markTilt(payload: unknown, ctx: Ctx): Outcome {
  type Pos = { ref?: Reading; tilts?: Reading[] };
  const pl = payload as { noLoad?: Pos; loads?: Array<Pos & { load?: string }> };
  const tilts = (pos: Pos | undefined, what: string) => {
    const t = pos?.tilts ?? [];
    if (t.length !== TILT_DIRECTIONS.length) {
      throw new Error(`cannot-compute: ${what} needs readings tilted forward, backward, left and right (A.5.1)`);
    }
    return t.map((r, i) => p(ctx, r, `${what} ${TILT_DIRECTIONS[i]}`));
  };
  const loads = (pl.loads ?? []).map((l, i) => ({
    load: dec(l.load, `tilt load ${i + 1}`),
    ref: p(ctx, l.ref, `tilt load ${i + 1} reference`),
    tilts: tilts(l, `tilt load ${i + 1}`),
  }));
  if (loads.length < 2 || !loads.some((l) => l.load.div(ctx.Max).gte(CLOSE_TO_MAX))) {
    throw new Error("cannot-compute: tilt needs two loads, near the lowest MPE change and near Max (A.5.1.1.2)");
  }
  const result = tiltResult(p(ctx, pl.noLoad?.ref, "tilt no-load reference"), tilts(pl.noLoad, "tilt no-load"), loads, ctx.class_, ctx.e);
  return {
    status: pass(result.passed),
    resultJson: {
      passed: result.passed,
      mpeBand: "initial",
      directions: TILT_DIRECTIONS,
      noLoadApplies: result.noLoadApplies,
      noLoadOk: result.noLoadOk,
      noLoadDelta: result.noLoadDelta.toString(),
      noLoadAllowed: ctx.e.mul(2).toString(),
      loads: result.loads.map((l) => ({ load: l.load.toString(), diff: l.diff.toString(), mpe: l.mpe.toString(), ok: l.ok })),
    },
  };
}

function markTempNoLoad(payload: unknown, ctx: Ctx): Outcome {
  const readings = (payload as { readings?: Array<{ tempC?: string; zero?: Reading }> })?.readings;
  if (!readings || readings.length < 2) throw new Error("cannot-compute: temperature no-load needs at least 2 temperatures");
  const result = tempNoLoadResult(
    readings.map((r, i) => ({ tempC: dec(r.tempC, `temperature ${i + 1}`), zero: p(ctx, r.zero, `zero at temperature ${i + 1}`) })),
    ctx.class_,
    ctx.e,
  );
  return {
    status: pass(result.passed),
    resultJson: {
      passed: result.passed,
      step: ctx.class_ === "I" ? "1" : "5",
      pairs: result.pairs.map((x) => ({
        dT: x.dT.toString(),
        dZero: x.dZero.toString(),
        perStep: x.perStep.toString(),
        allowed: x.allowed.toString(),
        ok: x.ok,
      })),
    },
  };
}

function markSpan(payload: unknown, ctx: Ctx): Outcome {
  const pl = payload as { load?: string; indications?: Reading[] };
  const load = dec(pl.load, "span stability load");
  requireLoad(ctx, load, "span stability", "max", "B.4");
  const readings = (pl.indications ?? []).filter((r) => (typeof r === "string" ? r : r?.i || r?.dL)?.trim());
  if (readings.length < 8) throw new Error("cannot-compute: span stability needs at least 8 measurements (B.4)");
  const result = spanStabilityResult(
    load,
    readings.map((r, i) => p(ctx, r, `span stability #${i + 1}`)),
    ctx.class_,
    ctx.e,
  );
  return {
    status: pass(result.passed),
    resultJson: {
      passed: result.passed,
      mpeBand: "initial",
      load: load.toString(),
      errorsOk: result.errorsOk,
      spread: result.spread.toString(),
      allowed: result.allowed.toString(),
      mpe: result.mpe.toString(),
      errors: result.errors.map((x) => x.toString()),
    },
  };
}

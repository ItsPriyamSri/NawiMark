/**
 * markEvaluation: the one place payloadJson becomes resultJson. Never fakes
 * a PASS — an invalid instrument, out-of-band env, or incomplete payload
 * marks the affected procedures CANNOT_COMPUTE instead of guessing.
 */
import { Prisma } from "@prisma/client";
import { Decimal } from "decimal.js";
import type { AccuracyClass } from "@/engine/r76";
import {
  creepResult,
  discriminationResult,
  eccentricityResult,
  repeatabilityResult,
  spanStabilityResult,
  stabilityResult,
  tempNoLoadResult,
  tiltResult,
  validateInstrument,
  weighingPerformanceResult,
  zeroReturnResult,
} from "@/engine/r76";
import { PACK_ID, PACK_MARKS, RH_MAX, RH_MIN, TEMP_MAX, TEMP_MIN } from "@/engine/pack";
import { db } from "@/lib/db";

const ECC_POSITIONS = ["A", "B", "C", "D"] as const;
const ECC_LOAD_TOLERANCE = new Decimal("0.02"); // 2% of Max/3

type Outcome = { status: "MARKED_PASS" | "MARKED_FAIL" | "CANNOT_COMPUTE"; resultJson: object };

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

export async function markEvaluation(evaluationId: string) {
  const evaluation = await db.evaluation.findUniqueOrThrow({
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
  if (!instrumentReason) {
    const temp = finiteNumber(evaluation.tempC);
    const rh = finiteNumber(evaluation.rhPct);
    if (temp === null || rh === null) {
      envReason = "cannot-compute: lab temperature/humidity not entered or not a number";
    } else if (temp < TEMP_MIN || temp > TEMP_MAX) {
      envReason = `cannot-compute: temperature ${temp}°C outside pack band [${TEMP_MIN}, ${TEMP_MAX}]`;
    } else if (rh < RH_MIN || rh > RH_MAX) {
      envReason = `cannot-compute: RH ${rh}% outside pack band [${RH_MIN}, ${RH_MAX}]`;
    }
  }

  const blockedReason = instrumentReason ?? envReason;

  await db.$transaction(async (tx) => {
    await tx.evaluation.update({ where: { id: evaluationId }, data: { packId: PACK_ID } });
    for (const proc of procedures) {
      if (!(PACK_MARKS as readonly string[]).includes(proc.key)) continue;

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

      const outcome = markOne(proc.key, proc.payloadJson, class_!, e!, new Decimal(instrument.maxG));
      await tx.procedure.update({
        where: { id: proc.id },
        data: { status: outcome.status, resultJson: outcome.resultJson, markedByPack: PACK_ID },
      });
    }
  });

  return db.evaluation.findUniqueOrThrow({
    where: { id: evaluationId },
    include: { instrument: true, procedures: true },
  });
}

function markOne(key: string, payload: unknown, class_: AccuracyClass, e: Decimal, Max: Decimal): Outcome {
  try {
    switch (key) {
      case "WEIGHING":
      case "TARE":
      case "DAMP_HEAT":
        return markWeighing(payload, class_, e, key);
      case "VOLTAGE":
        return markVoltage(payload, class_, e);
      case "ENDURANCE":
        return markEndurance(payload, class_, e);
      case "WARMUP":
        return markWarmup(payload, class_, e);
      case "REPEATABILITY":
        return markRepeatability(payload, class_, e);
      case "ECCENTRICITY":
        return markEccentricity(payload, class_, e, Max, false);
      case "ROLLING_ECC":
        return markEccentricity(payload, class_, e, Max, true);
      case "DISCRIMINATION":
      case "SENSITIVITY":
        return markDiscrimination(payload, e);
      case "ZERO_RETURN":
        return markZeroReturn(payload, e);
      case "CREEP":
        return markCreep(payload, class_, e);
      case "STABILITY":
        return markStability(payload, e);
      case "TILT":
        return markTilt(payload, class_, e);
      case "TEMP_NOLOAD":
        return markTempNoLoad(payload, class_, e);
      case "SPAN_STABILITY":
        return markSpan(payload, Max, e);
      default:
        throw new Error(`cannot-compute: ${key} is not in ${PACK_ID}`);
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : "cannot-compute: unknown error";
    return { status: "CANNOT_COMPUTE", resultJson: { reason } };
  }
}

function parseWeighingRows(payload: unknown, min = 2) {
  const rows = (payload as { rows?: Array<{ load: string; indicated: string; direction?: "up" | "down" }> })?.rows;
  if (!rows || rows.length < min) {
    throw new Error(`cannot-compute: needs at least ${min} load/indication rows`);
  }
  return rows.map((r, i) => ({
    load: new Decimal(r.load),
    indicated: new Decimal(r.indicated),
    direction: r.direction ?? (i === 0 ? ("up" as const) : ("down" as const)),
  }));
}

function markWeighing(payload: unknown, class_: AccuracyClass, e: Decimal, key: string): Outcome {
  const result = weighingPerformanceResult(parseWeighingRows(payload), class_, e);
  return {
    status: result.passed ? "MARKED_PASS" : "MARKED_FAIL",
    resultJson: {
      passed: result.passed,
      kind: key,
      mpeBand: "initial",
      rows: result.rows.map((r) => ({
        load: r.load.toString(),
        indicated: r.indicated.toString(),
        direction: r.direction,
        error: r.error.toString(),
        mpe: r.mpe.toString(),
        ok: r.ok,
      })),
    },
  };
}

function markVoltage(payload: unknown, class_: AccuracyClass, e: Decimal): Outcome {
  const rows = (payload as { rows?: Array<{ voltage: string; load: string; indicated: string }> })?.rows;
  if (!rows || rows.length < 2) throw new Error("cannot-compute: voltage needs at least 2 points");
  const result = weighingPerformanceResult(
    rows.map((r) => ({ load: new Decimal(r.load), indicated: new Decimal(r.indicated), direction: "up" as const })),
    class_,
    e,
  );
  return {
    status: result.passed ? "MARKED_PASS" : "MARKED_FAIL",
    resultJson: {
      passed: result.passed,
      mpeBand: "initial",
      rows: result.rows.map((r, i) => ({
        voltage: rows[i].voltage,
        load: r.load.toString(),
        indicated: r.indicated.toString(),
        error: r.error.toString(),
        mpe: r.mpe.toString(),
        ok: r.ok,
      })),
    },
  };
}

function markEndurance(payload: unknown, class_: AccuracyClass, e: Decimal): Outcome {
  const p = payload as { before?: unknown; after?: unknown };
  const before = markWeighing({ rows: (p.before as { rows?: unknown })?.rows ?? p.before }, class_, e, "ENDURANCE");
  const after = markWeighing({ rows: (p.after as { rows?: unknown })?.rows ?? p.after }, class_, e, "ENDURANCE");
  const passed = before.status === "MARKED_PASS" && after.status === "MARKED_PASS";
  return {
    status: passed ? "MARKED_PASS" : before.status === "CANNOT_COMPUTE" || after.status === "CANNOT_COMPUTE" ? "CANNOT_COMPUTE" : "MARKED_FAIL",
    resultJson: { passed, mpeBand: "initial", before: before.resultJson, after: after.resultJson },
  };
}

function markWarmup(payload: unknown, class_: AccuracyClass, e: Decimal): Outcome {
  const p = payload as { zeros?: string[]; load?: string; indicated?: string[] };
  if (!p.zeros || p.zeros.length < 2) throw new Error("cannot-compute: warm-up needs at least 2 zero readings");
  const zeros = p.zeros.map((z) => new Decimal(z));
  const zeroSpread = Decimal.max(...zeros).sub(Decimal.min(...zeros));
  const zeroOk = zeroSpread.lte(e);
  let loadedOk = true;
  let loaded: object | null = null;
  if (p.load && p.indicated && p.indicated.length > 0) {
    const result = weighingPerformanceResult(
      p.indicated.map((i) => ({ load: new Decimal(p.load!), indicated: new Decimal(i), direction: "up" as const })),
      class_,
      e,
    );
    loadedOk = result.passed;
    loaded = {
      load: p.load,
      rows: result.rows.map((r) => ({ indicated: r.indicated.toString(), error: r.error.toString(), mpe: r.mpe.toString(), ok: r.ok })),
    };
  }
  const passed = zeroOk && loadedOk;
  return {
    status: passed ? "MARKED_PASS" : "MARKED_FAIL",
    resultJson: { passed, mpeBand: "initial", zeroSpread: zeroSpread.toString(), allowedZero: e.toString(), zeroOk, loaded },
  };
}

function markRepeatability(payload: unknown, class_: AccuracyClass, e: Decimal): Outcome {
  const p = payload as { trueLoad?: string; indications?: string[] };
  if (!p?.trueLoad || !p.indications || p.indications.length < 3) {
    throw new Error("cannot-compute: repeatability needs a true load and at least 3 indications");
  }
  const result = repeatabilityResult(
    new Decimal(p.trueLoad),
    p.indications.map((i) => new Decimal(i)),
    class_,
    e,
  );
  return {
    status: result.passed ? "MARKED_PASS" : "MARKED_FAIL",
    resultJson: {
      passed: result.passed,
      mpeBand: "initial",
      trueLoad: p.trueLoad,
      spread: result.spread.toString(),
      mpe: result.mpe.toString(),
      spreadOk: result.spreadOk,
      errorsOk: result.errorsOk,
      errors: result.errors.map((err) => err.toString()),
    },
  };
}

function markEccentricity(payload: unknown, class_: AccuracyClass, e: Decimal, Max: Decimal, rolling: boolean): Outcome {
  const p = payload as { trueLoad?: string; positions?: Record<string, string> };
  if (!p?.trueLoad || !p.positions) {
    throw new Error("cannot-compute: eccentricity needs a true load and position readings");
  }
  const keys = Object.keys(p.positions);
  if (rolling) {
    if (keys.length < 4) throw new Error("cannot-compute: rolling-load eccentricity needs at least 4 positions");
  } else if (keys.length !== 4 || ECC_POSITIONS.some((k) => !(k in p.positions!))) {
    throw new Error("cannot-compute: eccentricity needs exactly corners A, B, C, D");
  }
  const trueLoad = new Decimal(p.trueLoad);
  if (!rolling) {
    const targetLoad = Max.div(3);
    const drift = trueLoad.sub(targetLoad).abs().div(targetLoad);
    if (drift.gt(ECC_LOAD_TOLERANCE)) {
      throw new Error(`cannot-compute: eccentricity load ${trueLoad} is not within 2% of Max/3 (${targetLoad})`);
    }
  }
  const indicationsByPosition: Record<string, Decimal> = {};
  for (const [pos, v] of Object.entries(p.positions)) indicationsByPosition[pos] = new Decimal(v);
  const result = eccentricityResult(trueLoad, indicationsByPosition, class_, e);
  const errors: Record<string, string> = {};
  for (const [pos, err] of Object.entries(result.errors)) errors[pos] = err.toString();
  return {
    status: result.passed ? "MARKED_PASS" : "MARKED_FAIL",
    resultJson: { passed: result.passed, mpeBand: "initial", trueLoad: p.trueLoad, mpe: result.mpe.toString(), errors, rolling },
  };
}

function markDiscrimination(payload: unknown, e: Decimal): Outcome {
  const p = payload as { indicatedBefore?: string; indicatedAfter?: string; extraLoad?: string };
  if (!p.indicatedBefore || !p.indicatedAfter || !p.extraLoad) {
    throw new Error("cannot-compute: discrimination/sensitivity needs before, after, and extra load");
  }
  const result = discriminationResult(new Decimal(p.indicatedBefore), new Decimal(p.indicatedAfter), new Decimal(p.extraLoad), e);
  return {
    status: result.passed ? "MARKED_PASS" : "MARKED_FAIL",
    resultJson: {
      passed: result.passed,
      change: result.change.toString(),
      requiredChange: result.requiredChange.toString(),
      extraOk: result.extraOk,
      extraLoad: p.extraLoad,
    },
  };
}

function markZeroReturn(payload: unknown, e: Decimal): Outcome {
  const p = payload as { residual?: string };
  if (p.residual == null || p.residual === "") throw new Error("cannot-compute: zero-return needs residual indication");
  const result = zeroReturnResult(new Decimal(p.residual), e);
  return {
    status: result.passed ? "MARKED_PASS" : "MARKED_FAIL",
    resultJson: { passed: result.passed, residual: result.residual.toString(), allowed: result.allowed.toString() },
  };
}

function markCreep(payload: unknown, class_: AccuracyClass, e: Decimal): Outcome {
  const p = payload as { load?: string; i0?: string; i15?: string; i30?: string };
  if (!p.load || !p.i0 || !p.i15 || !p.i30) throw new Error("cannot-compute: creep needs load and I at 0/15/30 min");
  const result = creepResult(new Decimal(p.load), new Decimal(p.i0), new Decimal(p.i15), new Decimal(p.i30), class_, e);
  return {
    status: result.passed ? "MARKED_PASS" : "MARKED_FAIL",
    resultJson: {
      passed: result.passed,
      mpeBand: "initial",
      d30: result.d30.toString(),
      d15: result.d15.toString(),
      allow30: result.allow30.toString(),
      allow15: result.allow15.toString(),
      mpe: result.mpe.toString(),
    },
  };
}

function markStability(payload: unknown, e: Decimal): Outcome {
  const p = payload as { i1?: string; i2?: string };
  if (!p.i1 || !p.i2) throw new Error("cannot-compute: stability needs two consecutive indications");
  const result = stabilityResult(new Decimal(p.i1), new Decimal(p.i2), e);
  return {
    status: result.passed ? "MARKED_PASS" : "MARKED_FAIL",
    resultJson: { passed: result.passed, delta: result.delta.toString(), allowed: result.allowed.toString() },
  };
}

function markTilt(payload: unknown, class_: AccuracyClass, e: Decimal): Outcome {
  const p = payload as {
    noLoadLevel?: string;
    noLoadTilt?: string;
    load?: string;
    indicatedTilt?: string;
  };
  if (!p.noLoadLevel || !p.noLoadTilt || !p.load || !p.indicatedTilt) {
    throw new Error("cannot-compute: tilt needs no-load level/tilt and a loaded tilt indication");
  }
  const result = tiltResult(
    new Decimal(p.noLoadLevel),
    new Decimal(p.noLoadTilt),
    new Decimal(p.load),
    new Decimal(p.indicatedTilt),
    class_,
    e,
  );
  return {
    status: result.passed ? "MARKED_PASS" : "MARKED_FAIL",
    resultJson: {
      passed: result.passed,
      mpeBand: "initial",
      noLoadOk: result.noLoadOk,
      loadedOk: result.loadedOk,
      noLoadDelta: result.noLoadDelta.toString(),
      error: result.error.toString(),
      mpe: result.mpe.toString(),
    },
  };
}

function markTempNoLoad(payload: unknown, class_: AccuracyClass, e: Decimal): Outcome {
  const readings = (payload as { readings?: Array<{ tempC: string; zero: string }> })?.readings;
  if (!readings || readings.length < 2) throw new Error("cannot-compute: temperature no-load needs at least 2 points");
  const result = tempNoLoadResult(
    readings.map((r) => ({ tempC: new Decimal(r.tempC), zero: new Decimal(r.zero) })),
    class_,
    e,
  );
  return {
    status: result.passed ? "MARKED_PASS" : "MARKED_FAIL",
    resultJson: {
      passed: result.passed,
      pairs: result.pairs.map((p) => ({
        dT: p.dT.toString(),
        dZero: p.dZero.toString(),
        allowed: p.allowed.toString(),
        ok: p.ok,
      })),
    },
  };
}

function markSpan(payload: unknown, Max: Decimal, e: Decimal): Outcome {
  const indications = (payload as { indications?: string[] })?.indications;
  if (!indications || indications.length < 2) throw new Error("cannot-compute: span-stability needs at least 2 Max indications");
  const result = spanStabilityResult(
    indications.map((i) => new Decimal(i)),
    Max,
    e,
  );
  return {
    status: result.passed ? "MARKED_PASS" : "MARKED_FAIL",
    resultJson: {
      passed: result.passed,
      spread: result.spread.toString(),
      allowed: result.allowed.toString(),
      errors: result.errors.map((err) => err.toString()),
    },
  };
}

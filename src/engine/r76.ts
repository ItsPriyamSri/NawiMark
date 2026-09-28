/**
 * OIML R 76-1:2006 pass/fail. Every function takes P, the indication prior to
 * rounding (A.4.4.3: P = I + ½e − ΔL), never a rounded display value — the
 * caller turns I and ΔL into P with priorToRounding(). Masses in one unit (g).
 * Type evaluation uses Table 6 initial MPE, never 3.5.2 in-service (2×).
 * Core MPE / repeatability / eccentricity / Table 3 mirror engine/r76.py.
 *
 * ponytail: single-interval, single-range instruments only (no e1/ei rules);
 * d = e assumed.
 */
import { Decimal } from "decimal.js";

export type AccuracyClass = "I" | "II" | "III" | "IIII";

function d(x: unknown): Decimal {
  if (typeof x === "number") {
    throw new TypeError("float is inexact; pass Decimal, string, or bigint");
  }
  if (x instanceof Decimal) return x;
  if (typeof x === "string" || typeof x === "bigint") {
    return new Decimal(typeof x === "bigint" ? x.toString() : x);
  }
  throw new TypeError("expected Decimal, string, or bigint");
}

// 3.5.1 Table 6 initial verification. (m_max inclusive in e, |MPE| in e).
// Class I last band unbounded. Ex (not held-out): II, e=1 g, 4000 g -> 0.5e.
export const TABLE6: Record<AccuracyClass, Array<[number | null, Decimal]>> = {
  I: [
    [50000, new Decimal("0.5")],
    [200000, new Decimal("1.0")],
    [null, new Decimal("1.5")],
  ],
  II: [
    [5000, new Decimal("0.5")],
    [20000, new Decimal("1.0")],
    [100000, new Decimal("1.5")],
  ],
  III: [
    [500, new Decimal("0.5")],
    [2000, new Decimal("1.0")],
    [10000, new Decimal("1.5")],
  ],
  IIII: [
    [50, new Decimal("0.5")],
    [200, new Decimal("1.0")],
    [1000, new Decimal("1.5")],
  ],
};

// Table 3 rows: [e from (g), e to (g) | null, n min, n max | null, Min lower limit in e].
// ponytail: the 3.4.4 class I exception (e < 1 mg) is not modelled.
const TABLE3: Record<AccuracyClass, Array<[string, string | null, number, number | null, number]>> = {
  I: [["0.001", null, 50000, null, 100]],
  II: [
    ["0.001", "0.05", 100, 100000, 20],
    ["0.1", null, 5000, 100000, 50],
  ],
  III: [
    ["0.1", "2", 100, 10000, 20],
    ["5", null, 500, 10000, 20],
  ],
  IIII: [["5", null, 100, 1000, 10]],
};

function table3Row(class_: AccuracyClass, e: Decimal) {
  const row = TABLE3[class_]?.find(([lo, hi]) => e.gte(lo) && (hi === null || e.lte(hi)));
  if (!row) throw new Error(`cannot-compute: e=${e} g is not allowed for class ${class_} (R-76 Table 3)`);
  return row;
}

/** Table 3 minimum capacity lower limit, in mass units. */
export function minCapacityLowerLimit(class_: AccuracyClass, e: Decimal): Decimal {
  return d(e).mul(table3Row(class_, d(e))[4]);
}

/** Absolute MPE in mass units. R 76-1 3.5.1 Table 6 (initial / type eval). */
export function mpeInitial(class_: AccuracyClass, e: Decimal, load: Decimal): Decimal {
  const eD = d(e);
  const loadD = d(load);
  const bands = TABLE6[class_];
  if (!bands || eD.lte(0) || loadD.lt(0)) {
    throw new Error("cannot-compute: bad class/e/load");
  }
  const mE = loadD.div(eD);
  for (const [cap, mpeE] of bands) {
    if (cap === null || mE.lte(cap)) {
      return mpeE.mul(eD);
    }
  }
  throw new Error("cannot-compute: load above Table 6 for class");
}

/** 3.5.2 in-service / shop verification = 2× Table 6 initial. Demo contrast only. */
export function mpeInService(class_: AccuracyClass, e: Decimal, load: Decimal): Decimal {
  return mpeInitial(class_, e, load).mul(2);
}

/**
 * A.4.4.3 changeover-point method: P = I + ½e − ΔL, ΔL in [0, e].
 * ΔL null means the reading was taken at a resolution ≤ 0.2e, so 3.5.3.2 needs
 * no rounding elimination and P = I.
 */
export function priorToRounding(indicated: Decimal, dL: Decimal | null, e: Decimal): Decimal {
  const eD = d(e);
  if (dL === null) return d(indicated);
  const add = d(dL);
  if (add.lt(0) || add.gt(eD)) {
    throw new Error(`cannot-compute: ΔL ${add} outside [0, e=${eD}] (A.4.4.3)`);
  }
  return d(indicated).add(eD.div(2)).sub(add);
}

/** E = P − L. */
export function indicationError(p: Decimal, trueLoad: Decimal): Decimal {
  return d(p).sub(d(trueLoad));
}

/** 3.6.1: max−min of P vs |MPE|. 3.6: each |E| vs MPE. */
export function repeatabilityResult(
  trueLoad: Decimal,
  indications: Decimal[],
  class_: AccuracyClass,
  e: Decimal,
): {
  passed: boolean;
  spread: Decimal;
  mpe: Decimal;
  spreadOk: boolean;
  errorsOk: boolean;
  errors: Decimal[];
} {
  const inds = indications.map((i) => d(i));
  const mpe = mpeInitial(class_, e, trueLoad);
  const spread = Decimal.max(...inds).sub(Decimal.min(...inds));
  const errors = inds.map((i) => indicationError(i, trueLoad));
  const spreadOk = spread.lte(mpe);
  const errorsOk = errors.every((err) => err.abs().lte(mpe));
  return {
    passed: spreadOk && errorsOk,
    spread,
    mpe,
    spreadOk,
    errorsOk,
    errors,
  };
}

/** 3.6.2 / A.4.7: each position Ec = P − L − E0 vs MPE at the test load. */
export function eccentricityResult(
  trueLoad: Decimal,
  indicationsByPosition: Record<string, Decimal>,
  class_: AccuracyClass,
  e: Decimal,
  e0: Decimal = new Decimal(0),
): { passed: boolean; mpe: Decimal; errors: Record<string, Decimal>; e0: Decimal } {
  const mpe = mpeInitial(class_, e, trueLoad);
  const errors: Record<string, Decimal> = {};
  for (const [p, i] of Object.entries(indicationsByPosition)) {
    errors[p] = indicationError(i, trueLoad).sub(d(e0));
  }
  const passed = Object.values(errors).every((err) => err.abs().lte(mpe));
  return { passed, mpe, errors, e0: d(e0) };
}

/** Return n=Max/e. Throw cannot-compute if the class/e/n row of Table 3 fails. */
export function validateInstrument(class_: AccuracyClass, Max: Decimal, e: Decimal): number {
  const maxD = d(Max);
  const eD = d(e);
  if (!(class_ in TABLE3) || eD.lte(0) || maxD.lte(0)) {
    throw new Error("cannot-compute: bad class/Max/e");
  }
  const nDec = maxD.div(eD);
  if (!nDec.isInteger()) {
    throw new Error("cannot-compute: n=Max/e is not an integer");
  }
  const n = nDec.toNumber();
  const [, , lo, hi] = table3Row(class_, eD);
  if (n < lo || (hi !== null && n > hi)) {
    const span = hi !== null ? `${lo}–${hi}` : `≥${lo}`;
    throw new Error(`cannot-compute: class ${class_} n=${n} outside ${span} (R-76 Table 3)`);
  }
  return n;
}

export interface WeighingRow {
  load: Decimal;
  indicated: Decimal; // P
  direction: "up" | "down";
}

/**
 * A.4.4.1 weighing test. E0 = error of the first no-load row (0 if none);
 * each row Ec = E − E0 vs its own load's MPE (R 76-2 weighing form).
 */
export function weighingPerformanceResult(
  rows: WeighingRow[],
  class_: AccuracyClass,
  e: Decimal,
): {
  passed: boolean;
  e0: Decimal;
  rows: Array<WeighingRow & { error: Decimal; corrected: Decimal; mpe: Decimal; ok: boolean }>;
} {
  const zero = rows.find((r) => d(r.load).isZero());
  const e0 = zero ? indicationError(zero.indicated, zero.load) : new Decimal(0);
  const out = rows.map((row) => {
    const mpe = mpeInitial(class_, e, row.load);
    const error = indicationError(row.indicated, row.load);
    const corrected = error.sub(e0);
    return { ...row, error, corrected, mpe, ok: corrected.abs().lte(mpe) };
  });
  return { passed: out.every((r) => r.ok), e0, rows: out };
}

/**
 * Digital discrimination 3.8.2.2 / A.4.8.2: after stepping back to I − d and
 * adding 1/10 d, an extra 1.4d must raise the indication by at least d
 * (R 76-2 4.1.1: I2 − I1 ≥ d). ponytail: d = e.
 */
export function discriminationResult(
  indicatedBefore: Decimal,
  indicatedAfter: Decimal,
  extraLoad: Decimal,
  e: Decimal,
): { passed: boolean; change: Decimal; requiredChange: Decimal; extraOk: boolean } {
  const eD = d(e);
  const extra = d(extraLoad);
  const change = d(indicatedAfter).sub(d(indicatedBefore));
  const extraOk = extra.eq(eD.mul("1.4"));
  return { passed: extraOk && change.gte(eD), change, requiredChange: eD, extraOk };
}

/** 3.9.4.2 / A.4.11.2: |P30 − P0| ≤ 0.5e, zero before vs after 30 min near Max. */
export function zeroReturnResult(
  p0: Decimal,
  p30: Decimal,
  e: Decimal,
): { passed: boolean; delta: Decimal; allowed: Decimal } {
  const allowed = d(e).mul("0.5");
  const delta = d(p30).sub(d(p0)).abs();
  return { passed: delta.lte(allowed), delta, allowed };
}

/**
 * 3.9.4.1 / A.4.11.1 creep. Early stop at 30 min: change from first reading ≤ 0.5e
 * and 15→30 min change ≤ 0.2e (e, not MPE). Otherwise the test runs 4 h and the
 * change from the first reading must stay ≤ |MPE| at the load. `i240` is the
 * reading furthest from i0 during those 4 h; null = not run yet.
 * ponytail: 30-min change is sampled at 15 and 30 min only, not continuously.
 */
export function creepResult(
  load: Decimal,
  i0: Decimal,
  i15: Decimal,
  i30: Decimal,
  class_: AccuracyClass,
  e: Decimal,
  i240: Decimal | null = null,
): {
  passed: boolean;
  earlyOk: boolean;
  needsFourHours: boolean;
  d30: Decimal;
  d15: Decimal;
  allow30: Decimal;
  allow15: Decimal;
  d240: Decimal | null;
  mpe: Decimal;
} {
  const eD = d(e);
  const mpe = mpeInitial(class_, eD, load);
  const first = d(i0);
  const d30 = Decimal.max(d(i15).sub(first).abs(), d(i30).sub(first).abs());
  const d15 = d(i30).sub(d(i15)).abs();
  const allow30 = eD.mul("0.5");
  const allow15 = eD.mul("0.2");
  const earlyOk = d30.lte(allow30) && d15.lte(allow15);
  const d240 = !earlyOk && i240 !== null ? d(i240).sub(first).abs() : null;
  const passed = earlyOk || (d240 !== null && d240.lte(mpe));
  return { passed, earlyOk, needsFourHours: !earlyOk && d240 === null, d30, d15, allow30, allow15, d240, mpe };
}

/**
 * 4.4.2 / A.4.12 stable equilibrium (printing/storage): the first printed value
 * and the readings during the next 5 s span at most two adjacent values, i.e.
 * printed, min and max all within 1e of each other.
 */
export function stabilityResult(
  trials: Array<{ printed: Decimal; min: Decimal; max: Decimal }>,
  e: Decimal,
): { passed: boolean; allowed: Decimal; trials: Array<{ deviation: Decimal; ok: boolean }> } {
  const allowed = d(e);
  const out = trials.map((t) => {
    const vals = [d(t.printed), d(t.min), d(t.max)];
    const deviation = Decimal.max(...vals).sub(Decimal.min(...vals));
    return { deviation, ok: deviation.lte(allowed) };
  });
  return { passed: out.every((t) => t.ok), allowed, trials: out };
}

/**
 * 4.5.2 / A.4.2.3 zero-setting and 4.6.3 / A.4.6.2 tare-setting accuracy:
 * each error at zero after setting, |E0| = |P − L0|, ≤ 0.25e (electronic).
 */
export function zeroSettingResult(
  l0: Decimal,
  trials: Decimal[],
  e: Decimal,
): { passed: boolean; allowed: Decimal; trials: Array<{ e0: Decimal; ok: boolean }> } {
  const allowed = d(e).mul("0.25");
  const out = trials.map((p) => {
    const e0 = indicationError(p, l0);
    return { e0, ok: e0.abs().lte(allowed) };
  });
  return { passed: out.every((t) => t.ok), allowed, trials: out };
}

/**
 * 3.9.1.1 / A.5.1 tilt, each tilted direction against the reference position.
 * No load: |P_tilt − P_ref| ≤ 2e, not applied to class II. Loaded, zero set in
 * each position: |P_tilt − P_ref| ≤ MPE.
 */
export function tiltResult(
  noLoadRef: Decimal,
  noLoadTilts: Decimal[],
  loads: Array<{ load: Decimal; ref: Decimal; tilts: Decimal[] }>,
  class_: AccuracyClass,
  e: Decimal,
): {
  passed: boolean;
  noLoadOk: boolean;
  noLoadApplies: boolean;
  noLoadDelta: Decimal;
  loads: Array<{ load: Decimal; diff: Decimal; mpe: Decimal; ok: boolean }>;
} {
  const worstDiff = (ref: Decimal, tilts: Decimal[]) => Decimal.max(...tilts.map((t) => d(t).sub(d(ref)).abs()));
  const noLoadDelta = worstDiff(noLoadRef, noLoadTilts);
  const noLoadApplies = class_ !== "II";
  const noLoadOk = !noLoadApplies || noLoadDelta.lte(d(e).mul(2));
  const out = loads.map((l) => {
    const mpe = mpeInitial(class_, e, l.load);
    const diff = worstDiff(l.ref, l.tilts);
    return { load: d(l.load), diff, mpe, ok: diff.lte(mpe) };
  });
  return { passed: noLoadOk && out.every((l) => l.ok), noLoadOk, noLoadApplies, noLoadDelta, loads: out };
}

/** 5.3.5 / A.5.2 warm-up: at 0, 5, 15, 30 min, |EL − E0| ≤ |MPE| at the load near Max. */
export function warmupResult(
  load: Decimal,
  rows: Array<{ minute: number; zero: Decimal; loaded: Decimal }>,
  class_: AccuracyClass,
  e: Decimal,
): { passed: boolean; mpe: Decimal; rows: Array<{ minute: number; e0: Decimal; eL: Decimal; diff: Decimal; ok: boolean }> } {
  const mpe = mpeInitial(class_, e, load);
  const out = rows.map((r) => {
    const e0 = d(r.zero);
    const eL = indicationError(r.loaded, load);
    const diff = eL.sub(e0);
    return { minute: r.minute, e0, eL, diff, ok: diff.abs().lte(mpe) };
  });
  return { passed: out.every((r) => r.ok), mpe, rows: out };
}

/**
 * 3.9.2.3 / A.5.3.2: zero change per 5 °C (1 °C class I) ≤ e, for each pair of
 * consecutive temperatures in test order.
 */
export function tempNoLoadResult(
  readings: Array<{ tempC: Decimal; zero: Decimal }>,
  class_: AccuracyClass,
  e: Decimal,
): { passed: boolean; pairs: Array<{ dT: Decimal; dZero: Decimal; perStep: Decimal; allowed: Decimal; ok: boolean }> } {
  if (readings.length < 2) {
    throw new Error("cannot-compute: temperature no-load needs at least 2 points");
  }
  const step = class_ === "I" ? new Decimal(1) : new Decimal(5);
  const allowed = d(e);
  const pairs = [];
  for (let i = 1; i < readings.length; i++) {
    const dT = d(readings[i].tempC).sub(d(readings[i - 1].tempC)).abs();
    if (dT.isZero()) continue;
    const dZero = d(readings[i].zero).sub(d(readings[i - 1].zero)).abs();
    const perStep = dZero.div(dT).mul(step);
    pairs.push({ dT, dZero, perStep, allowed, ok: perStep.lte(allowed) });
  }
  if (pairs.length === 0) throw new Error("cannot-compute: temperature no-load needs two different temperatures");
  return { passed: pairs.every((p) => p.ok), pairs };
}

/**
 * 5.3.3 / B.4 span stability near Max: each |E| ≤ MPE and the variation
 * (max − min of E) ≤ max(0.5e, 0.5|MPE|).
 */
export function spanStabilityResult(
  load: Decimal,
  indications: Decimal[],
  class_: AccuracyClass,
  e: Decimal,
): { passed: boolean; errorsOk: boolean; spread: Decimal; allowed: Decimal; mpe: Decimal; errors: Decimal[] } {
  if (indications.length < 2) {
    throw new Error("cannot-compute: span-stability needs at least 2 points");
  }
  const mpe = mpeInitial(class_, e, load);
  const errors = indications.map((i) => indicationError(i, load));
  const spread = Decimal.max(...errors).sub(Decimal.min(...errors));
  const allowed = Decimal.max(d(e).mul("0.5"), mpe.mul("0.5"));
  const errorsOk = errors.every((err) => err.abs().lte(mpe));
  return { passed: errorsOk && spread.lte(allowed), errorsOk, spread, allowed, mpe, errors };
}

/**
 * 3.9.4.3 / A.6 durability: weighing test before and after 100 000 loadings;
 * at each load |E_after − E_before| ≤ |MPE| (T.5.5.7 durability error).
 */
export function durabilityResult(
  before: Array<{ load: Decimal; indicated: Decimal }>,
  after: Array<{ load: Decimal; indicated: Decimal }>,
  class_: AccuracyClass,
  e: Decimal,
): { passed: boolean; rows: Array<{ load: Decimal; eBefore: Decimal; eAfter: Decimal; durability: Decimal; mpe: Decimal; ok: boolean }> } {
  if (before.length === 0 || before.length !== after.length) {
    throw new Error("cannot-compute: endurance needs the same loads before and after");
  }
  const rows = before.map((b, i) => {
    const a = after[i];
    if (!d(a.load).eq(d(b.load))) {
      throw new Error(`cannot-compute: endurance row ${i + 1} load differs before/after`);
    }
    const mpe = mpeInitial(class_, e, b.load);
    const eBefore = indicationError(b.indicated, b.load);
    const eAfter = indicationError(a.indicated, a.load);
    const durability = eAfter.sub(eBefore);
    return { load: d(b.load), eBefore, eAfter, durability, mpe, ok: durability.abs().lte(mpe) };
  });
  return { passed: rows.every((r) => r.ok), rows };
}

/**
 * OIML R 76-1 (2006) core pass/fail: Table 6 MPE, 3.6.1, 3.6.2.
 * Port of engine/r76.py — keep in sync line-for-line.
 *
 * ponytail: skip digital rounding-error elimination (3.5.3.2); d=e assumed.
 * Errors are I - L, not E = I + 0.5e - dL - L. All masses in one unit (caller).
 * Type evaluation uses Table 6 initial MPE, not 3.5.2 in-service (2x).
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

// Table 3 n=Max/e, simplified n-only (not e-split sub-rows). I: n>=50000 (tiny-d omitted).
const N_BOUNDS: Record<AccuracyClass, [number, number | null]> = {
  I: [50000, null],
  II: [100, 100000],
  III: [100, 10000],
  IIII: [100, 1000],
};

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

/** I - L. ponytail: d=e, no 3.5.3.2 change-point correction. */
export function indicationError(indicated: Decimal, trueLoad: Decimal): Decimal {
  return d(indicated).sub(d(trueLoad));
}

/** 3.6.1: max-min of indications vs |MPE|. 3.6: each |I-L| vs MPE. */
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

/** 3.6.2: each position |I-L| vs MPE. 3.6.2.1: 4-support, load ~ Max/3, tare=0. */
export function eccentricityResult(
  trueLoad: Decimal,
  indicationsByPosition: Record<string, Decimal>,
  class_: AccuracyClass,
  e: Decimal,
): { passed: boolean; mpe: Decimal; errors: Record<string, Decimal> } {
  const mpe = mpeInitial(class_, e, trueLoad);
  const errors: Record<string, Decimal> = {};
  for (const [p, i] of Object.entries(indicationsByPosition)) {
    errors[p] = indicationError(i, trueLoad);
  }
  const passed = Object.values(errors).every((err) => err.abs().lte(mpe));
  return { passed, mpe, errors };
}

/** Return n=Max/e. Throw cannot-compute if Table 3 n-bounds fail (simplified). */
export function validateInstrument(class_: AccuracyClass, Max: Decimal, e: Decimal): number {
  const maxD = d(Max);
  const eD = d(e);
  if (!(class_ in N_BOUNDS) || eD.lte(0) || maxD.lte(0)) {
    throw new Error("cannot-compute: bad class/Max/e");
  }
  const nDec = maxD.div(eD);
  if (!nDec.isInteger()) {
    throw new Error("cannot-compute: n=Max/e is not an integer");
  }
  const n = nDec.toNumber();
  const [lo, hi] = N_BOUNDS[class_];
  if (n < lo || (hi !== null && n > hi)) {
    const span = hi !== null ? `${lo}–${hi}` : `≥${lo}`;
    throw new Error(`cannot-compute: class ${class_} n=${n} outside ${span} (R-76 Table 3)`);
  }
  return n;
}

/** Weighing performance rows (not in Python oracle; each row vs its own load's MPE). */
export interface WeighingRow {
  load: Decimal;
  indicated: Decimal;
  direction: "up" | "down";
}

export function weighingPerformanceResult(
  rows: WeighingRow[],
  class_: AccuracyClass,
  e: Decimal,
): {
  passed: boolean;
  rows: Array<WeighingRow & { error: Decimal; mpe: Decimal; ok: boolean }>;
} {
  const out = rows.map((row) => {
    const mpe = mpeInitial(class_, e, row.load);
    const error = indicationError(row.indicated, row.load);
    return { ...row, error, mpe, ok: error.abs().lte(mpe) };
  });
  return { passed: out.every((r) => r.ok), rows: out };
}

/** 3.5.2 in-service / shop verification = 2× Table 6 initial. Demo contrast only. */
export function mpeInService(class_: AccuracyClass, e: Decimal, load: Decimal): Decimal {
  return mpeInitial(class_, e, load).mul(2);
}

/**
 * Digital discrimination A.4.8 / 3.8.2: add ~1.4d without shock; indication
 * must change by at least d. ponytail: d=e.
 */
export function discriminationResult(
  indicatedBefore: Decimal,
  indicatedAfter: Decimal,
  extraLoad: Decimal,
  e: Decimal,
): { passed: boolean; change: Decimal; requiredChange: Decimal; extraOk: boolean } {
  const eD = d(e);
  const extra = d(extraLoad);
  const change = d(indicatedAfter).sub(d(indicatedBefore)).abs();
  const extraOk = extra.gte(eD.mul("1.4"));
  return { passed: extraOk && change.gte(eD), change, requiredChange: eD, extraOk };
}

/** Residual after removing a load: |I| ≤ 0.5e (A.4.2.3 / 3.5.3). */
export function zeroReturnResult(residual: Decimal, e: Decimal): { passed: boolean; residual: Decimal; allowed: Decimal } {
  const allowed = d(e).mul("0.5");
  const r = d(residual);
  return { passed: r.abs().lte(allowed), residual: r, allowed };
}

/** A.4.5 creep: |I30−I0| ≤ 0.5 MPE; |I30−I15| ≤ 0.2 MPE. */
export function creepResult(
  load: Decimal,
  i0: Decimal,
  i15: Decimal,
  i30: Decimal,
  class_: AccuracyClass,
  e: Decimal,
): {
  passed: boolean;
  d30: Decimal;
  d15: Decimal;
  allow30: Decimal;
  allow15: Decimal;
  mpe: Decimal;
} {
  const mpe = mpeInitial(class_, e, load);
  const d30 = d(i30).sub(d(i0)).abs();
  const d15 = d(i30).sub(d(i15)).abs();
  const allow30 = mpe.mul("0.5");
  const allow15 = mpe.mul("0.2");
  return { passed: d30.lte(allow30) && d15.lte(allow15), d30, d15, allow30, allow15, mpe };
}

/** Stability of equilibrium: two consecutive indications differ by ≤ e. */
export function stabilityResult(i1: Decimal, i2: Decimal, e: Decimal): { passed: boolean; delta: Decimal; allowed: Decimal } {
  const delta = d(i1).sub(d(i2)).abs();
  const allowed = d(e);
  return { passed: delta.lte(allowed), delta, allowed };
}

/**
 * Tilt A.5.1 / 3.9.1.1: no-load change ≤ 2e; loaded indication vs MPE.
 */
export function tiltResult(
  noLoadLevel: Decimal,
  noLoadTilt: Decimal,
  load: Decimal,
  indicatedTilt: Decimal,
  class_: AccuracyClass,
  e: Decimal,
): { passed: boolean; noLoadOk: boolean; loadedOk: boolean; noLoadDelta: Decimal; error: Decimal; mpe: Decimal } {
  const noLoadDelta = d(noLoadTilt).sub(d(noLoadLevel)).abs();
  const noLoadOk = noLoadDelta.lte(d(e).mul(2));
  const mpe = mpeInitial(class_, e, load);
  const error = indicationError(indicatedTilt, load);
  const loadedOk = error.abs().lte(mpe);
  return { passed: noLoadOk && loadedOk, noLoadOk, loadedOk, noLoadDelta, error, mpe };
}

/**
 * Temperature effect on no-load 3.9.2.1: |Δzero| per 5 °C (1 °C class I) ≤ e.
 */
export function tempNoLoadResult(
  readings: Array<{ tempC: Decimal; zero: Decimal }>,
  class_: AccuracyClass,
  e: Decimal,
): { passed: boolean; pairs: Array<{ dT: Decimal; dZero: Decimal; allowed: Decimal; ok: boolean }> } {
  if (readings.length < 2) {
    throw new Error("cannot-compute: temperature no-load needs at least 2 points");
  }
  const step = class_ === "I" ? new Decimal(1) : new Decimal(5);
  const allowed = d(e);
  const sorted = [...readings].sort((a, b) => d(a.tempC).cmp(d(b.tempC)));
  const pairs = [];
  for (let i = 1; i < sorted.length; i++) {
    const dT = d(sorted[i].tempC).sub(d(sorted[i - 1].tempC)).abs();
    const dZero = d(sorted[i].zero).sub(d(sorted[i - 1].zero)).abs();
    const scaled = dT.eq(0) ? new Decimal(0) : dZero.div(dT).mul(step);
    pairs.push({ dT, dZero, allowed, ok: scaled.lte(allowed) });
  }
  return { passed: pairs.every((p) => p.ok), pairs };
}

/** Span-stability: spread of (I−Max) over time points ≤ e. */
export function spanStabilityResult(
  indicationsAtMax: Decimal[],
  Max: Decimal,
  e: Decimal,
): { passed: boolean; spread: Decimal; allowed: Decimal; errors: Decimal[] } {
  if (indicationsAtMax.length < 2) {
    throw new Error("cannot-compute: span-stability needs at least 2 points");
  }
  const errors = indicationsAtMax.map((i) => indicationError(i, Max));
  const spread = Decimal.max(...errors).sub(Decimal.min(...errors));
  const allowed = d(e);
  return { passed: spread.lte(allowed), spread, allowed, errors };
}

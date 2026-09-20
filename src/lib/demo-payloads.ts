/**
 * Mocked bench numbers for Class III, Max 30000 g, e = d = 10 g, n = 3000.
 * Loads follow published OIML R 76-1:2006 (not the 1.1CD drafts):
 *   Table 3 Min = 20e; Table 6 initial MPE 0.5e / 1e / 1.5e at 500e / 2000e;
 *   A.4.4.1 ≥10 loads for initial intrinsic error, include Min, Max, mpe change points;
 *   A.4.7 / 3.6.2.1 eccentricity at (Max + additive tare)/3 — tare=0 → Max/3;
 *   A.4.8 three loads e.g. Min, ½ Max, Max — we seed the ½ Max row; extra 1.4d (Fig. 10);
 *   A.4.10 type approval, Max < 1000 kg: 10 weighings at ~50 % Max (second series at Max not a separate field);
 *   A.4.11.1 / 3.9.4.1 creep close to Max; A.5.4 10e and a load in [½ Max, Max] at 0.85/1.10 Un;
 *   3.6.2.4 rolling load ≤ 0.8 Max.
 * Un = 230 V (Indian single-phase; NMI P 108 forms print 240 V — that is Australia).
 * Pass indications sit on the e-step (a d=e display cannot show 1 g).
 * Sources fetched 2026-09-20: oiml.org R 76-1:2006, 2013.oiml.org R 76-2:2007,
 * industry.gov.au NMI P 108, consumeraffairs.nic.in LM (General) Rules 2011.
 * Engine still marks I−L, not sheet E = I + ½e − ΔL − L. Not RRSL. Labelled mocked.
 */

const E = 10;
const MAX = 30000;

const UP: Array<[string, string, string]> = [
  ["0", "0", "empty"],
  ["200", "200", "Min 20e"],
  ["1000", "1000", "100e"],
  ["2500", "2500", "250e"],
  ["5000", "5000", "500e"],
  ["10000", "10000", "1000e"],
  ["15000", "15000", "1500e"],
  ["20000", "20000", "2000e"],
  ["25000", "25000", "2500e"],
  ["30000", "30010", "Max"],
];

const DOWN: Array<[string, string, string]> = [
  ["30000", "30010", "Max ↓"],
  ["25000", "25000", "2500e ↓"],
  ["20000", "20010", "2000e ↓"],
  ["15000", "15000", "1500e ↓"],
  ["10000", "10000", "1000e ↓"],
  ["5000", "5000", "500e ↓"],
  ["2500", "2500", "250e ↓"],
  ["1000", "1000", "100e ↓"],
  ["200", "200", "Min ↓"],
  ["0", "0", "empty"],
];

export const WEIGHING_ROWS = [
  ...UP.map(([load, indicated]) => ({ load, indicated, direction: "up" as const })),
  ...DOWN.map(([load, indicated]) => ({ load, indicated, direction: "down" as const })),
];

export const WEIGHING_LABELS = [...UP.map(([, , label]) => label), ...DOWN.map(([, , label]) => label)];

/** A.4.10 type-approval series at ~50 % Max; 10 weighings. MPE ±1e = 10 g. */
export const REPEAT_PASS = {
  trueLoad: "15000",
  indications: ["15000", "15010", "15000", "15000", "15010", "15000", "15000", "15010", "15000", "15000"],
};

/**
 * Locked USP: corner C = 11 g vs allowed 10 g.
 * ponytail: C is the R 76-2 rounding-eliminated P = I + ½e − ΔL
 * (I=10010, ΔL=4, ½e=5 → 10011). Engine still marks I−L. Other corners are raw I on the e-step.
 */
export const ECC_NEAR_MISS = {
  trueLoad: "10000",
  positions: { A: "10000", B: "10010", C: "10011", D: "9990" },
};

export const ECC_PASS = {
  trueLoad: "10000",
  positions: { A: "10000", B: "10010", C: "10000", D: "9990" },
};

export function extraNumericPayloads() {
  const half = String(MAX / 2);
  const tenE = String(10 * E);
  return {
    TARE: { rows: WEIGHING_ROWS },
    DISCRIMINATION: { indicatedBefore: half, indicatedAfter: "15010", extraLoad: String(1.4 * E) },
    SENSITIVITY: { indicatedBefore: half, indicatedAfter: "15010", extraLoad: String(1.4 * E) },
    ZERO_RETURN: { residual: "0" },
    CREEP: { load: String(MAX), i0: String(MAX), i15: String(MAX), i30: String(MAX) },
    STABILITY: { i1: half, i2: "15010" },
    TILT: { noLoadLevel: "0", noLoadTilt: "10", load: half, indicatedTilt: "15010" },
    WARMUP: { zeros: ["0", "0", "10"], load: half, indicated: [half, "15010"] },
    VOLTAGE: {
      rows: [
        { voltage: "230", load: tenE, indicated: tenE },
        { voltage: "230", load: half, indicated: half },
        { voltage: "253", load: tenE, indicated: tenE },
        { voltage: "253", load: half, indicated: "15010" },
        { voltage: "195.5", load: tenE, indicated: tenE },
        { voltage: "195.5", load: half, indicated: half },
      ],
    },
    TEMP_NOLOAD: {
      readings: [
        { tempC: "10", zero: "0" },
        { tempC: "20", zero: "0" },
        { tempC: "30", zero: "10" },
      ],
    },
    DAMP_HEAT: { rows: WEIGHING_ROWS },
    SPAN_STABILITY: { indications: ["30000", "30010", "30000"] },
    ENDURANCE: {
      before: {
        rows: [
          { load: "0", indicated: "0", direction: "up" as const },
          { load: "30000", indicated: "30010", direction: "up" as const },
          { load: "30000", indicated: "30010", direction: "down" as const },
          { load: "0", indicated: "0", direction: "down" as const },
        ],
      },
      after: {
        rows: [
          { load: "0", indicated: "0", direction: "up" as const },
          { load: "30000", indicated: "30010", direction: "up" as const },
          { load: "30000", indicated: "30010", direction: "down" as const },
          { load: "0", indicated: "0", direction: "down" as const },
        ],
      },
    },
    ROLLING_ECC: {
      trueLoad: "24000",
      positions: { A: "24000", B: "24010", C: "24000", D: "23990", E: "24010", F: "24000" },
    },
  } as const;
}

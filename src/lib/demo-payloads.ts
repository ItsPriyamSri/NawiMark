/**
 * Mocked bench numbers for Class III, Max 30000 g, e = d = 10 g, n = 3000.
 * Read at resolution e, so every reading carries ΔL and the engine uses
 * P = I + ½e − ΔL (R 76-1:2006 A.4.4.3; 3.5.3.2 makes this mandatory when the
 * resolution during test is > 0.2e). ΔL = 5 means P = I.
 * Loads follow published OIML R 76-1:2006 (not the 1.1CD drafts):
 *   Table 3 Min = 20e; Table 6 initial MPE 0.5e / 1e / 1.5e up to 500e / 2000e / 10000e;
 *   A.4.4.1 ≥10 loads incl. Min, Max and MPE change points, up and back down;
 *   A.4.7 / 3.6.2.1 eccentricity at Max/3 (tare 0); A.4.8 three loads, 1.4d;
 *   A.4.10 two series of 10 at ~½ Max and ~Max; A.4.11 creep / zero return near Max;
 *   A.4.12 five stability trials at ~½ Max; A.5.1 tilt at 500e and Max;
 *   A.5.2 warm-up at 0/5/15/30 min; A.5.4 10e and ½ Max at 0.85/1.10 Un;
 *   A.5.3.1 static temperatures 20/40/−10/5/20 °C and A.5.3.2 in Figure 11 order;
 *   B.2 damp heat 20 °C/50 %, 40 °C/85 %, 20 °C/50 %; B.4 ≥8 span readings; A.6 ≥5 loads;
 *   A.4.2.3 / A.4.6.2 zero- and tare-setting E0 within 0.25e; A.4.6.1 tare T = ⅓ Max.
 * Un = 230 V (Indian single-phase). Not RRSL data. Labelled mocked.
 */

const E = 10;
const MAX = 30000;

export const DEMO_RESOLUTION_G = String(E);

const r = (i: string, dL = "5") => ({ i, dL });

const UP: Array<[string, string, string, string]> = [
  ["0", "0", "5", "empty"],
  ["200", "200", "5", "Min 20e"],
  ["1000", "1000", "4", "100e"],
  ["2500", "2500", "5", "250e"],
  ["5000", "5000", "3", "500e"],
  ["10000", "10000", "5", "1000e"],
  ["15000", "15000", "6", "1500e"],
  ["20000", "20000", "5", "2000e"],
  ["25000", "25000", "4", "2500e"],
  ["30000", "30010", "5", "Max"],
];

const DOWN: Array<[string, string, string, string]> = [
  ["30000", "30010", "6", "Max ↓"],
  ["25000", "25000", "5", "2500e ↓"],
  ["20000", "20010", "5", "2000e ↓"],
  ["15000", "15000", "5", "1500e ↓"],
  ["10000", "10000", "4", "1000e ↓"],
  ["5000", "5000", "5", "500e ↓"],
  ["2500", "2500", "5", "250e ↓"],
  ["1000", "1000", "6", "100e ↓"],
  ["200", "200", "5", "Min ↓"],
  ["0", "0", "5", "empty"],
];

export const WEIGHING_ROWS = [
  ...UP.map(([load, i, dL]) => ({ load, indicated: r(i, dL), direction: "up" as const })),
  ...DOWN.map(([load, i, dL]) => ({ load, indicated: r(i, dL), direction: "down" as const })),
];

export const WEIGHING_LABELS = [...UP.map(([, , , label]) => label), ...DOWN.map(([, , , label]) => label)];

/** A.4.10 type approval: 10 weighings at ~½ Max (MPE 10 g) and 10 close to Max (MPE 15 g). */
export const REPEAT_PASS = {
  series: [
    { trueLoad: "15000", indications: ["5", "4", "6", "3", "7", "5", "4", "6", "5", "5"].map((dL) => r("15000", dL)) },
    { trueLoad: "30000", indications: ["5", "6", "4", "5", "5", "3", "6", "5", "4", "5"].map((dL) => r("30010", dL)) },
  ],
};

/**
 * Locked USP: corner C = 11 g vs allowed 10 g (MPE at 1000e = 1.0e).
 * C: I = 10010, ΔL = 4 → P = 10010 + 5 − 4 = 10011 → E = 11 g.
 */
export const ECC_NEAR_MISS = {
  trueLoad: "10000",
  positions: { A: r("10000"), B: r("10010", "6"), C: r("10010", "4"), D: r("9990") },
};

export const ECC_PASS = {
  trueLoad: "10000",
  positions: { A: r("10000"), B: r("10010", "6"), C: r("10000"), D: r("9990") },
};

export const DAMP_CONDITIONS = ["Reference", "High temperature, 85 % RH", "Reference"];
export const STATIC_CONDITIONS = ["Reference", "High limit", "Low limit", "Extra (low ≤ 0 °C)", "Reference"];
export const CONDITION_LABELS = ["empty", "100e", "500e", "1500e", "Max", "Max ↓", "1500e ↓", "500e ↓", "100e ↓", "empty"];

/** A.4.4.1 "other weighing test": 5 loads up and back down, E0 on the no-load row. */
function conditionRows(dLs: string[]) {
  const loads = ["0", "1000", "5000", "15000", "30000"];
  const seq = [...loads, ...[...loads].reverse()];
  return seq.map((load, i) => ({
    load,
    indicated: r(load === "30000" ? "30010" : load, dLs[i % dLs.length]),
    direction: i < 5 ? ("up" as const) : ("down" as const),
  }));
}

/** A.4.6.1: subtractive tare T = 10000 g (1/3 Max); net loads up to Max − T. */
const TARE_ROWS = (() => {
  const net = ["0", "200", "1000", "5000", "10000", "20000"];
  const seq = [...net, ...[...net].reverse()];
  return seq.map((load, i) => ({ load, indicated: r(load, i % 3 === 1 ? "4" : "5"), direction: i < 6 ? ("up" as const) : ("down" as const) }));
})();

export const TARE_LABELS = ["empty", "Min", "100e", "500e", "1000e", "Max − T", "Max − T ↓", "1000e ↓", "500e ↓", "100e ↓", "Min ↓", "empty"];

function endurance(dL: string) {
  return ["0", "5000", "15000", "20000", "30000"].map((load) => ({
    load,
    indicated: r(load === "30000" ? "30010" : load, load === "0" ? "5" : dL),
    direction: "up" as const,
  }));
}

export function extraNumericPayloads() {
  const half = String(MAX / 2);
  const tenE = String(10 * E);
  return {
    ZERO_SETTING: { load: "0", trials: ["5", "4", "6", "5", "5"].map((dL) => r("0", dL)) },
    TARE: { tare: "10000", rows: TARE_ROWS },
    TARE_SETTING: { tare: "10000", load: "0", trials: ["5", "6", "4", "5", "5"].map((dL) => r("0", dL)) },
    DISCRIMINATION: {
      rows: [
        { load: "200", before: "190", after: "200", extra: String(1.4 * E) },
        { load: half, before: "14990", after: "15000", extra: String(1.4 * E) },
        { load: String(MAX), before: "29990", after: "30000", extra: String(1.4 * E) },
      ],
    },
    ZERO_RETURN: { before: r("0"), after: r("0", "4") },
    CREEP: { load: String(MAX), i0: r("30010"), i15: r("30010", "4"), i30: r("30010", "4") },
    STABILITY: {
      trials: Array.from({ length: 5 }, () => ({ printed: half, min: half, max: "15010" })),
    },
    TILT: {
      noLoad: { ref: r("0"), tilts: ["2", "4", "6", "3"].map((dL) => r("0", dL)) },
      loads: [
        { load: "5000", ref: r("5000"), tilts: ["3", "4", "6", "5"].map((dL) => r("5000", dL)) },
        { load: String(MAX), ref: r("30010"), tilts: ["1", "3", "5", "7"].map((dL) => r("30010", dL)) },
      ],
    },
    WARMUP: {
      load: String(MAX),
      rows: [0, 5, 15, 30].map((minute) => ({ minute: String(minute), zero: r("0"), loaded: r("30010") })),
    },
    VOLTAGE: {
      rows: [
        { voltage: "230", load: tenE, indicated: r(tenE) },
        { voltage: "230", load: half, indicated: r(half, "4") },
        { voltage: "253", load: tenE, indicated: r(tenE, "6") },
        { voltage: "253", load: half, indicated: r("15010") },
        { voltage: "195.5", load: tenE, indicated: r(tenE) },
        { voltage: "195.5", load: half, indicated: r(half, "3") },
      ],
    },
    TEMP_NOLOAD: {
      readings: [
        { tempC: "20", zero: r("0") },
        { tempC: "40", zero: r("0", "2") },
        { tempC: "-10", zero: r("0", "7") },
        { tempC: "5", zero: r("0", "6") },
        { tempC: "20", zero: r("0", "4") },
      ],
    },
    STATIC_TEMP: {
      conditions: [
        { label: STATIC_CONDITIONS[0], tempC: "20", rows: conditionRows(["5", "4", "6", "5", "5"]) },
        { label: STATIC_CONDITIONS[1], tempC: "40", rows: conditionRows(["5", "3", "4", "5", "6"]) },
        { label: STATIC_CONDITIONS[2], tempC: "-10", rows: conditionRows(["5", "6", "7", "5", "4"]) },
        { label: STATIC_CONDITIONS[3], tempC: "5", rows: conditionRows(["5", "5", "6", "4", "5"]) },
        { label: STATIC_CONDITIONS[4], tempC: "20", rows: conditionRows(["5", "4", "5", "6", "5"]) },
      ],
    },
    DAMP_HEAT: {
      conditions: [
        { label: DAMP_CONDITIONS[0], tempC: "20", rhPct: "50", rows: conditionRows(["5", "4", "6", "5", "5"]) },
        { label: DAMP_CONDITIONS[1], tempC: "40", rhPct: "85", rows: conditionRows(["5", "3", "4", "6", "7"]) },
        { label: DAMP_CONDITIONS[2], tempC: "20", rhPct: "50", rows: conditionRows(["5", "5", "4", "6", "5"]) },
      ],
    },
    SPAN_STABILITY: {
      load: String(MAX),
      indications: ["5", "4", "6", "5", "5", "3", "5", "6"].map((dL) => r("30010", dL)),
    },
    ENDURANCE: { before: { rows: endurance("5") }, after: { rows: endurance("3") } },
    ROLLING_ECC: {
      notApplicable: "Bench scale, not a rolling-load instrument (3.6.2.4 / A.4.7.4 apply to vehicle and rail scales).",
    },
  } as const;
}

/** Shared mocked fixture numbers. Demo only — labelled mocked. Not RRSL. */

export const WEIGHING_ROWS = [
  { load: "0", indicated: "0", direction: "up" as const },
  { load: "3000", indicated: "3000", direction: "up" as const },
  { load: "15000", indicated: "15000", direction: "up" as const },
  { load: "30000", indicated: "30000", direction: "up" as const },
  { load: "15000", indicated: "15000", direction: "down" as const },
  { load: "0", indicated: "0", direction: "down" as const },
];

export const REPEAT_PASS = { trueLoad: "5000", indications: ["4998", "5000", "5001", "5002", "5003"] };

/** Product USP: corner C = 11 g error vs 10 g allowed. Do not change. */
export const ECC_NEAR_MISS = {
  trueLoad: "10000",
  positions: { A: "10008", B: "9993", C: "10011", D: "9990" },
};

export const ECC_PASS = {
  trueLoad: "10000",
  positions: { A: "10008", B: "9993", C: "10010", D: "9990" },
};

export function extraNumericPayloads() {
  return {
    TARE: { rows: WEIGHING_ROWS },
    DISCRIMINATION: { indicatedBefore: "5000", indicatedAfter: "5010", extraLoad: "14" },
    SENSITIVITY: { indicatedBefore: "5000", indicatedAfter: "5010", extraLoad: "14" },
    ZERO_RETURN: { residual: "2" },
    CREEP: { load: "15000", i0: "15000", i15: "15001", i30: "15002" },
    STABILITY: { i1: "15000", i2: "15000" },
    TILT: { noLoadLevel: "0", noLoadTilt: "10", load: "15000", indicatedTilt: "15008" },
    WARMUP: { zeros: ["0", "2", "1"], load: "15000", indicated: ["15000", "15002"] },
    VOLTAGE: {
      rows: [
        { voltage: "230", load: "15000", indicated: "15000" },
        { voltage: "253", load: "15000", indicated: "15002" },
        { voltage: "196", load: "15000", indicated: "14998" },
      ],
    },
    TEMP_NOLOAD: {
      readings: [
        { tempC: "10", zero: "0" },
        { tempC: "20", zero: "2" },
        { tempC: "30", zero: "4" },
      ],
    },
    DAMP_HEAT: { rows: WEIGHING_ROWS },
    SPAN_STABILITY: { indications: ["30000", "30004", "30002"] },
    ENDURANCE: { before: { rows: WEIGHING_ROWS }, after: { rows: WEIGHING_ROWS } },
    ROLLING_ECC: {
      trueLoad: "10000",
      positions: { A: "10008", B: "9993", C: "10010", D: "9990", E: "10006", F: "9994" },
    },
  } as const;
}

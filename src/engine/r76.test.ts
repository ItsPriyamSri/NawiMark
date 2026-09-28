import { Decimal } from "decimal.js";
import { ECC_NEAR_MISS, ECC_PASS, REPEAT_PASS, WEIGHING_ROWS, extraNumericPayloads } from "../lib/demo-payloads";
import { markOne, type Ctx } from "../lib/mark";
import { explainProcedure } from "../lib/reports/explainer";
import { PACK_MARKS, notApplicableReason } from "./pack";
import {
  creepResult,
  discriminationResult,
  durabilityResult,
  eccentricityResult,
  indicationError,
  minCapacityLowerLimit,
  mpeInitial,
  mpeInService,
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
} from "./r76";

const E = new Decimal(10);
const MAX = new Decimal(30000);
const CLASS = "III" as const;
const D = (n: number | string) => new Decimal(n);

test("mpe bands 3kg 15kg", () => {
  expect(mpeInitial(CLASS, E, D(3000)).eq(5)).toBe(true);
  expect(mpeInitial(CLASS, E, D(15000)).eq(10)).toBe(true);
  expect(indicationError(D(3004), D(3000)).eq(4)).toBe(true);
});

test("A.4.4.3 changeover point: P = I + ½e − ΔL, the standard's worked example", () => {
  // e = 5 g, L = 1 kg, I = 1000 g, changes at ΔL = 1.5 g → P = 1001 g, E = +1 g.
  expect(priorToRounding(D(1000), D("1.5"), D(5)).eq(1001)).toBe(true);
  expect(priorToRounding(D(1000), null, D(5)).eq(1000)).toBe(true);
  expect(() => priorToRounding(D(1000), D(6), D(5))).toThrow(/cannot-compute/);
});

test("repeatability pass and near miss", () => {
  const pass = repeatabilityResult(D(5000), [4998, 5000, 5001, 5002, 5003].map(D), CLASS, E);
  expect(pass.mpe.eq(5) && pass.spread.eq(5) && pass.passed).toBe(true);
  const fail = repeatabilityResult(D(5000), [4997, 5000, 5001, 5002, 5003].map(D), CLASS, E);
  expect(fail.spread.eq(6) && fail.errorsOk && !fail.spreadOk && !fail.passed).toBe(true);
});

test("eccentricity pass, near miss, and E0 correction", () => {
  const pass = eccentricityResult(D(10000), { A: D(10008), B: D(9993), C: D(10010), D: D(9990) }, CLASS, E);
  expect(pass.mpe.eq(10) && pass.passed).toBe(true);
  const fail = eccentricityResult(D(10000), { A: D(10008), B: D(9993), C: D("10010.001"), D: D(9990) }, CLASS, E);
  expect(fail.errors.C.eq("10.001") && !fail.passed).toBe(true);
  // A +2 g zero error brings an 11 g corner back to 9 g.
  expect(eccentricityResult(D(10000), { C: D(10011) }, CLASS, E, D(2)).passed).toBe(true);
});

test("Table 3 n bounds, including the e sub-rows", () => {
  expect(() => validateInstrument(CLASS, MAX, D(1))).toThrow(/cannot-compute/);
  expect(validateInstrument(CLASS, MAX, E)).toBe(3000);
  // Class III with e ≥ 5 g needs n ≥ 500; class II with e ≥ 0.1 g needs n ≥ 5000.
  expect(() => validateInstrument(CLASS, D(1000), D(5))).toThrow(/Table 3/);
  expect(validateInstrument(CLASS, D(1000), D(2))).toBe(500);
  expect(() => validateInstrument("II", D(100), D("0.1"))).toThrow(/Table 3/);
  expect(() => validateInstrument("IIII", D(1000), D(1))).toThrow(/not allowed/);
  expect(minCapacityLowerLimit(CLASS, E).eq(200)).toBe(true);
  expect(minCapacityLowerLimit("II", D("0.1")).eq(5)).toBe(true);
});

test("in-service MPE is 2× initial", () => {
  expect(mpeInService(CLASS, E, D(10000)).eq(20)).toBe(true);
});

test("weighing corrects every row by the no-load error E0", () => {
  const rows = (i0: number, iMax: number) => [
    { load: D(0), indicated: D(i0), direction: "up" as const },
    { load: MAX, indicated: D(iMax), direction: "up" as const },
  ];
  expect(weighingPerformanceResult(rows(0, 30015), CLASS, E).passed).toBe(true);
  expect(weighingPerformanceResult(rows(0, 30016), CLASS, E).passed).toBe(false);
  // Same raw 16 g error passes once a +2 g zero error is removed (Ec = 14 g ≤ 15 g).
  const corrected = weighingPerformanceResult(rows(2, 30016), CLASS, E);
  expect(corrected.passed && corrected.e0.eq(2)).toBe(true);
});

test("discrimination 1.4d must raise the indication by d", () => {
  expect(discriminationResult(D(4990), D(5000), D(14), E).passed).toBe(true);
  expect(discriminationResult(D(4990), D(4990), D(14), E).passed).toBe(false);
  expect(discriminationResult(D(4990), D(5000), D(20), E).passed).toBe(false);
});

test("zero return: |P30 − P0| ≤ 0.5e", () => {
  expect(zeroReturnResult(D(0), D(5), E).passed).toBe(true);
  expect(zeroReturnResult(D(0), D("5.1"), E).passed).toBe(false);
});

test("creep uses 0.5e / 0.2e, not a fraction of MPE", () => {
  // 30 kg → MPE 15 g. The old 0.5·MPE rule allowed 7.5 g; 3.9.4.1 allows 0.5e = 5 g.
  const r = creepResult(MAX, D(30000), D(30004), D(30006), CLASS, E);
  expect(r.allow30.eq(5) && r.allow15.eq(2) && !r.earlyOk && r.needsFourHours).toBe(true);
  const edge = creepResult(MAX, D(30000), D(30003), D(30005), CLASS, E);
  expect(edge.earlyOk && edge.passed).toBe(true);
  // 15→30 min 3 g > 0.2e even though the 30-min change is small.
  expect(creepResult(MAX, D(30000), D(29998), D(30001), CLASS, E).earlyOk).toBe(false);
  // Early stop missed, 4 h worst change vs |MPE| = 15 g.
  expect(creepResult(MAX, D(30000), D(30004), D(30006), CLASS, E, D(30015)).passed).toBe(true);
  expect(creepResult(MAX, D(30000), D(30004), D(30006), CLASS, E, D(30016)).passed).toBe(false);
});

test("stability: printed, min and max within 1e", () => {
  expect(stabilityResult([{ printed: D(15000), min: D(15000), max: D(15010) }], E).passed).toBe(true);
  expect(stabilityResult([{ printed: D(15000), min: D(14990), max: D(15010) }], E).passed).toBe(false);
});

test("tilt: worst of four directions, 2e no-load (not class II) and MPE loaded", () => {
  const four = (...v: number[]) => v.map(D);
  const loads = [{ load: D(5000), ref: D(5000), tilts: four(5005, 4995, 5000, 5001) }];
  expect(tiltResult(D(0), four(20, -20, 0, 5), loads, CLASS, E).passed).toBe(true);
  expect(tiltResult(D(0), four(0, 0, 21, 0), loads, CLASS, E).noLoadOk).toBe(false);
  expect(tiltResult(D(0), four(21, 0, 0, 0), loads, "II", D(1)).noLoadApplies).toBe(false);
  expect(tiltResult(D(0), four(0, 0, 0, 0), [{ load: D(5000), ref: D(5000), tilts: four(5000, 5000, 5000, 5006) }], CLASS, E).passed).toBe(
    false,
  );
});

test("zero- and tare-setting: |E0| ≤ 0.25e", () => {
  expect(zeroSettingResult(D(0), [D("2.5"), D("-2.5")], E).passed).toBe(true);
  expect(zeroSettingResult(D(0), [D("2.6")], E).passed).toBe(false);
  expect(zeroSettingResult(D(100), [D(102)], E).trials[0].e0.eq(2)).toBe(true);
});

test("warm-up: |EL − E0| ≤ MPE at each time", () => {
  const rows = (loaded: number) => [0, 5, 15, 30].map((minute) => ({ minute, zero: D(2), loaded: D(loaded) }));
  expect(warmupResult(MAX, rows(30017), CLASS, E).passed).toBe(true);
  expect(warmupResult(MAX, rows(30018), CLASS, E).passed).toBe(false);
});

test("temperature no-load in test order, per 5 °C", () => {
  const pass = tempNoLoadResult(
    [
      { tempC: D(20), zero: D(0) },
      { tempC: D(40), zero: D(40) },
      { tempC: D(20), zero: D(40) },
    ],
    CLASS,
    E,
  );
  expect(pass.passed && pass.pairs.length === 2).toBe(true);
  const fail = tempNoLoadResult(
    [
      { tempC: D(20), zero: D(0) },
      { tempC: D(25), zero: D(11) },
    ],
    CLASS,
    E,
  );
  expect(fail.passed).toBe(false);
});

test("span stability: variation ≤ max(½e, ½|MPE|) and each |E| ≤ MPE", () => {
  // Near Max MPE = 15 g → allowed variation 7.5 g, not e.
  const pass = spanStabilityResult(MAX, [30000, 30007.5].map(D), CLASS, E);
  expect(pass.allowed.eq("7.5") && pass.passed).toBe(true);
  expect(spanStabilityResult(MAX, [30000, 30008].map(D), CLASS, E).passed).toBe(false);
  expect(spanStabilityResult(MAX, [30016, 30016].map(D), CLASS, E).errorsOk).toBe(false);
});

test("endurance: durability error = E after − E before", () => {
  const before = [{ load: MAX, indicated: D(30010) }];
  expect(durabilityResult(before, [{ load: MAX, indicated: D(29995) }], CLASS, E).passed).toBe(true);
  expect(durabilityResult(before, [{ load: MAX, indicated: D(29994) }], CLASS, E).passed).toBe(false);
});

test("applicability from R 76-1 scope notes", () => {
  expect(notApplicableReason("SENSITIVITY", "III", "30000", "10")).toMatch(/non-self-indicating/);
  expect(notApplicableReason("ENDURANCE", "III", "150000", "50")).toMatch(/100 kg/);
  expect(notApplicableReason("CREEP", "I", "200", "0.001")).toMatch(/3\.9\.4/);
  expect(notApplicableReason("DAMP_HEAT", "II", "5000", "0.1")).toMatch(/B\.2/);
  expect(notApplicableReason("WEIGHING", "III", "30000", "10")).toBeNull();
});

const CTX: Ctx = { class_: CLASS, e: E, Max: MAX, fine: false, unom: D(230) };

test("seeded fixtures: every applicable sheet passes except the locked 11 g corner", () => {
  const payloads: Record<string, unknown> = {
    WEIGHING: { rows: WEIGHING_ROWS },
    REPEATABILITY: REPEAT_PASS,
    ...extraNumericPayloads(),
  };
  // Every pack mark has a fixture except SENSITIVITY (auto not-applicable) and ECCENTRICITY (below).
  expect(Object.keys(payloads).sort()).toEqual(PACK_MARKS.filter((k) => k !== "SENSITIVITY" && k !== "ECCENTRICITY").sort());
  for (const [key, payload] of Object.entries(payloads)) {
    if (key === "ROLLING_ECC") continue;
    const out = markOne(key, payload, CTX);
    expect({ key, status: out.status, result: out.resultJson }).toMatchObject({ key, status: "MARKED_PASS" });
  }
  const fail = markOne("ECCENTRICITY", ECC_NEAR_MISS, CTX);
  expect(fail.status).toBe("MARKED_FAIL");
  expect((fail.resultJson as { errors: Record<string, string> }).errors.C).toBe("11");
  expect(markOne("ECCENTRICITY", ECC_PASS, CTX).status).toBe("MARKED_PASS");
});

test("resolution e without ΔL cannot compute (3.5.3.2); fine resolution needs none", () => {
  const bare = { trueLoad: "10000", positions: { A: "10000", B: "10010", C: "10010", D: "9990" } };
  const out = markOne("ECCENTRICITY", bare, CTX);
  expect(out.status).toBe("CANNOT_COMPUTE");
  expect((out.resultJson as { reason: string }).reason).toMatch(/3\.5\.3\.2/);
  expect(markOne("ECCENTRICITY", bare, { ...CTX, fine: true }).status).toBe("MARKED_PASS");
});

test("minimum readings the standard states", () => {
  const one = { series: [REPEAT_PASS.series[0]] };
  expect(markOne("REPEATABILITY", one, CTX).status).toBe("CANNOT_COMPUTE");
  expect(markOne("WEIGHING", { rows: WEIGHING_ROWS.slice(0, 5) }, CTX).status).toBe("CANNOT_COMPUTE");
  const { SPAN_STABILITY } = extraNumericPayloads();
  expect(markOne("SPAN_STABILITY", { ...SPAN_STABILITY, indications: SPAN_STABILITY.indications.slice(0, 7) }, CTX).status).toBe(
    "CANNOT_COMPUTE",
  );
});

test("reviewer findings: non-finite input, E0 gate, load placement, voltage limits", () => {
  const { TEMP_NOLOAD, CREEP, VOLTAGE, TARE } = extraNumericPayloads();
  const inf = { readings: [{ tempC: "20", zero: "0" }, { tempC: "Infinity", zero: "0" }] };
  expect(markOne("TEMP_NOLOAD", inf, { ...CTX, fine: true }).status).toBe("CANNOT_COMPUTE");
  expect(markOne("TEMP_NOLOAD", TEMP_NOLOAD, CTX).status).toBe("MARKED_PASS");
  // Zero reading 5 g high (E0 = 5 > 0.25e): the run is invalid, not a pass after correction.
  const shifted = { rows: WEIGHING_ROWS.map((r) => ({ ...r, indicated: { i: String(Number(r.indicated.i) + 10), dL: r.indicated.dL } })) };
  expect(markOne("WEIGHING", shifted, CTX).status).toBe("CANNOT_COMPUTE");
  // Creep at 10e is not "close to Max".
  expect(markOne("CREEP", { ...CREEP, load: "100" }, CTX).status).toBe("CANNOT_COMPUTE");
  // Voltage needs Unom and readings at 0.85 / 1.10 Unom.
  expect(markOne("VOLTAGE", VOLTAGE, { ...CTX, unom: null }).status).toBe("CANNOT_COMPUTE");
  expect(markOne("VOLTAGE", VOLTAGE, { ...CTX, unom: D(240) }).status).toBe("CANNOT_COMPUTE");
  // Net + tare beyond Max.
  expect(markOne("TARE", { ...TARE, tare: "15000" }, CTX).status).toBe("CANNOT_COMPUTE");
});

test("a FAIL headline names the row that failed, not the largest raw error", () => {
  const rows = WEIGHING_ROWS.map((r) => (r.load === "5000" && r.direction === "up" ? { ...r, indicated: { i: "5010", dL: "9" } } : r));
  const out = markOne("WEIGHING", { rows }, CTX); // 5000 g: E = 6 g > MPE 5 g; 30000 g: 10 of 15
  expect(out.status).toBe("MARKED_FAIL");
  expect((explainProcedure("WEIGHING", out.resultJson) ?? [])[0]).toBe("Load 5000 g: 6 g error. Allowed: 5 g.");
});

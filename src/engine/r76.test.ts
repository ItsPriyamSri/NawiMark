import { Decimal } from "decimal.js";
import { ECC_NEAR_MISS, ECC_PASS, REPEAT_PASS, WEIGHING_ROWS, extraNumericPayloads } from "../lib/demo-payloads";
import {
  creepResult,
  discriminationResult,
  eccentricityResult,
  indicationError,
  mpeInitial,
  mpeInService,
  repeatabilityResult,
  spanStabilityResult,
  stabilityResult,
  tempNoLoadResult,
  tiltResult,
  validateInstrument,
  weighingPerformanceResult,
  zeroReturnResult,
} from "./r76";

const E = new Decimal(10);
const MAX = new Decimal(30000);
const CLASS = "III" as const;

test("mpe bands 3kg 15kg", () => {
  expect(mpeInitial(CLASS, E, new Decimal(3000)).eq(new Decimal("5"))).toBe(true);
  expect(mpeInitial(CLASS, E, new Decimal(15000)).eq(new Decimal("10"))).toBe(true);
  expect(indicationError(new Decimal(3004), new Decimal(3000)).eq(4)).toBe(true);
});

test("repeatability pass", () => {
  const r = repeatabilityResult(
    new Decimal(5000),
    [4998, 5000, 5001, 5002, 5003].map((n) => new Decimal(n)),
    CLASS,
    E,
  );
  expect(r.mpe.eq(5) && r.spread.eq(5) && r.passed).toBe(true);
});

test("repeatability fail near miss", () => {
  const r = repeatabilityResult(
    new Decimal(5000),
    [4997, 5000, 5001, 5002, 5003].map((n) => new Decimal(n)),
    CLASS,
    E,
  );
  expect(r.spread.eq(6) && r.errorsOk && !r.spreadOk && !r.passed).toBe(true);
});

test("eccentricity pass", () => {
  const r = eccentricityResult(
    new Decimal(10000),
    { A: new Decimal(10008), B: new Decimal(9993), C: new Decimal(10010), D: new Decimal(9990) },
    CLASS,
    E,
  );
  expect(r.mpe.eq(10) && r.passed && r.errors.C.abs().eq(10)).toBe(true);
});

test("eccentricity fail near miss check.py", () => {
  const r = eccentricityResult(
    new Decimal(10000),
    {
      A: new Decimal(10008),
      B: new Decimal(9993),
      C: new Decimal("10010.001"),
      D: new Decimal(9990),
    },
    CLASS,
    E,
  );
  expect(r.errors.C.eq("10.001") && !r.passed).toBe(true);
});

test("validate rejects illegal n", () => {
  expect(() => validateInstrument(CLASS, MAX, new Decimal(1))).toThrow(/cannot-compute/);
});

test("validate legal n", () => {
  expect(validateInstrument(CLASS, MAX, E)).toBe(3000);
});

test("in-service MPE is 2× initial", () => {
  expect(mpeInService(CLASS, E, new Decimal(10000)).eq(20)).toBe(true);
});

test("discrimination extra 1.4e moves the display", () => {
  const pass = discriminationResult(new Decimal(5000), new Decimal(5010), new Decimal(14), E);
  expect(pass.passed && pass.change.eq(10)).toBe(true);
  const fail = discriminationResult(new Decimal(5000), new Decimal(5000), new Decimal(14), E);
  expect(fail.passed).toBe(false);
});

test("creep near-miss on 30 min allowance", () => {
  // 15 kg → MPE 10 g; 0.5 MPE = 5 g. 6 g over 30 min fails.
  const r = creepResult(new Decimal(15000), new Decimal(15000), new Decimal(15002), new Decimal(15006), CLASS, E);
  expect(r.allow30.eq(5) && !r.passed).toBe(true);
});

test("tilt no-load 2e and loaded MPE", () => {
  const pass = tiltResult(new Decimal(0), new Decimal(10), new Decimal(15000), new Decimal(15008), CLASS, E);
  expect(pass.passed && pass.noLoadOk && pass.loadedOk).toBe(true);
  const fail = tiltResult(new Decimal(0), new Decimal(30), new Decimal(15000), new Decimal(15008), CLASS, E);
  expect(fail.noLoadOk).toBe(false);
});

test("weighing performance pass and fail", () => {
  const pass = weighingPerformanceResult(
    [
      { load: new Decimal(0), indicated: new Decimal(0), direction: "up" },
      { load: new Decimal(30000), indicated: new Decimal(30008), direction: "up" },
    ],
    CLASS,
    E,
  );
  expect(pass.passed).toBe(true);
  const fail = weighingPerformanceResult(
    [
      { load: new Decimal(0), indicated: new Decimal(0), direction: "up" },
      { load: new Decimal(30000), indicated: new Decimal(30020), direction: "up" },
    ],
    CLASS,
    E,
  );
  expect(fail.passed).toBe(false);
});

test("zero return and stability vs e", () => {
  expect(zeroReturnResult(new Decimal(5), E).passed).toBe(true);
  expect(zeroReturnResult(new Decimal(11), E).passed).toBe(false);
  expect(stabilityResult(new Decimal(10000), new Decimal(10008), E).passed).toBe(true);
  expect(stabilityResult(new Decimal(10000), new Decimal(10020), E).passed).toBe(false);
});

test("seeded fixtures match Table 6 initial on the e-step", () => {
  const weigh = weighingPerformanceResult(
    WEIGHING_ROWS.map((r) => ({ load: new Decimal(r.load), indicated: new Decimal(r.indicated), direction: r.direction })),
    CLASS,
    E,
  );
  expect(weigh.passed).toBe(true);

  const repeat = repeatabilityResult(
    new Decimal(REPEAT_PASS.trueLoad),
    REPEAT_PASS.indications.map((n) => new Decimal(n)),
    CLASS,
    E,
  );
  expect(repeat.passed).toBe(true);

  const fail = eccentricityResult(
    new Decimal(ECC_NEAR_MISS.trueLoad),
    Object.fromEntries(Object.entries(ECC_NEAR_MISS.positions).map(([k, v]) => [k, new Decimal(v)])),
    CLASS,
    E,
  );
  expect(fail.errors.C.abs().eq(11) && !fail.passed).toBe(true);

  const pass = eccentricityResult(
    new Decimal(ECC_PASS.trueLoad),
    Object.fromEntries(Object.entries(ECC_PASS.positions).map(([k, v]) => [k, new Decimal(v)])),
    CLASS,
    E,
  );
  expect(pass.passed).toBe(true);

  const extra = extraNumericPayloads();
  expect(
    discriminationResult(
      new Decimal(extra.DISCRIMINATION.indicatedBefore),
      new Decimal(extra.DISCRIMINATION.indicatedAfter),
      new Decimal(extra.DISCRIMINATION.extraLoad),
      E,
    ).passed,
  ).toBe(true);
  expect(zeroReturnResult(new Decimal(extra.ZERO_RETURN.residual), E).passed).toBe(true);
  expect(
    creepResult(
      new Decimal(extra.CREEP.load),
      new Decimal(extra.CREEP.i0),
      new Decimal(extra.CREEP.i15),
      new Decimal(extra.CREEP.i30),
      CLASS,
      E,
    ).passed,
  ).toBe(true);
});

test("temp no-load and span stability pass/fail", () => {
  const tPass = tempNoLoadResult(
    [
      { tempC: new Decimal(20), zero: new Decimal(0) },
      { tempC: new Decimal(25), zero: new Decimal(5) },
    ],
    CLASS,
    E,
  );
  expect(tPass.passed).toBe(true);
  const tFail = tempNoLoadResult(
    [
      { tempC: new Decimal(20), zero: new Decimal(0) },
      { tempC: new Decimal(25), zero: new Decimal(20) },
    ],
    CLASS,
    E,
  );
  expect(tFail.passed).toBe(false);
  const sPass = spanStabilityResult([new Decimal(30000), new Decimal(30008)], MAX, E);
  expect(sPass.passed).toBe(true);
  const sFail = spanStabilityResult([new Decimal(30000), new Decimal(30020)], MAX, E);
  expect(sFail.passed).toBe(false);
});

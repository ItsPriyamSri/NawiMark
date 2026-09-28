import { Decimal } from "decimal.js";
import { ECC_NEAR_MISS } from "../demo-payloads";
import { markOne } from "../mark";
import { buildShowWorking, explainProcedure } from "./explainer";

test("locked USP line comes from the marked P = I + ½e − ΔL, not a typed-in 10011", () => {
  const out = markOne("ECCENTRICITY", ECC_NEAR_MISS, { class_: "III", e: new Decimal(10), Max: new Decimal(30000), fine: false });
  const lines = explainProcedure("ECCENTRICITY", out.resultJson) ?? [];
  expect(lines[0]).toBe("Corner C: 11 g error. Allowed at this load: 10 g.");
  expect(lines.join(" ")).toMatch(/I = 10010 g, dL = 4 g, P = I \+ 1\/2 e - dL = 10011 g/);
  expect(lines.join(" ")).toMatch(/would be 20 g and this would have passed/);
  const shop = explainProcedure("ECCENTRICITY", out.resultJson, "in-service") ?? [];
  expect(shop[0]).toBe("Corner C: 11 g error. Allowed at this load: 20 g.");
});

test("not-applicable rows carry their reason and who declared it", () => {
  const rows = buildShowWorking([
    {
      id: "1",
      evaluationId: "e",
      key: "ROLLING_ECC",
      status: "NOT_APPLICABLE",
      payloadJson: {},
      resultJson: { reason: "Bench scale", by: "tester" },
      markedByPack: "R-76 pack v2",
    },
  ]);
  expect(rows[0].note).toBe("Not applicable (declared by tester): Bench scale");
});

test("cannot-compute payload does not throw", () => {
  expect(explainProcedure("WEIGHING", { reason: "cannot-compute: n" })).toBeNull();
  expect(explainProcedure("ECCENTRICITY", { reason: "cannot-compute: n" })).toBeNull();
  expect(explainProcedure("TARE", { reason: "cannot-compute: temp 99" })).toBeNull();
});

test("2× generic does not claim a pass without an observed error", () => {
  const lines = explainProcedure("CREEP", { passed: false, mpe: "10" }, "in-service") ?? [];
  expect(lines.join(" ")).not.toMatch(/would have passed/);
});

test("buildShowWorking keeps cannot-compute as a note", () => {
  const rows = buildShowWorking([
    {
      id: "1",
      evaluationId: "e",
      key: "WEIGHING",
      status: "CANNOT_COMPUTE",
      payloadJson: {},
      resultJson: { reason: "cannot-compute: class III n=30000" },
      markedByPack: "R-76 pack v1",
    },
  ]);
  expect(rows[0].lines).toEqual([]);
  expect(rows[0].note).toMatch(/n=30000/);
});

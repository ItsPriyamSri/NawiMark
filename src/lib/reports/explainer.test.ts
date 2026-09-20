import { buildShowWorking, explainProcedure } from "./explainer";

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

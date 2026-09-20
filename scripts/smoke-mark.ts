/**
 * Submission smoke: mark the seeded near-miss evaluation and export both
 * reports to disk, so scripts/smoke.sh can grep them for the locked lines.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { markEvaluation } from "../src/lib/mark";
import { renderPdf } from "../src/lib/reports/pdf";
import { renderDocx } from "../src/lib/reports/docx";

const db = new PrismaClient();

async function main() {
  const candidates = await db.evaluation.findMany({
    where: { instrument: { model: "NW-30" } },
    include: { instrument: true, procedures: true },
  });
  const evaluation =
    candidates.find((e) => {
      const ecc = e.procedures.find((p) => p.key === "ECCENTRICITY");
      const payload = ecc?.payloadJson as { positions?: { C?: string } } | null;
      return payload?.positions?.C === "10011";
    }) ?? candidates[0];
  if (!evaluation) throw new Error("no NW-30 evaluation to smoke");
  await markEvaluation(evaluation.id);
  const marked = await db.evaluation.findUniqueOrThrow({
    where: { id: evaluation.id },
    include: { instrument: true, procedures: true },
  });

  mkdirSync("/tmp/nawimark-smoke", { recursive: true });
  const pdfPath = "/tmp/nawimark-smoke/report.pdf";
  const docxPath = "/tmp/nawimark-smoke/report.docx";
  writeFileSync(pdfPath, await renderPdf(marked));
  writeFileSync(docxPath, await renderDocx(marked));
  console.log(pdfPath);
  console.log(docxPath);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

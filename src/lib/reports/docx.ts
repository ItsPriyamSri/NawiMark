import { Document, Packer, Paragraph } from "docx";
import type { Evaluation, Instrument, Procedure } from "@prisma/client";
import { buildReportLines } from "./explainer";

export async function renderDocx(
  evaluation: Evaluation & { instrument: Instrument; procedures: Procedure[] },
): Promise<Buffer> {
  const lines = buildReportLines(evaluation);
  const doc = new Document({
    sections: [{ children: lines.map((line) => new Paragraph(line)) }],
  });
  return Packer.toBuffer(doc);
}

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Evaluation, Instrument, Procedure } from "@prisma/client";
import { buildReportLines } from "./explainer";

const PAGE_SIZE: [number, number] = [612, 792]; // US Letter
const MARGIN = 50;
const FONT_SIZE = 10;
const LINE_HEIGHT = 14;

export async function renderPdf(
  evaluation: Evaluation & { instrument: Instrument; procedures: Procedure[] },
): Promise<Uint8Array> {
  const lines = buildReportLines(evaluation).flatMap((line) => wrapLine(line, 92));
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const usableHeight = PAGE_SIZE[1] - 2 * MARGIN;
  const linesPerPage = Math.floor(usableHeight / LINE_HEIGHT);

  for (let i = 0; i < lines.length; i += linesPerPage) {
    const page = doc.addPage(PAGE_SIZE);
    const chunk = lines.slice(i, i + linesPerPage);
    chunk.forEach((line, idx) => {
      page.drawText(line, {
        x: MARGIN,
        y: PAGE_SIZE[1] - MARGIN - idx * LINE_HEIGHT,
        size: FONT_SIZE,
        font,
        color: rgb(0, 0, 0),
      });
    });
  }

  return doc.save();
}

function wrapLine(line: string, width: number): string[] {
  if (line.length <= width) return [line];
  const words = line.split(" ");
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > width && cur) {
      out.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) out.push(cur);
  return out.length ? out : [line];
}

import { PDFDocument, type PDFFont, type PDFPage, StandardFonts, rgb } from "pdf-lib";
import { buildReport, REPORT_TITLE, type ReportEvaluation, type ResultTable } from "./explainer";

const PAGE_SIZE: [number, number] = [595.28, 841.89]; // A4
const MARGIN = 48;
const WIDTH = PAGE_SIZE[0] - 2 * MARGIN;

const WIN_ANSI_SWAPS: Record<string, string> = { "≤": "<=", "≥": ">=", "Δ": "d", "−": "-", "→": "->", "↓": "down", "↑": "up" };

/** Standard fonts are WinAnsi-only; anything else would throw at drawText. */
function winAnsi(line: string): string {
  return line.replace(/[≤≥Δ−→↓↑]/g, (c) => WIN_ANSI_SWAPS[c]).replace(/[^\x20-\x7E -ÿ–—‘’“”•…]/g, "?");
}

export async function renderPdf(evaluation: ReportEvaluation): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    mono: await doc.embedFont(StandardFonts.Courier),
  };
  let page: PDFPage = doc.addPage(PAGE_SIZE);
  let y = PAGE_SIZE[1] - MARGIN;

  const ensure = (h: number) => {
    if (y - h < MARGIN + 16) {
      page = doc.addPage(PAGE_SIZE);
      y = PAGE_SIZE[1] - MARGIN;
    }
  };
  const text = (raw: string, font: PDFFont, size: number, indent = 0) => {
    for (const line of wrap(winAnsi(raw), font, size, WIDTH - indent)) {
      ensure(size + 4);
      page.drawText(line, { x: MARGIN + indent, y: y - size, size, font, color: rgb(0, 0, 0) });
      y -= size + 4;
    }
  };
  const table = (t: ResultTable) => {
    const cells = [t.headers, ...t.rows].map((r) => r.map((c) => winAnsi(c)));
    const widths = t.headers.map((_, i) => Math.max(...cells.map((r) => (r[i] ?? "").length)));
    const chars = widths.reduce((a, b) => a + b + 2, 0);
    const size = Math.max(5.5, Math.min(8, WIDTH / (chars * 0.6)));
    for (const [ri, r] of cells.entries()) {
      ensure(size + 3);
      const line = r.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join("  ");
      page.drawText(line, { x: MARGIN + 12, y: y - size, size, font: fonts.mono, color: rgb(0, 0, 0) });
      y -= size + 3;
      if (ri === 0) {
        page.drawLine({ start: { x: MARGIN + 12, y: y + 1 }, end: { x: MARGIN + 12 + line.length * size * 0.6, y: y + 1 }, thickness: 0.4 });
        y -= 2;
      }
    }
    y -= 4;
  };

  const report = buildReport(evaluation);
  text("NawiMark", fonts.bold, 16);
  text(REPORT_TITLE, fonts.bold, 11);
  y -= 6;
  for (const line of report.head) text(line, line.startsWith("Result:") ? fonts.bold : fonts.regular, 9);
  y -= 8;
  for (const sec of report.sections) {
    ensure(40);
    text(`${sec.title}: ${sec.status}`, fonts.bold, 10);
    for (const line of sec.lines) text(line, fonts.regular, 8.5, 12);
    if (sec.table) table(sec.table);
    y -= 6;
  }
  for (const line of report.foot) text(line, fonts.bold, 9);

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const label = `Report page ${i + 1} / ${pages.length}  ·  ${evaluation.packId}`;
    p.drawText(winAnsi(label), { x: MARGIN, y: MARGIN - 20, size: 7, font: fonts.regular, color: rgb(0.35, 0.35, 0.35) });
  });
  return doc.save();
}

/** Split a word wider than the line into pieces that fit (long IDs, pasted text). */
function chop(word: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const ch of word) {
    if (cur && font.widthOfTextAtSize(cur + ch, size) > width) {
      out.push(cur);
      cur = "";
    }
    cur += ch;
  }
  return cur ? [...out, cur] : out;
}

function wrap(line: string, font: PDFFont, size: number, width: number): string[] {
  if (font.widthOfTextAtSize(line, size) <= width) return [line];
  const out: string[] = [];
  let cur = "";
  for (const w of line.split(" ").flatMap((x) => chop(x, font, size, width))) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && font.widthOfTextAtSize(next, size) > width) {
      out.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) out.push(cur);
  return out;
}

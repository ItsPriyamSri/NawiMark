import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import { buildReport, REPORT_TITLE, type ReportEvaluation, type ResultTable } from "./explainer";

function table(t: ResultTable): Table {
  const row = (cells: string[], bold = false) =>
    new TableRow({
      tableHeader: bold,
      children: cells.map(
        (c) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: c, bold, size: 16 })] })] }),
      ),
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [row(t.headers, true), ...t.rows.map((r) => row(r))],
  });
}

/** Editable Word report: same sections, lines and tables as the PDF and the screen. */
export async function renderDocx(evaluation: ReportEvaluation): Promise<Buffer> {
  const report = buildReport(evaluation);
  const children: Array<Paragraph | Table> = [
    new Paragraph({ text: "NawiMark", heading: HeadingLevel.TITLE }),
    new Paragraph({ text: REPORT_TITLE, heading: HeadingLevel.HEADING_2 }),
    ...report.head.map(
      (line) => new Paragraph({ children: [new TextRun({ text: line, bold: line.startsWith("Result:") })] }),
    ),
  ];
  for (const sec of report.sections) {
    children.push(new Paragraph({ text: `${sec.title}: ${sec.status}`, heading: HeadingLevel.HEADING_3 }));
    for (const line of sec.lines) children.push(new Paragraph(line));
    if (sec.table) children.push(table(sec.table), new Paragraph(""));
  }
  for (const line of report.foot) children.push(new Paragraph({ children: [new TextRun({ text: line, bold: true })] }));
  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}

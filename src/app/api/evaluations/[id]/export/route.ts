import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PACK_MARKS } from "@/engine/pack";
import { renderPdf } from "@/lib/reports/pdf";
import { renderDocx } from "@/lib/reports/docx";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const evaluation = await db.evaluation.findUnique({
    where: { id },
    include: { instrument: true, procedures: true },
  });
  if (!evaluation) return NextResponse.json({ error: "not-found" }, { status: 404 });

  const isOwnerTester = session.user.role === "TESTER" && session.user.id === evaluation.instrument.createdById;
  const isReviewer = session.user.role === "REVIEWER";
  if (!isOwnerTester && !isReviewer) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const marks = evaluation.procedures.filter((p) => (PACK_MARKS as readonly string[]).includes(p.key));
  if (marks.some((p) => p.status === "CANNOT_COMPUTE")) {
    return NextResponse.json({ error: "cannot-compute: no report for an illegal instrument or out-of-band lab conditions" }, { status: 400 });
  }

  const format = req.nextUrl.searchParams.get("format");
  // instrument.model is free text (createInstrumentAction has no charset
  // restriction on it) — strip it to a safe filename before it goes into
  // a header, so a quote/CRLF/control char can't break Content-Disposition.
  const safeModel = evaluation.instrument.model.replace(/[^A-Za-z0-9._-]/g, "_");
  const base = `${safeModel}-${evaluation.id}`;

  if (format === "docx") {
    const buf = await renderDocx(evaluation);
    // Buffer/Uint8Array satisfy BodyInit at runtime; the cast works around a
    // TS lib mismatch between Node's and DOM's ArrayBuffer generics.
    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${base}.docx"`,
      },
    });
  }

  const bytes = await renderPdf(evaluation);
  return new NextResponse(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${base}.pdf"`,
    },
  });
}

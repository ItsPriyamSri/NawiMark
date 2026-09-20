import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id, attachmentId } = await params;
  const attachment = await db.attachment.findUnique({
    where: { id: attachmentId },
    include: { evaluation: { include: { instrument: true } } },
  });
  if (!attachment || attachment.evaluationId !== id) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const owner =
    session.user.role === "TESTER" && session.user.id === attachment.evaluation.instrument.createdById;
  if (!owner && session.user.role !== "REVIEWER") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const abs = path.resolve(process.cwd(), attachment.path);
  const root = path.resolve(process.cwd(), "uploads");
  if (!abs.startsWith(root + path.sep)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await stat(abs);
  } catch {
    return NextResponse.json({ error: "missing-file" }, { status: 404 });
  }

  const bytes = await readFile(abs);
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": attachment.mime,
      "Content-Disposition": `attachment; filename="${attachment.filename.replace(/[^A-Za-z0-9._-]/g, "_")}"`,
    },
  });
}

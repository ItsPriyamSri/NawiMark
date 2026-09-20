"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ProcedureKey } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { markEvaluation } from "@/lib/mark";
import { NEVER_MARK, PACK_ID, PACK_MARKS } from "@/engine/pack";
import { WEIGHING_ROWS } from "@/lib/demo-payloads";

async function requireTesterOwner(evaluationId: string) {
  const session = await auth();
  if (session?.user.role !== "TESTER") throw new Error("forbidden: tester only");
  const evaluation = await db.evaluation.findUniqueOrThrow({
    where: { id: evaluationId },
    include: { instrument: true },
  });
  if (evaluation.instrument.createdById !== session.user.id) {
    throw new Error("forbidden: not your instrument");
  }
  if (evaluation.reviewDecision !== "NONE") {
    throw new Error("forbidden: evaluation already decided");
  }
  return { session, evaluation };
}

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function weighRows(formData: FormData, prefix: string, count = WEIGHING_ROWS.length) {
  return Array.from({ length: count }, (_, i) => ({
    load: field(formData, `${prefix}.${i}.load`),
    indicated: field(formData, `${prefix}.${i}.indicated`),
    direction: i < count / 2 ? ("up" as const) : ("down" as const),
  })).filter((r) => r.load && r.indicated);
}

function objectIf(data: object) {
  return Object.values(data).some((v) => (typeof v === "string" ? v.length > 0 : Array.isArray(v) ? v.length > 0 : v != null))
    ? data
    : {};
}

export async function createEvaluationAction(instrumentId: string) {
  const session = await auth();
  if (session?.user.role !== "TESTER") throw new Error("forbidden: tester only");
  const instrument = await db.instrument.findUniqueOrThrow({ where: { id: instrumentId } });
  if (instrument.createdById !== session.user.id) throw new Error("forbidden: not your instrument");

  const evaluation = await db.evaluation.create({
    data: {
      instrumentId,
      packId: PACK_ID,
      procedures: {
        create: Object.values(ProcedureKey).map((key) => ({
          key,
          status: "EMPTY" as const,
          payloadJson: {},
        })),
      },
    },
  });

  redirect(`/evaluations/${evaluation.id}/observations`);
}

export type SaveObservationsState = { error: string | null };

export async function saveObservationsAction(
  evaluationId: string,
  _prev: SaveObservationsState,
  formData: FormData,
): Promise<SaveObservationsState> {
  await requireTesterOwner(evaluationId);

  const tempC = field(formData, "tempC") || null;
  const rhPct = field(formData, "rhPct") || null;
  const observer = field(formData, "observer") || null;

  const extras = {
    TARE: objectIf({ rows: weighRows(formData, "tare") }),
    DISCRIMINATION: objectIf({
      indicatedBefore: field(formData, "disc.before"),
      indicatedAfter: field(formData, "disc.after"),
      extraLoad: field(formData, "disc.extra"),
    }),
    SENSITIVITY: objectIf({
      indicatedBefore: field(formData, "sens.before"),
      indicatedAfter: field(formData, "sens.after"),
      extraLoad: field(formData, "sens.extra"),
    }),
    ZERO_RETURN: objectIf({ residual: field(formData, "zero.residual") }),
    CREEP: objectIf({
      load: field(formData, "creep.load"),
      i0: field(formData, "creep.i0"),
      i15: field(formData, "creep.i15"),
      i30: field(formData, "creep.i30"),
    }),
    STABILITY: objectIf({ i1: field(formData, "stab.i1"), i2: field(formData, "stab.i2") }),
    TILT: objectIf({
      noLoadLevel: field(formData, "tilt.noLoadLevel"),
      noLoadTilt: field(formData, "tilt.noLoadTilt"),
      load: field(formData, "tilt.load"),
      indicatedTilt: field(formData, "tilt.indicatedTilt"),
    }),
    WARMUP: objectIf({
      zeros: [0, 1, 2].map((i) => field(formData, `warmup.zero.${i}`)).filter(Boolean),
      load: field(formData, "warmup.load"),
      indicated: [0, 1].map((i) => field(formData, `warmup.ind.${i}`)).filter(Boolean),
    }),
    VOLTAGE: objectIf({
      rows: [0, 1, 2, 3, 4, 5]
        .map((i) => ({
          voltage: field(formData, `volt.${i}.voltage`),
          load: field(formData, `volt.${i}.load`),
          indicated: field(formData, `volt.${i}.indicated`),
        }))
        .filter((r) => r.voltage && r.load && r.indicated),
    }),
    TEMP_NOLOAD: objectIf({
      readings: [0, 1, 2]
        .map((i) => ({
          tempC: field(formData, `tnl.${i}.tempC`),
          zero: field(formData, `tnl.${i}.zero`),
        }))
        .filter((r) => r.tempC && r.zero),
    }),
    DAMP_HEAT: objectIf({ rows: weighRows(formData, "damp") }),
    SPAN_STABILITY: objectIf({
      indications: [0, 1, 2].map((i) => field(formData, `span.${i}`)).filter(Boolean),
    }),
    ENDURANCE: objectIf({
      before: { rows: weighRows(formData, "end.before", 4) },
      after: { rows: weighRows(formData, "end.after", 4) },
    }),
    ROLLING_ECC: objectIf({
      trueLoad: field(formData, "roll.trueLoad"),
      positions: Object.fromEntries(
        ["A", "B", "C", "D", "E", "F"]
          .map((pos) => [pos, field(formData, `roll.${pos}`)] as const)
          .filter(([, v]) => v),
      ),
    }),
  };

  const eccPositions: Record<string, string> = {};
  for (const pos of ["A", "B", "C", "D"]) {
    const v = field(formData, `ecc.${pos}`);
    if (v) eccPositions[pos] = v;
  }

  await db.$transaction(async (tx) => {
    await tx.evaluation.update({ where: { id: evaluationId }, data: { tempC, rhPct, observer } });
    await tx.procedure.updateMany({
      where: { evaluationId, key: "WEIGHING" },
      data: { payloadJson: objectIf({ rows: weighRows(formData, "weighing") }) },
    });
    await tx.procedure.updateMany({
      where: { evaluationId, key: "REPEATABILITY" },
      data: {
        payloadJson: objectIf({
          trueLoad: field(formData, "repeat.trueLoad"),
          indications: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => field(formData, `repeat.${i}`)).filter(Boolean),
        }),
      },
    });
    await tx.procedure.updateMany({
      where: { evaluationId, key: "ECCENTRICITY" },
      data: { payloadJson: objectIf({ trueLoad: field(formData, "ecc.trueLoad"), positions: eccPositions }) },
    });

    for (const [key, payloadJson] of Object.entries(extras)) {
      await tx.procedure.updateMany({
        where: { evaluationId, key: key as ProcedureKey },
        data: { payloadJson },
      });
    }

    for (const key of NEVER_MARK) {
      const entered = formData.get(`entered.${key}`) === "on";
      const note = field(formData, `note.${key}`);
      await tx.procedure.updateMany({
        where: { evaluationId, key },
        data: {
          status: entered ? "ENTERED_NOT_MARKED" : "EMPTY",
          payloadJson: entered ? { note } : {},
        },
      });
    }
  });

  await markEvaluation(evaluationId);
  revalidatePath(`/evaluations/${evaluationId}`);
  redirect(`/evaluations/${evaluationId}/result`);
}

export async function remarkAction(evaluationId: string) {
  await requireTesterOwner(evaluationId);
  await markEvaluation(evaluationId);
  revalidatePath(`/evaluations/${evaluationId}/result`);
  redirect(`/evaluations/${evaluationId}/result`);
}

export type ReviewState = { error: string | null };

export async function reviewDecisionAction(
  evaluationId: string,
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const session = await auth();
  if (session?.user.role !== "REVIEWER") return { error: "Only a reviewer can decide." };

  const decision = field(formData, "decision");
  if (decision !== "GRANTED" && decision !== "REFUSED") return { error: "Pick Grant or Refuse." };

  if (decision === "GRANTED") {
    const procedures = await db.procedure.findMany({ where: { evaluationId } });
    const marks = procedures.filter((p) => (PACK_MARKS as readonly string[]).includes(p.key));
    const missing = PACK_MARKS.some((k) => !marks.find((p) => p.key === k));
    const blocked = missing || marks.some((p) => p.status !== "MARKED_PASS");
    if (blocked) {
      return { error: "cannot-grant: every numeric pack mark must be MARKED_PASS and present." };
    }
  }

  const reviewNote = field(formData, "reviewNote") || null;

  const updated = await db.evaluation.updateMany({
    where: { id: evaluationId, reviewDecision: "NONE" },
    data: {
      reviewDecision: decision,
      reviewNote,
      reviewerId: session.user.id,
      reviewedAt: new Date(),
      status: "COMPLETED",
    },
  });
  if (updated.count === 0) return { error: "Already decided." };

  revalidatePath(`/evaluations/${evaluationId}/result`);
  redirect(`/evaluations/${evaluationId}/result`);
}

export type AttachState = { error: string | null };

export async function uploadAttachmentAction(
  evaluationId: string,
  _prev: AttachState,
  formData: FormData,
): Promise<AttachState> {
  const session = await auth();
  if (!session?.user) return { error: "Sign in first." };
  const evaluation = await db.evaluation.findUnique({
    where: { id: evaluationId },
    include: { instrument: true },
  });
  if (!evaluation) return { error: "Evaluation not found." };
  const owner = session.user.role === "TESTER" && session.user.id === evaluation.instrument.createdById;
  if (!owner && session.user.role !== "REVIEWER") return { error: "Forbidden." };
  if (evaluation.reviewDecision !== "NONE" && session.user.role === "TESTER") {
    return { error: "This evaluation is already decided." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file." };
  if (file.size > 8 * 1024 * 1024) return { error: "File is over 8 MB." };

  const safe = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80) || "attachment";
  const dir = path.join(process.cwd(), "uploads", evaluationId);
  await mkdir(dir, { recursive: true });
  const stored = `${Date.now()}-${safe}`;
  await writeFile(path.join(dir, stored), Buffer.from(await file.arrayBuffer()));

  await db.attachment.create({
    data: {
      evaluationId,
      filename: file.name.slice(0, 120),
      path: path.join("uploads", evaluationId, stored),
      mime: file.type || "application/octet-stream",
    },
  });

  revalidatePath(`/evaluations/${evaluationId}/result`);
  return { error: null };
}

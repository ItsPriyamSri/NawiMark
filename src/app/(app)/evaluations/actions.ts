"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, ProcedureKey } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { markEvaluation } from "@/lib/mark";
import { grantable } from "@/lib/reports/explainer";
import { NEVER_MARK, PACK_ID } from "@/engine/pack";
import { DAMP_CONDITIONS, STATIC_CONDITIONS, WEIGHING_ROWS } from "@/lib/demo-payloads";

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

/** SELECT … FOR UPDATE on the evaluation row; save-and-mark and review decisions queue on it. */
async function lockEvaluation(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<Array<{ reviewDecision: string }>>`SELECT "reviewDecision" FROM "Evaluation" WHERE id = ${id} FOR UPDATE`;
  return rows[0] ?? null;
}

/** Every form value is trimmed and capped; readings and notes never need more. */
function field(formData: FormData, name: string, max = 200) {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

/** A reading is the displayed indication I plus ΔL (changeover-point method). */
function rd(formData: FormData, name: string) {
  return { i: field(formData, name), dL: field(formData, `${name}.dL`) };
}

function weighRows(formData: FormData, prefix: string, count = WEIGHING_ROWS.length, split = count / 2) {
  return Array.from({ length: count }, (_, i) => ({
    load: field(formData, `${prefix}.${i}.load`),
    indicated: rd(formData, `${prefix}.${i}.indicated`),
    direction: i < split ? ("up" as const) : ("down" as const),
  })).filter((r) => r.load || r.indicated.i || r.indicated.dL); // half rows stay → cannot-compute
}

function hasData(v: unknown): boolean {
  if (typeof v === "string") return v.length > 0;
  if (Array.isArray(v)) return v.some(hasData);
  if (v && typeof v === "object") return Object.values(v).some(hasData);
  return false;
}

function objectIf(data: object) {
  return hasData(data) ? data : {};
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
  const resolutionG = field(formData, "resolutionG") || null;

  const positions = (prefix: string, keys: string[]) =>
    Object.fromEntries(keys.map((pos) => [pos, rd(formData, `${prefix}.${pos}`)] as const).filter(([, v]) => v.i || v.dL));
  const range = (n: number) => Array.from({ length: n }, (_, i) => i);

  const payloads = {
    WEIGHING: objectIf({ rows: weighRows(formData, "weighing") }),
    REPEATABILITY: objectIf({
      series: [0, 1].map((s) => ({
        trueLoad: field(formData, `repeat.${s}.trueLoad`),
        indications: range(10)
          .map((i) => rd(formData, `repeat.${s}.${i}`))
          .filter((v) => v.i || v.dL),
      })),
    }),
    ECCENTRICITY: objectIf({
      trueLoad: field(formData, "ecc.trueLoad"),
      positions: positions("ecc", ["A", "B", "C", "D"]),
      zero: rd(formData, "ecc.zero"),
    }),
    ZERO_SETTING: objectIf({
      load: field(formData, "zeroset.load"),
      trials: range(5).map((i) => rd(formData, `zeroset.${i}`)),
    }),
    TARE: objectIf({
      notApplicable: field(formData, "waive.TARE", 300),
      tare: field(formData, "tare.value"),
      rows: weighRows(formData, "tare", 12, 6),
    }),
    TARE_SETTING: objectIf({
      notApplicable: field(formData, "waive.TARE_SETTING", 300),
      tare: field(formData, "tareset.tare"),
      load: field(formData, "tareset.load"),
      trials: range(5).map((i) => rd(formData, `tareset.${i}`)),
    }),
    DISCRIMINATION: objectIf({
      rows: range(3)
        .map((i) => ({
          load: field(formData, `disc.${i}.load`),
          before: field(formData, `disc.${i}.before`),
          after: field(formData, `disc.${i}.after`),
          extra: field(formData, `disc.${i}.extra`),
        }))
        .filter((r) => r.load || r.before || r.after),
    }),
    ZERO_RETURN: objectIf({ before: rd(formData, "zero.before"), after: rd(formData, "zero.after") }),
    CREEP: objectIf({
      load: field(formData, "creep.load"),
      i0: rd(formData, "creep.i0"),
      i15: rd(formData, "creep.i15"),
      i30: rd(formData, "creep.i30"),
      i240: rd(formData, "creep.i240"),
    }),
    STABILITY: objectIf({
      trials: range(5)
        .map((i) => ({
          printed: field(formData, `stab.${i}.printed`),
          min: field(formData, `stab.${i}.min`),
          max: field(formData, `stab.${i}.max`),
        }))
        .filter((t) => t.printed || t.min || t.max),
    }),
    TILT: objectIf({
      notApplicable: field(formData, "waive.TILT", 300),
      noLoad: { ref: rd(formData, "tilt.0.ref"), tilts: range(4).map((d) => rd(formData, `tilt.0.t${d}`)) },
      loads: [1, 2]
        .map((i) => ({
          load: field(formData, `tilt.${i}.load`),
          ref: rd(formData, `tilt.${i}.ref`),
          tilts: range(4).map((d) => rd(formData, `tilt.${i}.t${d}`)),
        }))
        .filter((l) => l.load || l.ref.i || l.tilts.some((t) => t.i)),
    }),
    WARMUP: objectIf({
      load: field(formData, "warmup.load"),
      rows: [0, 5, 15, 30]
        .map((minute, i) => ({
          minute: String(minute),
          zero: rd(formData, `warmup.${i}.zero`),
          loaded: rd(formData, `warmup.${i}.loaded`),
        }))
        .filter((r) => r.zero.i || r.loaded.i),
    }),
    VOLTAGE: objectIf({
      rows: range(6)
        .map((i) => ({
          voltage: field(formData, `volt.${i}.voltage`),
          load: field(formData, `volt.${i}.load`),
          indicated: rd(formData, `volt.${i}.indicated`),
        }))
        .filter((r) => r.voltage || r.load || r.indicated.i),
    }),
    TEMP_NOLOAD: objectIf({
      readings: range(5)
        .map((i) => ({ tempC: field(formData, `tnl.${i}.tempC`), zero: rd(formData, `tnl.${i}.zero`) }))
        .filter((r) => r.tempC || r.zero.i),
    }),
    DAMP_HEAT: objectIf({
      conditions: DAMP_CONDITIONS.map((label, c) => ({
        label,
        tempC: field(formData, `damp.${c}.tempC`),
        rhPct: field(formData, `damp.${c}.rhPct`),
        rows: weighRows(formData, `damp.${c}`, 10, 5),
      })),
    }),
    STATIC_TEMP: objectIf({
      conditions: range(5).map((c) => ({
        label: STATIC_CONDITIONS[c],
        tempC: field(formData, `st.${c}.tempC`),
        rows: weighRows(formData, `st.${c}`, 10, 5),
      })),
    }),
    SPAN_STABILITY: objectIf({
      load: field(formData, "span.load"),
      indications: range(8)
        .map((i) => rd(formData, `span.${i}`))
        .filter((v) => v.i || v.dL),
    }),
    ENDURANCE: objectIf({
      before: { rows: weighRows(formData, "end.before", 5, 5) },
      after: { rows: weighRows(formData, "end.after", 5, 5) },
    }),
    ROLLING_ECC: objectIf({
      notApplicable: field(formData, "waive.ROLLING_ECC", 300),
      trueLoad: field(formData, "roll.trueLoad"),
      positions: positions("roll", ["A", "B", "C", "D", "E", "F"]),
    }),
  };

  const decided = await db.$transaction(async (tx) => {
    const locked = await lockEvaluation(tx, evaluationId);
    if (!locked || locked.reviewDecision !== "NONE") return true;
    await tx.evaluation.update({ where: { id: evaluationId }, data: { tempC, rhPct, observer, resolutionG } });

    for (const [key, payloadJson] of Object.entries(payloads)) {
      await tx.procedure.updateMany({
        where: { evaluationId, key: key as ProcedureKey },
        data: { payloadJson },
      });
    }

    for (const key of NEVER_MARK) {
      const entered = formData.get(`entered.${key}`) === "on";
      const note = field(formData, `note.${key}`, 500);
      await tx.procedure.updateMany({
        where: { evaluationId, key },
        data: {
          status: entered ? "ENTERED_NOT_MARKED" : "EMPTY",
          payloadJson: entered ? { note } : {},
        },
      });
    }
    await markEvaluation(evaluationId, tx);
    return false;
  }, { timeout: 30000 });
  if (decided) return { error: "This evaluation was decided while you were editing; nothing was saved." };

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

  const reviewNote = field(formData, "reviewNote", 500) || null;

  // One transaction holding the evaluation row lock: a tester's save-and-mark
  // (same lock) cannot land between the re-mark, the Grant check and the decision.
  const error = await db.$transaction(
    async (tx) => {
      const locked = await lockEvaluation(tx, evaluationId);
      if (!locked) return "Evaluation not found.";
      if (locked.reviewDecision !== "NONE") return "Already decided.";
      if (decision === "GRANTED") {
        // Re-mark first: Grant rests on the current pack and the latest readings.
        const { procedures } = await markEvaluation(evaluationId, tx);
        if (!grantable(procedures)) return "cannot-grant: every applicable numeric pack mark must be MARKED_PASS.";
      }
      await tx.evaluation.update({
        where: { id: evaluationId },
        data: { reviewDecision: decision, reviewNote, reviewerId: session.user.id, reviewedAt: new Date(), status: "COMPLETED" },
      });
      return null;
    },
    { timeout: 30000 },
  );
  if (error) return { error };

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

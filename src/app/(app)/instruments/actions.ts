"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Decimal } from "decimal.js";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateInstrument, type AccuracyClass } from "@/engine/r76";

export type CreateInstrumentState = { error: string | null };

const CLASSES: AccuracyClass[] = ["I", "II", "III", "IIII"];

export async function createInstrumentAction(
  _prev: CreateInstrumentState,
  formData: FormData,
): Promise<CreateInstrumentState> {
  const session = await auth();
  if (session?.user.role !== "TESTER") return { error: "Only a tester can add instruments." };

  const manufacturer = String(formData.get("manufacturer") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const class_ = String(formData.get("class") ?? "") as AccuracyClass;
  const maxG = String(formData.get("maxG") ?? "").trim();
  const eG = String(formData.get("eG") ?? "").trim();

  if (!manufacturer || !model || !CLASSES.includes(class_) || !maxG || !eG) {
    return { error: "All fields are required." };
  }

  let n: number;
  try {
    n = validateInstrument(class_, new Decimal(maxG), new Decimal(eG));
  } catch (err) {
    // cannot-compute: the "try junk" path (e.g. class III, e=1) lands here —
    // rejected before it ever reaches the database.
    return { error: err instanceof Error ? err.message : "cannot-compute" };
  }

  const instrument = await db.instrument.create({
    data: { manufacturer, model, class: class_, maxG, eG, n, createdById: session.user.id },
  });

  revalidatePath("/instruments");
  redirect(`/instruments/${instrument.id}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Decimal } from "decimal.js";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { minCapacityLowerLimit, validateInstrument, type AccuracyClass } from "@/engine/r76";

export type CreateInstrumentState = { error: string | null; values?: Record<string, string> };

const FIELDS = ["manufacturer", "model", "class", "maxG", "eG", "minG", "unomV", "serialNo", "specs"];

const CLASSES: AccuracyClass[] = ["I", "II", "III", "IIII"];

export async function createInstrumentAction(
  _prev: CreateInstrumentState,
  formData: FormData,
): Promise<CreateInstrumentState> {
  const session = await auth();
  if (session?.user.role !== "TESTER") return { error: "Only a tester can add instruments." };

  // Echo the input back on error: React 19 resets the form after every action.
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(formData.get(k) ?? "")]));
  const fail = (error: string): CreateInstrumentState => ({ error, values });
  const manufacturer = String(formData.get("manufacturer") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const class_ = String(formData.get("class") ?? "") as AccuracyClass;
  const maxG = String(formData.get("maxG") ?? "").trim();
  const eG = String(formData.get("eG") ?? "").trim();

  if (!manufacturer || !model || !CLASSES.includes(class_) || !maxG || !eG) {
    return fail("All fields are required.");
  }

  const optional = (name: string, max = 120) => String(formData.get(name) ?? "").trim().slice(0, max) || null;
  const serialNo = optional("serialNo");
  const minG = optional("minG", 20);
  const unomV = optional("unomV", 20);
  const specs = optional("specs", 1000);
  if (manufacturer.length > 120 || model.length > 120) return fail("Manufacturer and model must be under 120 characters.");

  let n: number;
  try {
    const e = new Decimal(eG);
    n = validateInstrument(class_, new Decimal(maxG), e);
    if (n > 2_000_000_000) return fail("n = Max/e is too large to record.");
    if (minG && new Decimal(minG).gte(new Decimal(maxG))) return fail("Min must be below Max.");
    if (minG) {
      const lower = minCapacityLowerLimit(class_, e);
      if (new Decimal(minG).lt(lower)) {
        return fail(`Min ${minG} g is below the Table 3 lower limit for class ${class_} (${lower} g).`);
      }
    }
    if (unomV && !new Decimal(unomV).gt(0)) return fail("Nominal voltage must be a positive number.");
  } catch (err) {
    // cannot-compute: the "try junk" path (e.g. class III, e=1) lands here —
    // rejected before it ever reaches the database. A non-number also lands here.
    const msg = err instanceof Error ? err.message : "cannot-compute";
    return fail(msg.startsWith("cannot-compute") ? msg : "Max, e, Min and voltage must be numbers.");
  }

  const instrument = await db.instrument.create({
    data: { manufacturer, model, class: class_, maxG, eG, n, serialNo, minG, unomV, specs, createdById: session.user.id },
  });

  revalidatePath("/instruments");
  redirect(`/instruments/${instrument.id}`);
}

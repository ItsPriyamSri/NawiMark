/**
 * Mocked demo fixture. Default evaluation is the product USP: eccentricity
 * fails 11 g vs allowed 10 g on the initial band. A second evaluation on the
 * same instrument passes every numeric mark so Grant can be shown. An illegal
 * instrument is persisted so cannot-compute is visible — UI create still rejects it.
 */
import { hash } from "bcryptjs";
import { Decimal } from "decimal.js";
import { PrismaClient, ProcedureKey } from "@prisma/client";
import { PACK_ID } from "../src/engine/pack";
import { validateInstrument } from "../src/engine/r76";
import { ECC_NEAR_MISS, ECC_PASS, REPEAT_PASS, WEIGHING_ROWS, extraNumericPayloads } from "../src/lib/demo-payloads";

const db = new PrismaClient();

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} env var is required to seed users`);
  return v;
}
const DEMO_PASSWORD = requireEnv("DEMO_PASSWORD");

const NEVER: ProcedureKey[] = ["EMC", "CONSTRUCTION", "CHECKLIST"];

function numericCreates(ecc: typeof ECC_NEAR_MISS | typeof ECC_PASS) {
  const extra = extraNumericPayloads();
  return [
    { key: "WEIGHING" as const, status: "ENTERED_NOT_MARKED" as const, payloadJson: { rows: WEIGHING_ROWS } },
    { key: "REPEATABILITY" as const, status: "ENTERED_NOT_MARKED" as const, payloadJson: REPEAT_PASS },
    { key: "ECCENTRICITY" as const, status: "ENTERED_NOT_MARKED" as const, payloadJson: ecc },
    ...Object.entries(extra).map(([key, payloadJson]) => ({
      key: key as ProcedureKey,
      status: "ENTERED_NOT_MARKED" as const,
      payloadJson,
    })),
    ...NEVER.map((key) => ({
      key,
      status: "ENTERED_NOT_MARKED" as const,
      payloadJson: { note: "Mocked inspector ticks only. Not marked. Never auto-PASS." },
    })),
  ];
}

async function main() {
  await db.procedure.deleteMany();
  await db.attachment.deleteMany();
  await db.evaluation.deleteMany();
  await db.instrument.deleteMany();

  const passwordHash = await hash(DEMO_PASSWORD, 10);

  const tester = await db.user.upsert({
    where: { email: "tester@nawimark.local" },
    update: { passwordHash, role: "TESTER" },
    create: { email: "tester@nawimark.local", role: "TESTER", passwordHash },
  });
  await db.user.upsert({
    where: { email: "reviewer@nawimark.local" },
    update: { passwordHash, role: "REVIEWER" },
    create: { email: "reviewer@nawimark.local", role: "REVIEWER", passwordHash },
  });

  const legalN = validateInstrument("III", new Decimal("30000"), new Decimal("10"));

  const instrument = await db.instrument.create({
    data: {
      manufacturer: "DemoCo",
      model: "NW-30",
      class: "III",
      maxG: "30000",
      eG: "10",
      n: legalN,
      createdById: tester.id,
    },
  });

  try {
    validateInstrument("III", new Decimal("30000"), new Decimal("1"));
    throw new Error("expected validateInstrument to reject class III e=1 (n=30000)");
  } catch (err) {
    if (!(err instanceof Error) || !err.message.startsWith("cannot-compute")) throw err;
    console.log(`illegal n correctly rejected by engine: ${err.message}`);
  }

  const junk = await db.instrument.create({
    data: {
      manufacturer: "JunkScale",
      model: "ILLEGAL-n",
      class: "III",
      maxG: "30000",
      eG: "1",
      n: 30000,
      createdById: tester.id,
    },
  });

  const failEval = await db.evaluation.create({
    data: {
      instrumentId: instrument.id,
      packId: PACK_ID,
      tempC: "20",
      rhPct: "50",
      observer: "Demo",
      procedures: { create: numericCreates(ECC_NEAR_MISS) },
    },
  });

  const passEval = await db.evaluation.create({
    data: {
      instrumentId: instrument.id,
      packId: PACK_ID,
      tempC: "20",
      rhPct: "50",
      observer: "Demo",
      procedures: { create: numericCreates(ECC_PASS) },
    },
  });

  const junkEval = await db.evaluation.create({
    data: {
      instrumentId: junk.id,
      packId: PACK_ID,
      tempC: "20",
      rhPct: "50",
      observer: "Demo",
      procedures: {
        create: Object.values(ProcedureKey).map((key) => ({
          key,
          status: "EMPTY" as const,
          payloadJson: {},
        })),
      },
    },
  });

  const { markEvaluation } = await import("../src/lib/mark");
  await markEvaluation(failEval.id);
  await markEvaluation(passEval.id);
  await markEvaluation(junkEval.id);

  console.log(`seeded: tester/reviewer, NW-30 + illegal n, fail ${failEval.id}, pass ${passEval.id}, junk ${junkEval.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

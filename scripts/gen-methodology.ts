/**
 * Generates METHODOLOGY.md straight from the pack's own constants — not
 * hand-written prose, so the doc can't drift from what engine/r76.ts and
 * src/engine/pack.ts actually compute. Run: npx tsx scripts/gen-methodology.ts
 */
import { writeFileSync } from "node:fs";
import { TABLE6 } from "../src/engine/r76";
import { NEVER_MARK, PACK_ID, PACK_MARKS, RH_MAX, RH_MIN, TEMP_MAX, TEMP_MIN } from "../src/engine/pack";
import { CLAUSES } from "../src/lib/reports/explainer";

function table6Rows(): string {
  const lines = ["| Class | Load band (in e) | MPE (in e) |", "|---|---|---|"];
  for (const [class_, bands] of Object.entries(TABLE6)) {
    let lo = 0;
    for (const [cap, mpe] of bands) {
      const band = cap === null ? `> ${lo}` : `${lo}–${cap}`;
      lines.push(`| ${class_} | ${band} | ±${mpe} |`);
      if (cap !== null) lo = cap;
    }
  }
  return lines.join("\n");
}

const lines: string[] = [];
lines.push("# Calculation methodology");
lines.push("");
lines.push("Generated from `" + PACK_ID + "` (`src/engine/pack.ts`, `src/engine/r76.ts`).");
lines.push("Table 6 and the procedure list come from those files. Clause strings are the hand-written map in `src/lib/reports/explainer.ts`.");
lines.push("Regenerate: `pnpm exec tsx scripts/gen-methodology.ts`.");
lines.push("");
lines.push("## MPE — OIML R 76-1 Table 6, initial / type evaluation");
lines.push("");
lines.push("Absolute MPE = (MPE in e) × e, picked by which load band `load / e` falls into.");
lines.push("This is the **initial** (type-evaluation) band, never the 2× in-service band.");
lines.push("");
lines.push(table6Rows());
lines.push("");
lines.push("## Procedures this pack computes");
lines.push("");
for (const key of PACK_MARKS) {
  lines.push(`- **${key}** — ${CLAUSES[key] ?? "clause not set"}`);
}
lines.push("");
lines.push(
  "Never auto-PASS: " +
    NEVER_MARK.join(", ") +
    ". Those sections are forms with a status only — `entered, not marked` or `not entered`.",
);
lines.push("");
lines.push("## Lab environment band (pack v1)");
lines.push("");
lines.push(`- Temperature: ${TEMP_MIN}°C to ${TEMP_MAX}°C`);
lines.push(`- Relative humidity: ${RH_MIN}% to ${RH_MAX}%`);
lines.push("");
lines.push("Outside this band, or an instrument that fails Table 3's n = Max/e bounds, the affected procedures are marked `cannot-compute` and no PDF/Word report is produced.");
lines.push("");
lines.push("## Architecture");
lines.push("");
lines.push("One Next.js App Router monolith. Postgres holds instruments, evaluations, procedures, attachments. Pass/fail is a pure function (`src/engine/r76.ts`, ported from the Python oracle `engine/r76.py`) — no LLM ever decides or narrates a result. `src/lib/mark.ts` is the only place `payloadJson` becomes `resultJson`; `src/lib/reports/explainer.ts` turns `resultJson` into the same bullets shown on screen, in the PDF, and in the Word export.");
lines.push("");
lines.push("## Deployment");
lines.push("");
lines.push("Single host. Env vars in `.env` (see `.env.example`): `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` (production only), `DEMO_PASSWORD`. `pnpm exec prisma migrate deploy` then `pnpm exec prisma db seed` on first boot.");
lines.push("");

writeFileSync(new URL("../METHODOLOGY.md", import.meta.url), lines.join("\n") + "\n");
console.log("wrote METHODOLOGY.md");

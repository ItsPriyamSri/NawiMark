/**
 * Generates METHODOLOGY.md straight from the pack's own constants — not
 * hand-written prose, so the doc can't drift from what engine/r76.ts and
 * src/engine/pack.ts actually compute. Run: npx tsx scripts/gen-methodology.ts
 */
import { writeFileSync } from "node:fs";
import { TABLE6 } from "../src/engine/r76";
import { NEVER_MARK, PACK_ID, PACK_MARKS, PROCEDURE_LABELS, RH_MAX, RH_MIN, TEMP_MAX, TEMP_MIN } from "../src/engine/pack";
import { CLAUSES } from "../src/lib/reports/explainer";

// Hand-written, one line per mark; each is the limit src/engine/r76.ts applies.
const LIMITS: Record<(typeof PACK_MARKS)[number], string> = {
  WEIGHING: "≥10 loads incl. Max, up and down; abs(E0) ≤ 0.25e; each abs(Ec) ≤ MPE",
  ZERO_SETTING: "each abs(E0) after zero-setting ≤ 0.25e",
  TARE_SETTING: "each abs(E0) after taring ≤ 0.25e",
  STATIC_TEMP: "20 °C, high, low, 5 °C if low ≤ 0 °C, 20 °C; ≥5 loads each; each abs(Ec) ≤ MPE",
  ECCENTRICITY: "load Max/3 ±2 % (no additive tare); abs(E0) ≤ 0.25e; each corner abs(Ec) ≤ MPE",
  REPEATABILITY: "two series (40–60 % Max, ≥ 90 % Max), 10 each if Max < 1000 kg; Pmax − Pmin ≤ MPE and each abs(E) ≤ MPE",
  TARE: "tare value T recorded; ≥5 net loads, net + T ≤ Max; each abs(Ec) ≤ MPE of the net load",
  DISCRIMINATION: "three loads; extra 1.4d raises the indication by ≥ d",
  SENSITIVITY: "not applicable to digital self-indicating instruments",
  ZERO_RETURN: "abs(P30 − P0) ≤ 0.5e",
  CREEP: "load ≥ 90 % Max; 30-min change ≤ 0.5e and 15→30 min ≤ 0.2e; else 4 h change ≤ abs(MPE)",
  STABILITY: "five trials; printed value and 5 s readings within 1e",
  TILT: "forward, backward, left, right; no load ≤ 2e (not class II); two loads (one ≥ 90 % Max), abs(tilted − reference) ≤ MPE",
  WARMUP: "load ≥ 90 % Max; 0/5/15/30 min; abs(EL − E0) ≤ abs(MPE)",
  VOLTAGE: "Unom recorded; readings at 0.85 and 1.10 Unom (AC mains); loads 10e and one in [½ Max, Max]; each abs(E) ≤ MPE",
  TEMP_NOLOAD: "zero change per 5 °C (1 °C class I) ≤ e, consecutive temperatures",
  DAMP_HEAT: "reference, high temperature at 85 % RH, reference; ≥5 loads each; each abs(Ec) ≤ MPE",
  SPAN_STABILITY: "load ≥ 90 % Max; ≥8 measurements; each abs(E) ≤ MPE; variation ≤ max(½e, ½ abs(MPE))",
  ENDURANCE: "same ≥5 loads before/after; abs(E after − E before) ≤ abs(MPE)",
  ROLLING_ECC: "≥3 positions, load ≤ 0.8 Max; each abs(Ec) ≤ MPE",
};

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
lines.push("## Errors: rounding elimination and zero correction");
lines.push("");
lines.push("Each reading is the displayed indication I plus ΔL, the additional load at which the display steps up by one e (R 76-1:2006 A.4.4.3):");
lines.push("");
lines.push("- P = I + ½e − ΔL (indication prior to rounding), E = P − L, Ec = E − E0 where a zero error E0 is recorded.");
lines.push("- Every evaluation records the **resolution during test** (R 76-2 header). Above 0.2e, R 76-1 3.5.3.2 requires rounding elimination, so a reading without ΔL is `cannot-compute`. At 0.2e or finer, P = I.");
lines.push("");
lines.push("## Procedures this pack computes");
lines.push("");
lines.push("| Procedure | Clause | Limit used |");
lines.push("|---|---|---|");
for (const key of PACK_MARKS) {
  lines.push(`| ${PROCEDURE_LABELS[key]} | ${CLAUSES[key] ?? "clause not set"} | ${LIMITS[key]} |`);
}
lines.push("");
lines.push(
  "Not applicable (automatic, from R 76-1 scope notes): sensitivity (6.1, non-self-indicating only); creep and zero return for class I (3.9.4); tilt for class I (3.9.1.2); endurance for class I or Max > 100 kg (A.6); span stability for class I (B.4); damp heat for class I or class II with e < 1 g (B.2); digital discrimination below d = 5 mg (A.4.8.2). The tester may declare rolling-load eccentricity, tilt, tare weighing and tare setting not applicable with a written reason (at least 10 characters), shown to the reviewer and printed on the report.",
);
lines.push("");
lines.push(
  "Never auto-PASS: " +
    NEVER_MARK.join(", ") +
    ". Those sections are forms with a status only — `entered, not marked` or `not entered`.",
);
lines.push("");
lines.push("Grant needs every applicable numeric mark to be PASS. A FAIL, a cannot-compute, or an empty sheet blocks it, on the page and in the server action.");
lines.push("");
lines.push("## Instrument validation (Table 3)");
lines.push("");
lines.push("n = Max/e must be an integer inside the Table 3 row for the class and e (for example class III: 100–10 000 for 0.1 g ≤ e ≤ 2 g, 500–10 000 for e ≥ 5 g). Min, when entered, must be at least the Table 3 lower limit (e.g. 20e for class III).");
lines.push("");
lines.push("## Known limits");
lines.push("");
lines.push("- Single-interval, single-range instruments only (no e1/ei rules for multi-interval or multiple-range).");
lines.push("- d = e assumed. Discrimination uses the digital rule (3.8.2.2).");
lines.push("- Creep samples the 30-min change at 15 and 30 min; the 4 h path takes the reading furthest from the first.");
lines.push("- \"About ½ Max\" is read as 40–60 % of Max and \"close to Max\" as ≥ 90 % of Max. The standard gives no number; these are pack tolerances.");
lines.push("- Voltage limits are the AC mains ones (3.9.3); battery and vehicle supplies (A.5.4.2–A.5.4.4) are not modelled.");
lines.push("- Span stability uses E, not EL − E0, and does not average the first measurement's five readings.");
lines.push("- EMC (B.3), construction examination and the software checklist are recorded, never marked.");
lines.push("");
lines.push("## Lab environment band");
lines.push("");
lines.push(`- Temperature: ${TEMP_MIN}°C to ${TEMP_MAX}°C`);
lines.push(`- Relative humidity: ${RH_MIN}% to ${RH_MAX}%`);
lines.push("");
lines.push("Outside this band, or an instrument that fails Table 3's n = Max/e bounds, the affected procedures are marked `cannot-compute` and no PDF/Word report is produced.");
lines.push("");
lines.push("## Architecture");
lines.push("");
lines.push("One Next.js App Router monolith. Postgres holds instruments, evaluations, procedures, attachments. Pass/fail is a pure function (`src/engine/r76.ts`; Table 6, Table 3, repeatability and eccentricity are cross-checked by the Python oracle `engine/r76.py` / `engine/check.py`) — no LLM ever decides or narrates a result. `src/lib/mark.ts` is the only place `payloadJson` becomes `resultJson`; `src/lib/reports/explainer.ts` turns `resultJson` into the same bullets shown on screen, in the PDF, and in the Word export.");
lines.push("");
lines.push("## Deployment");
lines.push("");
lines.push("Single host. Env vars in `.env` (see `.env.example`): `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` (production only), `DEMO_PASSWORD`. `pnpm exec prisma migrate deploy` then `pnpm exec prisma db seed` on first boot.");
lines.push("");

writeFileSync(new URL("../METHODOLOGY.md", import.meta.url), lines.join("\n") + "\n");
console.log("wrote METHODOLOGY.md");

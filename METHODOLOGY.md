# Calculation methodology

Generated from `R-76 pack v2` (`src/engine/pack.ts`, `src/engine/r76.ts`).
Table 6 and the procedure list come from those files. Clause strings are the hand-written map in `src/lib/reports/explainer.ts`.
Regenerate: `pnpm exec tsx scripts/gen-methodology.ts`.

## MPE — OIML R 76-1 Table 6, initial / type evaluation

Absolute MPE = (MPE in e) × e, picked by which load band `load / e` falls into.
This is the **initial** (type-evaluation) band, never the 2× in-service band.

| Class | Load band (in e) | MPE (in e) |
|---|---|---|
| I | 0–50000 | ±0.5 |
| I | 50000–200000 | ±1 |
| I | > 200000 | ±1.5 |
| II | 0–5000 | ±0.5 |
| II | 5000–20000 | ±1 |
| II | 20000–100000 | ±1.5 |
| III | 0–500 | ±0.5 |
| III | 500–2000 | ±1 |
| III | 2000–10000 | ±1.5 |
| IIII | 0–50 | ±0.5 |
| IIII | 50–200 | ±1 |
| IIII | 200–1000 | ±1.5 |

## Errors: rounding elimination and zero correction

Each reading is the displayed indication I plus ΔL, the additional load at which the display steps up by one e (R 76-1:2006 A.4.4.3):

- P = I + ½e − ΔL (indication prior to rounding), E = P − L, Ec = E − E0 where a zero error E0 is recorded.
- Every evaluation records the **resolution during test** (R 76-2 header). Above 0.2e, R 76-1 3.5.3.2 requires rounding elimination, so a reading without ΔL is `cannot-compute`. At 0.2e or finer, P = I.

## Procedures this pack computes

| Procedure | Clause | Limit used |
|---|---|---|
| Weighing performance | OIML R 76-1 3.5.1 Table 6 / A.4.4.1 (weighing test) | ≥10 loads incl. Max, up and down; abs(E0) ≤ 0.25e; each abs(Ec) ≤ MPE |
| Accuracy of zero-setting | OIML R 76-1 4.5.2 / A.4.2.3 (accuracy of zero-setting) | each abs(E0) after zero-setting ≤ 0.25e |
| Eccentricity (4-corner) | OIML R 76-1 3.6.2 / 3.6.2.1 / A.4.7 (eccentricity) | load Max/3 ±2 % (no additive tare); abs(E0) ≤ 0.25e; each corner abs(Ec) ≤ MPE |
| Repeatability | OIML R 76-1 3.6.1 / A.4.10 (repeatability) | two series (40–60 % Max, ≥ 90 % Max), 10 each if Max < 1000 kg; Pmax − Pmin ≤ MPE and each abs(E) ≤ MPE |
| Tare weighing | OIML R 76-1 3.5.3.3 / A.4.6.1 (tare weighing test) | tare value T recorded; ≥5 net loads, net + T ≤ Max; each abs(Ec) ≤ MPE of the net load |
| Accuracy of tare setting | OIML R 76-1 4.6.3 / A.4.6.2 (accuracy of tare setting) | each abs(E0) after taring ≤ 0.25e |
| Discrimination (digital) | OIML R 76-1 3.8.2.2 / A.4.8.2 (discrimination, digital) | three loads; extra 1.4d raises the indication by ≥ d |
| Sensitivity (non-self-indicating) | OIML R 76-1 6.1 / A.4.9 (sensitivity, non-self-indicating) | not applicable to digital self-indicating instruments |
| Zero return | OIML R 76-1 3.9.4.2 / A.4.11.2 (zero return) | abs(P30 − P0) ≤ 0.5e |
| Creep | OIML R 76-1 3.9.4.1 / A.4.11.1 (creep) | load ≥ 90 % Max; 30-min change ≤ 0.5e and 15→30 min ≤ 0.2e; else 4 h change ≤ abs(MPE) |
| Stability of equilibrium | OIML R 76-1 4.4.2 / A.4.12 (stability of equilibrium) | five trials; printed value and 5 s readings within 1e |
| Tilt | OIML R 76-1 3.9.1.1 / A.5.1 (tilting) | forward, backward, left, right; no load ≤ 2e (not class II); two loads (one ≥ 90 % Max), abs(tilted − reference) ≤ MPE |
| Warm-up time | OIML R 76-1 5.3.5 / A.5.2 (warm-up time) | load ≥ 90 % Max; 0/5/15/30 min; abs(EL − E0) ≤ abs(MPE) |
| Voltage variations | OIML R 76-1 3.9.3 / A.5.4 (voltage variations) | Unom recorded; readings at 0.85 and 1.10 Unom (AC mains); loads 10e and one in [½ Max, Max]; each abs(E) ≤ MPE |
| Static temperatures | OIML R 76-1 3.9.2.1 / A.5.3.1 (static temperatures) | 20 °C, high, low, 5 °C if low ≤ 0 °C, 20 °C; ≥5 loads each; each abs(Ec) ≤ MPE |
| Temperature effect on no-load | OIML R 76-1 3.9.2.3 / A.5.3.2 (temperature effect on no-load) | zero change per 5 °C (1 °C class I) ≤ e, consecutive temperatures |
| Damp heat, steady state | OIML R 76-1 5.3.2 / B.2 (damp heat, steady state) | reference, high temperature at 85 % RH, reference; ≥5 loads each; each abs(Ec) ≤ MPE |
| Span stability | OIML R 76-1 5.3.3 / B.4 (span stability) | load ≥ 90 % Max; ≥8 measurements; each abs(E) ≤ MPE; variation ≤ max(½e, ½ abs(MPE)) |
| Endurance | OIML R 76-1 3.9.4.3 / A.6 (endurance) | same ≥5 loads before/after; abs(E after − E before) ≤ abs(MPE) |
| Rolling-load eccentricity | OIML R 76-1 3.6.2.4 / A.4.7.4 (rolling loads) | ≥3 positions, load ≤ 0.8 Max; each abs(Ec) ≤ MPE |

Not applicable (automatic, from R 76-1 scope notes): sensitivity (6.1, non-self-indicating only); creep and zero return for class I (3.9.4); tilt for class I (3.9.1.2); endurance for class I or Max > 100 kg (A.6); span stability for class I (B.4); damp heat for class I or class II with e < 1 g (B.2); digital discrimination below d = 5 mg (A.4.8.2). The tester may declare rolling-load eccentricity, tilt, tare weighing and tare setting not applicable with a written reason (at least 10 characters), shown to the reviewer and printed on the report.

Never auto-PASS: EMC, CONSTRUCTION, CHECKLIST. Those sections are forms with a status only — `entered, not marked` or `not entered`.

Grant needs every applicable numeric mark to be PASS. A FAIL, a cannot-compute, or an empty sheet blocks it, on the page and in the server action.

## Instrument validation (Table 3)

n = Max/e must be an integer inside the Table 3 row for the class and e (for example class III: 100–10 000 for 0.1 g ≤ e ≤ 2 g, 500–10 000 for e ≥ 5 g). Min, when entered, must be at least the Table 3 lower limit (e.g. 20e for class III).

## Known limits

- Single-interval, single-range instruments only (no e1/ei rules for multi-interval or multiple-range).
- d = e assumed. Discrimination uses the digital rule (3.8.2.2).
- Creep samples the 30-min change at 15 and 30 min; the 4 h path takes the reading furthest from the first.
- "About ½ Max" is read as 40–60 % of Max and "close to Max" as ≥ 90 % of Max. The standard gives no number; these are pack tolerances.
- Voltage limits are the AC mains ones (3.9.3); battery and vehicle supplies (A.5.4.2–A.5.4.4) are not modelled.
- Span stability uses E, not EL − E0, and does not average the first measurement's five readings.
- EMC (B.3), construction examination and the software checklist are recorded, never marked.

## Lab environment band

- Temperature: -10°C to 40°C
- Relative humidity: 0% to 85%

Outside this band, or an instrument that fails Table 3's n = Max/e bounds, the affected procedures are marked `cannot-compute` and no PDF/Word report is produced.

## Architecture

One Next.js App Router monolith. Postgres holds instruments, evaluations, procedures, attachments. Pass/fail is a pure function (`src/engine/r76.ts`; Table 6, Table 3, repeatability and eccentricity are cross-checked by the Python oracle `engine/r76.py` / `engine/check.py`) — no LLM ever decides or narrates a result. `src/lib/mark.ts` is the only place `payloadJson` becomes `resultJson`; `src/lib/reports/explainer.ts` turns `resultJson` into the same bullets shown on screen, in the PDF, and in the Word export.

## Deployment

Single host. Env vars in `.env` (see `.env.example`): `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` (production only), `DEMO_PASSWORD`. `pnpm exec prisma migrate deploy` then `pnpm exec prisma db seed` on first boot.


# Calculation methodology

Generated from `R-76 pack v1` (`src/engine/pack.ts`, `src/engine/r76.ts`) — not hand-written.
Regenerate: `npx tsx scripts/gen-methodology.ts`.

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

## Procedures this pack computes

- **WEIGHING** — OIML R 76-1 3.5 (weighing performance)
- **ECCENTRICITY** — OIML R 76-1 3.6.2 / 3.6.2.1 (eccentricity)
- **REPEATABILITY** — OIML R 76-1 3.6.1 (repeatability)
- **TARE** — OIML R 76-1 3.5 / A.4.6.2 (tare weighing)
- **DISCRIMINATION** — OIML R 76-1 3.8.2 (digital discrimination)
- **SENSITIVITY** — OIML R 76-1 3.8.1 (analogue sensitivity)
- **ZERO_RETURN** — OIML R 76-1 3.5.3 / A.4.2.3 (zero return)
- **CREEP** — OIML R 76-1 A.4.5 (creep)
- **STABILITY** — OIML R 76-1 4.5 (stability of equilibrium)
- **TILT** — OIML R 76-1 3.9.1.1 / A.5.1 (tilt)
- **WARMUP** — OIML R 76-1 A.4.4 (warm-up)
- **VOLTAGE** — OIML R 76-1 A.5.4 (voltage variations)
- **TEMP_NOLOAD** — OIML R 76-1 3.9.2.1 (temperature effect on no-load)
- **DAMP_HEAT** — OIML R 76-1 A.5.3 (damp heat)
- **SPAN_STABILITY** — OIML R 76-1 A.6 (span stability)
- **ENDURANCE** — OIML R 76-1 A.6 (endurance)
- **ROLLING_ECC** — OIML R 76-1 3.6.2 (rolling-load eccentricity)

Never auto-PASS: EMC, CONSTRUCTION, CHECKLIST. Those sections are forms with a status only — `entered, not marked` or `not entered`.

## Lab environment band (pack v1)

- Temperature: -10°C to 40°C
- Relative humidity: 0% to 85%

Outside this band, or an instrument that fails Table 3's n = Max/e bounds, the affected procedures are marked `cannot-compute` and no PDF/Word report is produced.

## Architecture

One Next.js App Router monolith. Postgres holds instruments, evaluations, procedures, attachments. Pass/fail is a pure function (`src/engine/r76.ts`, ported from the Python oracle `engine/r76.py`) — no LLM ever decides or narrates a result. `src/lib/mark.ts` is the only place `payloadJson` becomes `resultJson`; `src/lib/reports/explainer.ts` turns `resultJson` into the same bullets shown on screen, in the PDF, and in the Word export.

## Deployment

Single host. Env vars in `.env` (see `.env.example`): `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` (production only), `DEMO_PASSWORD`. `npx prisma migrate deploy` then `npx prisma db seed` on first boot.


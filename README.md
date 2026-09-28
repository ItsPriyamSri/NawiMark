# NawiMark

Type-evaluation reports for non-automatic weighing instruments, against OIML R-76.

Built for Smart India Hackathon 2026 problem statement **SIH26035** (Department of Consumer Affairs). Lab staff enter observations from the bench; NawiMark validates, marks, and produces the report. It does not operate a scale.

eMaap / RRSL integrations are **mocked** and labelled as such.

## What it does

- Sign in as tester or reviewer (mocked demo accounts)
- Record the instrument (manufacturer, model, class, Max, e, Min, Unom, serial, other parameters). Table 3 is checked on save, including the e sub-rows and the Min lower limit
- Record the lab environment and the **resolution during test**
- Enter observations the way an R 76-2 sheet takes them: indication I plus ΔL at the changeover point. The engine computes P = I + ½e − ΔL, E = P − L and Ec = E − E0 (R 76-1:2006 A.4.4.3). Above 0.2e resolution, a reading without ΔL is cannot-compute (3.5.3.2)
- Marked sheets: weighing, 4-corner eccentricity, two-series repeatability, tare, discrimination, zero return, creep (0.5e / 0.2e with the 4 h fallback), stability of equilibrium, tilt, warm-up, voltage, temperature effect on no-load, damp heat, span stability, endurance (durability error), rolling-load eccentricity. Each needs the number of readings the standard asks for
- Tests that R 76-1 does not apply to this instrument are marked **not applicable** with the clause (e.g. sensitivity for a digital scale, endurance above 100 kg). Rolling load and tilt can be waived by the tester with a written reason
- EMC, construction examination, and the software checklist are forms only. They never auto-PASS
- Mark against OIML R-76 Table 6 **initial** (type evaluation), not the 2× in-service band
- A demo toggle shows the same readings under shop 2×. Stored marks stay type-eval
- Export PDF and Word: verdict line, the same explainer as the screen, and every reading in R 76-2 column order (L, I, ΔL, P, E, Ec, MPE)
- Dashboard: in process / completed / history, result column, search by manufacturer or model
- Attach photos and supporting documents
- Reviewer grants or refuses model approval. Grant is blocked unless every applicable numeric mark passes

The default demo is a near-miss **fail**: corner C reads I = 10010 g with ΔL = 4 g, so P = 10011 g and the error is 11 g where 10 g is allowed on the type-eval band. The same instrument would pass shop verification at 2× — we still fail. A second seeded evaluation on the same instrument passes every applicable mark so Grant can be shown. `JunkScale / ILLEGAL-n` is a cannot-compute fixture (class III, n=30000). All seeded readings are mocked demo data, not RRSL measurements.

## Run it

```bash
docker compose up -d
cp .env.example .env          # fill AUTH_SECRET and DEMO_PASSWORD
pnpm install
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
pnpm dev
```

Checks:

```bash
python3 engine/check.py       # ALIVE 6/6 held-out correct
pnpm test
bash scripts/smoke.sh         # needs pdftotext + unzip
pnpm exec tsx scripts/gen-methodology.ts
```

Demo logins (mocked, not a live RRSL): `tester@nawimark.local` and `reviewer@nawimark.local`, password from `DEMO_PASSWORD`.

## Stack

Next.js App Router, TypeScript, Tailwind, shadcn/ui, Postgres + Prisma. One host.

Architecture, deployment, and the calculation methodology (generated from the pack, not written by hand) are in [`METHODOLOGY.md`](METHODOLOGY.md).

## Not in scope

Live eMaap, EMC auto-PASS, LLM pass/fail, blockchain, microservices. Digital signatures are optional in the problem statement; this build uses timestamped reviewer sign-off.

# NawiMark

Type-evaluation reports for non-automatic weighing instruments, against OIML R-76.

Built for Smart India Hackathon 2026 problem statement **SIH26035** (Department of Consumer Affairs). Lab staff enter observations from the bench; NawiMark validates, marks, and produces the report. It does not operate a scale.

eMaap / RRSL integrations are **mocked** and labelled as such.

## What it does

- Sign in as tester or reviewer (mocked demo accounts)
- Record instrument identity and lab environment
- Enter observations for every numeric R-76 sheet we name (weighing, 4-corner eccentricity, repeatability, tare, discrimination, sensitivity, zero return, creep, stability, tilt, warm-up, voltage, temperature no-load, damp heat, span stability, endurance, rolling-load eccentricity)
- EMC, construction examination, and the software checklist are forms only. They never auto-PASS
- Mark against OIML R-76 Table 6 **initial** (type evaluation), not the 2× in-service band
- A demo toggle shows the same readings under shop 2×. Stored marks stay type-eval
- Export PDF and Word with the same explainer
- Attach photos and supporting documents
- Reviewer grant or refuse model approval

The default demo is a near-miss **fail**: 11 g error where 10 g is allowed on the type-eval band. The same instrument would pass shop verification at 2× — we still fail. A second seeded evaluation on the same instrument passes every numeric mark so Grant can be shown. `JunkScale / ILLEGAL-n` is a cannot-compute fixture (class III, n=30000).

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

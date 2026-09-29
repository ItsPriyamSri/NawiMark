# NawiMark

Model-approval reports for non-automatic weighing instruments: shop scales, platform scales, weighbridges. The tester types the readings from the bench. We mark them against OIML R 76 and write the report. A reviewer then grants or refuses approval for that model.

Built for Smart India Hackathon 2026, problem statement **SIH26035** (Department of Consumer Affairs). The program does not operate the scale.

## The 11 g miss

Sign in and open the seeded report for **DemoCo NW-30**: class III, Max 30 kg, e = 10 g. On the four-corner eccentricity sheet, corner C shows an indication I = 10010 g. The extra load at the changeover is ΔL = 4 g. R 76-1:2006 A.4.4.3 turns that into the indication before rounding:

P = I + ½e − ΔL = 10011 g

The error is 11 g. Type evaluation uses Table 6, initial verification, which allows 10 g at that load. The sheet fails. Grant stays off, in the page and again in the server action.

Shop inspection uses twice that allowance, 20 g, so the same corner would pass a verification in service. A switch on the result page previews that wider band. The stored mark stays the type-evaluation fail.

The same instrument has a second seeded report where every applicable sheet passes, and Grant works on that one.

**JunkScale / ILLEGAL-n** is class III with n = Max/e = 30000. Table 3 does not allow it. The result is cannot-compute, and no PDF or Word file is produced.

These three cases are bench numbers we typed for the demo. They are not measurements from a Regional Reference Standards Laboratory. eMaap is not connected. The failing report carries a fixture attachment, `bench-note.txt`, so the file list on the PDF is not empty.

## What the tester enters

Instrument: manufacturer, model, accuracy class, Max, verification scale interval e, Min, nominal voltage, serial number, and a short description of the instrument. Saving it checks Table 3. n = Max/e must be an integer inside the row for that class and that size of e. Min, when entered, must clear the Table 3 lower limit (20e on a class III instrument).

Lab header: temperature, relative humidity, and the resolution during the test.

Each reading is the R 76-2 row: load L, indication I, and ΔL. We store

E = P − L, then Ec = E − E0

E0 is the zero error recorded for that test. If the resolution is coarser than 0.2e and ΔL was left blank, the row is cannot-compute (3.5.3.2). A zero error above 0.25e invalidates the run (4.5.2).

## Sheets this pack marks

**R-76 pack v2** marks twenty sheets. Each one asks for the number of readings in R 76-1:2006. A short sheet does not pass.

Weighing performance (at least 10 loads, increasing and decreasing, including Max). Accuracy of zero-setting. Four-corner eccentricity at about Max/3. Repeatability as two series, one around half Max and one close to Max, 10 readings each when Max is under 1000 kg. Tare weighing, with the tare value recorded, and a separate check that the tare setting itself is within 0.25e. Digital discrimination. Zero return. Creep: the change over 30 minutes within 0.5e, and the change from 15 to 30 minutes within 0.2e, otherwise a 4 hour run within the absolute MPE. Stability of equilibrium, five trials. Tilt in four directions. Warm-up at 0, 5, 15 and 30 minutes. Voltage at 0.85 and 1.10 times nominal, on AC mains. Static temperatures. Temperature effect on no-load indication. Damp heat, steady state. Span stability, at least 8 measurements. Endurance, as the change in error on the same loads before and after. Rolling-load eccentricity.

Where the standard says the test does not apply, the sheet is **not applicable** and names the clause. Sensitivity (6.1) is for a non-self-indicating instrument, so a digital scale is not applicable. Endurance stops above Max 100 kg, and does not apply to class I. Class I also drops creep, zero return, tilt, span stability, and damp heat. Damp heat is also out for class II when e is under 1 g. Digital discrimination is out below d = 5 mg.

The tester can waive four sheets that sometimes have no meaning for the instrument in front of them: rolling-load eccentricity, tilt, tare weighing, and accuracy of tare setting. The waiver needs a written reason. The reviewer sees it, and it is printed.

Electrical disturbances, the construction examination, and the software checklist are forms. We keep what was typed. We never score them. A pass on those would be a tick nobody calculated.

## Report and register

PDF and Word use the same verdict and the same explanation as the screen, then every reading in R 76-2 column order: L, I, ΔL, P, E, Ec, MPE. The footer names the pack. A later pack does not rewrite a report already marked.

The list on the home page splits work into in process, completed, and history, shows the result on the row, and searches by manufacturer or model. Photos and other files attach to the evaluation.

## Run it

Postgres 16 is the Docker service. The app is Next.js.

```bash
docker compose up -d
cp .env.example .env          # set AUTH_SECRET and DEMO_PASSWORD
pnpm install
pnpm exec prisma migrate deploy
pnpm exec prisma db seed
pnpm dev
```

Demo accounts, labelled mocked: `tester@nawimark.local` and `reviewer@nawimark.local`. Password is `DEMO_PASSWORD`.

From a clean clone of `996a898` on 29 Sep 2026:

```bash
python3 engine/check.py       # ALIVE 6/6 held-out correct
pnpm test                     # 28 tests, including the A.4.4.3 worked example
bash scripts/smoke.sh         # SMOKE OK; needs pdftotext and unzip
pnpm build
```

The Python check is the original six cases: MPE bands, repeatability, eccentricity, and an illegal n. The 28 tests include the worked example in A.4.4.3. `pnpm exec tsx scripts/gen-methodology.ts` regenerates [`METHODOLOGY.md`](METHODOLOGY.md) from the pack, including the Table 6 grid and the clause for each sheet.

## Limits

One machine, one Next.js process, Postgres. Pass and fail are computed in `src/engine/r76.ts`. The explanation on the screen, the PDF, and the Word file comes from that result. A language model is not in the path.

Single-interval instruments only. We assume d = e. Voltage is the AC mains case in 3.9.3, not battery or vehicle power. "About half of Max" is taken as 40–60% of Max, and "close to Max" as at least 90%. The standard gives no percentage; those bounds are this pack's. Span stability compares the error E, and does not subtract E0. Outside −10 °C to 40 °C, or 0% to 85% relative humidity, the affected sheets are cannot-compute and the export is blocked.

Digital signatures are optional in the problem statement. This build records the reviewer and the time. It does not attach a certificate.

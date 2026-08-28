# NawiMark

Type-evaluation reports for non-automatic weighing instruments, against OIML R-76.

Built for Smart India Hackathon 2026 problem statement **SIH26035** (Department of Consumer Affairs). Lab staff enter observations from the bench; NawiMark validates, marks, and produces the report. It does not operate a scale.

## Wave 1

- Sign in as tester or reviewer
- Record instrument identity and test environment
- Enter observations for weighing, four-corner eccentricity, and repeatability
- Mark against OIML R-76 Table 6 **initial** (type evaluation), not the 2× in-service band
- Export PDF and Word
- Reviewer grant or refuse

Other R-76-2 sections are captured as forms. They are never auto-passed, including EMC and construction/software checklists.

The default demo is a near-miss **fail**: 11 g error where 10 g is allowed on the type-eval band. The same instrument would pass shop verification at 2× — we still fail, because this product is model approval, not in-service inspection.

eMaap / RRSL integrations are **mocked** and labelled as such.

## Engine check

```bash
python3 engine/check.py
```

Must print `ALIVE 6/6 held-out correct`.

## Stack (target)

Next.js App Router, TypeScript, Tailwind, shadcn/ui, PostgreSQL. One host.

## Not in scope

Live eMaap, EMC auto-PASS, LLM pass/fail, blockchain, microservices. Digital signatures are optional in the problem statement; Wave 1 uses timestamped reviewer sign-off first.

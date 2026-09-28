#!/usr/bin/env bash
# Submission smoke: Fail + pack v2 + explainer on PDF and Word. Run after seed.
set -euo pipefail
cd "$(dirname "$0")/.."

python3 engine/check.py | grep -q "ALIVE 6/6"
npx vitest run

PATHS=$(npx tsx scripts/smoke-mark.ts)
PDF=$(echo "$PATHS" | sed -n '1p')
DOCX=$(echo "$PATHS" | sed -n '2p')

test -f "$PDF" && test -f "$DOCX"
PDFTEXT=$(pdftotext "$PDF" - | tr '\n' ' ')
for want in "11 g error" "R-76 pack v2" "FAIL" "bench-note.txt" "P = I + 1/2 e - dL = 10011 g" "not applicable"; do
  echo "$PDFTEXT" | grep -qF "$want" || { echo "PDF missing: $want"; exit 1; }
done
unzip -p "$DOCX" word/document.xml | grep -q "11 g error"

echo "SMOKE OK"

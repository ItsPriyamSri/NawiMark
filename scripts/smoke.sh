#!/usr/bin/env bash
# Submission smoke: Fail + pack v1 + explainer on PDF and Word. Run after seed.
set -euo pipefail
cd "$(dirname "$0")/.."

python3 engine/check.py | grep -q "ALIVE 6/6"
npx vitest run src/engine/r76.test.ts

PATHS=$(npx tsx scripts/smoke-mark.ts)
PDF=$(echo "$PATHS" | sed -n '1p')
DOCX=$(echo "$PATHS" | sed -n '2p')

test -f "$PDF" && test -f "$DOCX"
PDFTEXT=$(pdftotext "$PDF" -)
echo "$PDFTEXT" | grep -q "11 g error"
echo "$PDFTEXT" | grep -q "R-76 pack v1"
echo "$PDFTEXT" | grep -q "FAIL"
echo "$PDFTEXT" | grep -q "bench-note.txt"
unzip -p "$DOCX" word/document.xml | grep -q "11 g error"

echo "SMOKE OK"

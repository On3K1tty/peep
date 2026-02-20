#!/bin/bash
# PS1 baseline: bundle size gates < 500KB (raw + gzip)
# Run after build: npm run build && bash scripts/check-size.sh

MAX_KB=500
DIST="dist"

if [ ! -d "$DIST" ]; then
  echo "Error: $DIST not found. Run npm run build first."
  exit 1
fi

TOTAL_RAW=0
TOTAL_GZIP=0
while IFS= read -r f; do
  [ -n "$f" ] || continue
  SZ=$(stat -c%s "$f" 2>/dev/null || stat -f%z "$f" 2>/dev/null)
  GZ=$(gzip -c "$f" | wc -c | tr -d ' ')
  [ -n "$SZ" ] && TOTAL_RAW=$((TOTAL_RAW + SZ))
  [ -n "$GZ" ] && TOTAL_GZIP=$((TOTAL_GZIP + GZ))
done < <(find "$DIST" -maxdepth 2 -type f \( -name "*.js" -o -name "*.css" \) 2>/dev/null)

RAW_KB=$((TOTAL_RAW / 1024))
GZIP_KB=$((TOTAL_GZIP / 1024))
echo "Bundle size raw:  ${RAW_KB}KB (gate: ${MAX_KB}KB)"
echo "Bundle size gzip: ${GZIP_KB}KB (gate: ${MAX_KB}KB)"

if [ "$RAW_KB" -gt "$MAX_KB" ] || [ "$GZIP_KB" -gt "$MAX_KB" ]; then
  echo "FAIL: Bundle exceeds ${MAX_KB}KB gate (raw and/or gzip)"
  exit 1
fi
echo "PASS: Size gates OK"
exit 0

#!/bin/bash
# The Shark Push: генерирует финальную ссылку для публикации
# Использование: ./scripts/publish.sh [ProjectName]
# Результат: ProjectName_a8f2 (4 рандомных hex-символа)

NAME="${1:-peep}"
RND=$(openssl rand -hex 2 2>/dev/null || echo $(printf '%04x' $RANDOM))
OUT="${NAME}_${RND}"
echo "Publish name: $OUT"
echo "Build: npm run build"
echo "URL: \${ORIGIN}/\${PATH}?g=<encoded>"
echo "---"
echo "$OUT"

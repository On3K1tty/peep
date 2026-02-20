#!/bin/bash
# Shark Push: ask project name + 4 random chars => publish name + link

NAME="${1:-}"
if [ -z "$NAME" ]; then
  read -p "Project name [peep]: " NAME
  NAME="${NAME:-peep}"
fi

SLUG=$(echo "$NAME" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9._-' '-' | sed 's/^-*//; s/-*$//')
[ -n "$SLUG" ] || SLUG="peep"
RND=$(openssl rand -hex 2 2>/dev/null || printf '%04x' $((RANDOM % 65536)))
PUBLISH_NAME="${SLUG}-${RND}"

ORIGIN="${ORIGIN:-${2:-https://example.com}}"
BASE_PATH="${BASE_PATH:-${3:-/peep}}"
BASE_PATH="/${BASE_PATH#/}"
PUBLISH_LINK="${ORIGIN%/}${BASE_PATH}/${PUBLISH_NAME}/?g=<encoded>"

echo "Publish name: ${PUBLISH_NAME}"
echo "Publish link: ${PUBLISH_LINK}"
echo "Suggested flow:"
echo "  1) npm run build:gate"
echo "  2) Upload dist to ${BASE_PATH}/${PUBLISH_NAME}/"
echo "  3) Share the publish link"

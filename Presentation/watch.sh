#!/bin/bash
# Live preview of the decks on http://localhost:5005 (override with PORT)
# Uses the appliedAI theme if it exists (kept outside the repo, not shared),
# otherwise falls back to gaia. Override the path with MARP_THEME_CSS.
cd "$(dirname "$0")" || exit 1

THEME_CSS="${MARP_THEME_CSS:-../../marp-themes/appliedai.css}"
if [ -f "$THEME_CSS" ]; then
  THEME_ARGS=(--theme-set "$THEME_CSS" --theme appliedai)
else
  THEME_ARGS=(--theme gaia)
fi

PORT="${PORT:-5005}" npx @marp-team/marp-cli@4.5.1 "${THEME_ARGS[@]}" --allow-local-files -s .

#!/bin/bash
# Slide review on http://localhost:5006 (override with PORT): pen marks + comments on the live decks.
# Needs watch.sh running (marp on :5005). Open items land in .review/REVIEW.md.
cd "$(dirname "$0")" || exit 1
[ -n "$PORT" ] && export REVIEW_PORT="$PORT"
exec uv run --script review/server.py serve "$@"

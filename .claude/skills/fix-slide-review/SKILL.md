---
name: fix-slide-review
description: Apply the pen marks and comments made in the slide review overlay (Presentation/review.sh, http://localhost:5006) to the Marp decks in Presentation/. Use when the user says "fix the slide review", "apply my slide comments", "work through REVIEW.md" or similar.
---

# Fix slide review

The queue is `Presentation/.review/REVIEW.md`. Each open item has: deck, slide number, source line range, the comment, the text under the pen marks (`Marked:`), and a PNG of the slide with the strokes drawn in red (`Image:`).

## Procedure

1. Read `Presentation/.review/REVIEW.md`. No open items: say so and stop.
2. Per deck, work from the highest slide number down, so edits don't shift the line ranges of items not yet done.
3. Per item:
   - Look at the image when the comment is about layout, overflow, diagrams or position ("this", "here", "too big"). The red strokes show what is meant.
   - Find the source with the line range and the `Marked:` text. If the item says the line range is uncertain, search for the marked text instead.
   - Apply the comment as the instruction. Change only what it asks for.
   - Keep the deck conventions from `Presentation/marp.config.js`: source is hard-wrapped, a forced line break is a trailing `\`, Mermaid goes in ```` ```mermaid ```` fences.
   - The snapshot PNG comes from `marp --images`, not from the user's browser. When it is a rendering problem (clipped text, overlap), check whether it is the deck's content or the rendering setup in `marp.config.js`; fix the cause, not one slide. Changes to `marp.config.js` need a restart of `watch.sh`.
   - If the comment is unclear or contradicts the workshop docs (README.md, Code/), skip it and list it with a one-line question at the end.
4. After each fixed item, from `Presentation/`: `uv run --script review/server.py fixed <id> --note "<what changed, one short line>"`. This ticks the item's "fixed" checkbox in the browser; it stays on the slide in green, with the note, until the user deletes it or unticks it (unticked items come back to the queue with an "Earlier fix (reopened)" line: read it and try a different fix).
5. Report: one line per item (id, slide, what changed), then the skipped items with their questions.

The live preview reloads on save, so the user checks the result in the browser. Don't commit unless asked.

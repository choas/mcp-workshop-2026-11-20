// marp.config.js — auto-loaded by marp-cli from the working directory.
//
// Why this exists:
//   marp-cli does NOT understand ```mermaid code fences out of the box. The
//   workshop decks (01-introduction.md, …) describe their architecture with
//   diagrams, and we want those authored as portable Mermaid (which also
//   renders natively on GitHub) instead of hand-drawn ASCII art.
//
// What it does:
//   1. Registers a tiny markdown-it plugin that rewrites every ```mermaid
//      fence into a <div class="mermaid">…</div> that the Mermaid runtime
//      can find.
//   2. Injects the Mermaid runtime (once per deck) so those divs render in
//      the browser — both in live preview (`marp -s .`, see watch.sh) and in
//      the exported HTML.
//
// `html: true` is required so the injected <script> survives Marp's renderer.
//
// Mermaid is pinned and loaded from a CDN (mirrors the repo's "npx with a
// pinned version" style). If you present offline, vendor mermaid locally and
// point MERMAID_SRC at the local file instead.

const MERMAID_SRC =
  'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs'

/** markdown-it plugin: ```mermaid fences -> <div class="mermaid"> + runtime. */
function mermaidPlugin(md) {
  const defaultFence = md.renderer.rules.fence.bind(md.renderer.rules)

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    if (token.info.trim().toLowerCase() === 'mermaid') {
      // Escape so the browser hands Mermaid the *source* via textContent
      // (entities are decoded back to '-->', '<br/>', … at read time).
      const source = md.utils.escapeHtml(token.content)

      // Inject the runtime exactly once per rendered deck.
      let runtime = ''
      if (!env.__mermaidInjected) {
        env.__mermaidInjected = true
        runtime =
          '<script type="module">' +
          `import mermaid from '${MERMAID_SRC}';` +
          'mermaid.initialize({ startOnLoad: false, theme: \'neutral\',' +
          // Reserve space for subgraph titles so they never overlap the child
          // nodes (the gaia theme's larger font otherwise pushes nodes up into
          // the title — see "MCP Architecture" / "We Build Servers" slides).
          ' flowchart: { subGraphTitleMargin: { top: 8, bottom: 16 } } });' +
          // Render each diagram outside the slide, then move the SVG in.
          // Mermaid sizes its boxes from the measured label text, and a slide
          // is scaled to the window (and hidden until it is shown): measured
          // in place, a 900px window gave boxes at 70% of the label width,
          // so labels were cut off. mermaid.render() measures in an unscaled
          // temporary element in <body>. Wait for the web fonts first.
          'await document.fonts.ready;' +
          'let n = 0;' +
          'for (const el of document.querySelectorAll(\'.mermaid:not([data-processed])\')) {' +
          '  try {' +
          '    const { svg, bindFunctions } = await mermaid.render(\'mermaid-\' + n++, el.textContent);' +
          '    el.innerHTML = svg; bindFunctions?.(el);' +
          '  } catch (e) { console.error(\'[mermaid]\', e); }' +
          '  el.setAttribute(\'data-processed\', \'true\');' +
          '}' +
          '</script>' +
          // Center every diagram and cap its height so a tall/wide chart
          // scales down to fit the slide instead of overflowing the bottom
          // edge (e.g. the GuardLayer flowchart). Marp sections are a fixed
          // pixel size that is transform-scaled, so px caps scale with them.
          '<style>' +
          '.mermaid { display: flex; justify-content: center; }' +
          '.mermaid svg { max-width: 100%; max-height: 340px; height: auto; }' +
          // Labels must not inherit the slide's text styling (gaia sets
          // letter-spacing 1.25px, the theme weight 300): Mermaid measured
          // them without it, so the inherited spacing overflows the boxes.
          '.mermaid svg { letter-spacing: normal; word-spacing: normal;' +
          ' font-weight: normal; line-height: normal; text-transform: none; }' +
          // gaia's `section p` margin (high-specificity selector) beats
          // Mermaid's own `p { margin: 0 }` and pushes every label 16px down.
          '.mermaid svg p { margin: 0 !important; }' +
          // Edge labels ("goal met") get a white box from the neutral theme,
          // which shows on the off-white slide. Use the slide's own background
          // instead: looks transparent, but the edge line still doesn't run
          // through the text. Falls back to transparent without the variable.
          '.mermaid svg .edgeLabel, .mermaid svg .edgeLabel p, .mermaid svg .labelBkg' +
          ' { background-color: var(--color-background, transparent) !important; }' +
          '.mermaid svg .edgeLabel rect { fill: var(--color-background, transparent) !important; opacity: 1 !important; }' +
          '</style>'
      }

      return `${runtime}<div class="mermaid">\n${source}</div>\n`
    }
    return defaultFence(tokens, idx, options, env, self)
  }
}

/**
 * markdown-it plugin: shrink the deck-wide base font a notch.
 *
 * gaia sets `section { font-size: 35px }` and scales everything else (headings,
 * body, code, lists) in em, so lowering the section font-size shrinks the whole
 * slide proportionally and gives dense slides more room before they clip at the
 * bottom. Mermaid diagrams are capped in px, so they keep their size.
 * Injected once at the top of the deck as a global <style> (html: true lets it
 * through, same as the Mermaid runtime above).
 */
function baseFontPlugin(md) {
  const SIZE = '28px'    // gaia default is 35px; ~20% smaller
  const TOP_PAD = '35px' // gaia default section padding is 70px; halve the top gap
  // gaia scopes its own `section` rule with a high-specificity selector
  // (div#…>svg>foreignObject>section), so a plain `section{}` is overridden.
  // !important wins the cascade; em/rem children scale off this used value.
  const CSS =
    `<style>section { font-size: ${SIZE} !important; --marpit-root-font-size: ${SIZE} !important; padding-top: ${TOP_PAD} !important; }</style>`
  md.core.ruler.push('inject_base_font', (state) => {
    if (state.inlineMode) return
    const token = new state.Token('html_block', '', 0)
    token.content = CSS + '\n'
    state.tokens.unshift(token)
  })
}

module.exports = {
  // Allow the injected <script>/<style> through Marp's HTML sanitizer.
  html: true,
  // Add the Mermaid converter + base-font tweak, keep everything else.
  // breaks: false - a newline in the Markdown is a space, not a <br>. The
  // decks hard-wrap their source; with breaks on, every wrap became a line
  // break and wider fonts split sentences. Force a break with a trailing "\\".
  engine: ({ marp }) => {
    marp.markdown.set({ breaks: false })
    return marp.use(mermaidPlugin).use(baseFontPlugin)
  },
}

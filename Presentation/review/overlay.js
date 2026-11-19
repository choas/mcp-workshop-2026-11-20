// Slide review overlay, injected by review/server.py into every Marp deck.
// M = toggle pen. Draw on the slide, write a comment, Cmd/Ctrl+Enter saves.
(() => {
  if (!document.querySelector('svg[data-marpit-svg]')) return
  if (new URLSearchParams(location.search).get('view')) return // presenter/next views

  const API = '/__review/api/items'
  const deck = decodeURIComponent(location.pathname.replace(/^\//, ''))
  const RED = '#e6003c'
  const SAVED = 'rgba(255, 140, 0, 0.75)'
  const FIXED = 'rgba(0, 150, 90, 0.6)'

  let pen = false
  let showMarks = true
  let hideFixed = false
  try {
    hideFixed = localStorage.getItem('rv-hide-fixed') === '1'
  } catch {}
  let draft = [] // strokes of the annotation being written, normalized [x,y]
  let current = null
  let items = []

  // ------------------------------------------------------------ geometry
  const slides = () => [...document.querySelectorAll('.bespoke-marp-parent > svg[data-marpit-svg], body > svg[data-marpit-svg]')]
  const slideIndex = () => {
    const s = slides()
    const i = s.findIndex((el) => el.classList.contains('bespoke-marp-active'))
    if (i >= 0) return i
    const h = parseInt(location.hash.slice(1), 10)
    return Number.isFinite(h) ? Math.max(0, h - 1) : 0
  }
  const activeSvg = () => slides()[slideIndex()]
  // Visible slide area inside the svg (viewBox letterboxed, xMidYMid meet).
  const slideRect = (svg) => {
    const r = svg.getBoundingClientRect()
    const vb = svg.viewBox.baseVal
    const s = Math.min(r.width / vb.width, r.height / vb.height)
    const w = vb.width * s
    const h = vb.height * s
    return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h }
  }
  const toNorm = (e, r) => [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]
  const toPx = ([x, y], r) => [r.left + x * r.width, r.top + y * r.height]

  // ------------------------------------------------------------ DOM
  const css = document.createElement('style')
  css.textContent = `
    #rv-canvas{position:fixed;inset:0;z-index:2147483000;pointer-events:none;touch-action:none}
    #rv-canvas.pen{pointer-events:auto;cursor:crosshair}
    #rv-bar{position:fixed;top:10px;right:10px;z-index:2147483002;display:flex;gap:6px;font:13px/1 system-ui,sans-serif}
    #rv-bar button,#rv-panel button{border:1px solid #bbb;background:#fff;color:#222;border-radius:6px;padding:6px 10px;cursor:pointer;font:inherit}
    #rv-bar button.on{background:${RED};border-color:${RED};color:#fff}
    #rv-panel{position:fixed;top:48px;right:10px;width:330px;max-height:calc(100vh - 70px);overflow:auto;z-index:2147483002;
      background:#fff;color:#222;border:1px solid #ccc;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.18);padding:12px;font:13px/1.4 system-ui,sans-serif;display:none}
    #rv-panel.open{display:block}
    #rv-panel h4{margin:0 0 8px;font-size:13px}
    #rv-panel textarea{width:100%;box-sizing:border-box;min-height:80px;font:inherit;padding:6px;border:1px solid #bbb;border-radius:6px;resize:vertical}
    #rv-panel .row{display:flex;gap:6px;justify-content:flex-end;margin-top:6px}
    #rv-panel .save{background:${RED};border-color:${RED};color:#fff}
    #rv-panel .hint{color:#777;font-size:12px;margin:4px 0 0}
    #rv-panel ul{list-style:none;padding:0;margin:12px 0 0}
    #rv-panel li{border-top:1px solid #eee;padding:8px 0;display:flex;gap:8px;align-items:flex-start}
    #rv-panel li .n{background:${SAVED};color:#fff;border-radius:10px;min-width:20px;text-align:center;font-weight:600}
    #rv-panel li.fixed .n{background:${FIXED}}
    #rv-panel li .t{flex:1;white-space:pre-wrap}
    #rv-panel li.fixed .t{color:#888}
    #rv-panel li .note{display:block;color:#08734a;margin-top:4px}
    #rv-panel li label{display:flex;gap:4px;align-items:center;cursor:pointer;color:#555;font-size:12px}
    #rv-panel li input{margin:0;width:16px;height:16px;accent-color:#08734a;cursor:pointer}
    #rv-panel li button{padding:2px 6px}
    #rv-panel .opts{display:flex;justify-content:space-between;align-items:center;margin-top:12px;color:#555;font-size:12px}
    #rv-panel .opts label{display:flex;gap:4px;align-items:center;cursor:pointer}
    @media print{#rv-canvas,#rv-bar,#rv-panel{display:none!important}}
  `
  document.head.appendChild(css)

  const canvas = document.createElement('canvas')
  canvas.id = 'rv-canvas'
  const ctx = canvas.getContext('2d')

  const bar = document.createElement('div')
  bar.id = 'rv-bar'
  bar.innerHTML = `
    <button data-a="pen" title="Pen (M)">✎ Mark</button>
    <button data-a="panel" title="Comments on this slide">💬 <span>0</span></button>
    <button data-a="eye" title="Show/hide saved marks">👁</button>`

  const panel = document.createElement('div')
  panel.id = 'rv-panel'
  panel.innerHTML = `
    <h4>Slide <span class="sn"></span></h4>
    <textarea placeholder="What should change? Draw on the slide to point at it."></textarea>
    <p class="hint">Cmd/Ctrl+Enter save · Esc discard · M pen on/off</p>
    <div class="row"><button class="undo">Undo stroke</button><button class="discard">Discard</button><button class="save">Save</button></div>
    <div class="opts"><span class="counts"></span><label><input type="checkbox" class="hide-fixed"> Hide fixed</label></div>
    <ul></ul>`
  const ta = panel.querySelector('textarea')

  document.body.append(canvas, bar, panel)

  // Keys typed in our UI must not reach bespoke's navigation.
  for (const el of [bar, panel]) {
    for (const t of ['keydown', 'keyup', 'keypress', 'wheel', 'pointerdown', 'click', 'mousedown', 'touchstart'])
      el.addEventListener(t, (e) => e.stopPropagation())
  }

  // ------------------------------------------------------------ drawing
  const drawStroke = (stroke, r, color, width) => {
    const pts = stroke.map((p) => toPx(p, r))
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (pts.length === 1) {
      ctx.beginPath()
      ctx.arc(pts[0][0], pts[0][1], width, 0, Math.PI * 2)
      ctx.fill()
      return
    }
    ctx.beginPath()
    ctx.moveTo(...pts[0])
    for (const p of pts.slice(1)) ctx.lineTo(...p)
    ctx.stroke()
  }

  // All items of the slide, numbered in creation order (numbers stay stable
  // when an item is ticked); hidden ones are filtered out after numbering.
  const slideItems = () =>
    items
      .filter((i) => i.slide === slideIndex() + 1)
      .map((it, n) => ({ it, n: n + 1 }))
      .filter(({ it }) => !(hideFixed && it.status === 'fixed'))

  const render = () => {
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== innerWidth * dpr || canvas.height !== innerHeight * dpr) {
      canvas.width = innerWidth * dpr
      canvas.height = innerHeight * dpr
      canvas.style.width = innerWidth + 'px'
      canvas.style.height = innerHeight + 'px'
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, innerWidth, innerHeight)
    const svg = activeSvg()
    if (!svg) return
    const r = slideRect(svg)
    const w = Math.max(2, r.width / 320)
    if (showMarks) {
      slideItems().forEach(({ it, n }) => {
        const color = it.status === 'fixed' ? FIXED : SAVED
        it.strokes.forEach((s) => drawStroke(s, r, color, w))
        const anchor = it.strokes[0]?.[0]
        if (anchor) {
          const [x, y] = toPx(anchor, r)
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(x - 12, y - 12, 10, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#fff'
          ctx.font = 'bold 12px system-ui'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(String(n), x - 12, y - 12)
        }
      })
    }
    for (const s of draft) drawStroke(s, r, RED, w)
    if (current) drawStroke(current, r, RED, w)
  }

  // ------------------------------------------------------------ panel
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

  const refreshPanel = () => {
    const own = slideItems()
    const all = items.filter((i) => i.slide === slideIndex() + 1)
    const nOpen = all.filter((i) => i.status !== 'fixed').length
    const nFixed = all.length - nOpen
    bar.querySelector('[data-a=pen]').classList.toggle('on', pen)
    bar.querySelector('[data-a=eye]').classList.toggle('on', !showMarks)
    bar.querySelector('[data-a=panel] span').textContent = nFixed ? `${nOpen} · ✓${nFixed}` : nOpen
    panel.querySelector('.sn').textContent = `${slideIndex() + 1} · ${deck}`
    panel.querySelector('.counts').textContent = `${nOpen} open, ${nFixed} fixed`
    panel.querySelector('.hide-fixed').checked = hideFixed
    panel.querySelector('ul').innerHTML = own
      .map(({ it, n }) => {
        const fixed = it.status === 'fixed'
        const note = it.note ? `<span class="note">Fix: ${esc(it.note)}</span>` : ''
        return `<li data-id="${it.id}" class="${fixed ? 'fixed' : ''}"><span class="n">${n}</span>
          <span class="t">${esc(it.comment)}${note}</span>
          <label title="Ticked = fixed. Untick to send it back to the queue."><input type="checkbox" data-a="fixed" ${fixed ? 'checked' : ''}>fixed</label>
          <button data-a="del" title="Delete">🗑</button></li>`
      })
      .join('')
  }

  const update = () => {
    render()
    refreshPanel()
  }

  const setPen = (on) => {
    pen = on
    canvas.classList.toggle('pen', pen)
    if (pen) panel.classList.add('open')
    update()
  }

  const discard = () => {
    draft = []
    ta.value = ''
    update()
  }

  // Text of the slide elements under the strokes, so the fix can find the source.
  const markedText = () => {
    const svg = activeSvg()
    const section = svg?.querySelector('section')
    if (!section || !draft.length) return []
    const r = slideRect(svg)
    const boxes = draft.map((s) => {
      const pts = s.map((p) => toPx(p, r))
      const xs = pts.map((p) => p[0])
      const ys = pts.map((p) => p[1])
      return { l: Math.min(...xs) - 6, r: Math.max(...xs) + 6, t: Math.min(...ys) - 6, b: Math.max(...ys) + 6 }
    })
    const hit = (rc) => boxes.some((b) => rc.right >= b.l && rc.left <= b.r && rc.bottom >= b.t && rc.top <= b.b)
    const out = new Set()
    const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim() || n.parentElement.closest('style,script')) continue
      const range = document.createRange()
      range.selectNodeContents(n)
      if (![...range.getClientRects()].some(hit)) continue
      const inDiagram = n.parentElement.closest('.mermaid')
      let text = n.textContent
      const block = !inDiagram && n.parentElement.closest('li,p,h1,h2,h3,h4,h5,h6,td,th,pre,blockquote,figcaption')
      if (block) {
        const clone = block.cloneNode(true)
        clone.querySelectorAll('ul,ol').forEach((x) => x.remove()) // nested list items count separately
        text = clone.textContent
      }
      text = text.replace(/\s+/g, ' ').trim()
      if (text) out.add((inDiagram ? '[diagram] ' : '') + text.slice(0, 300))
    }
    section.querySelectorAll('img').forEach((img) => {
      if (hit(img.getBoundingClientRect())) out.add(`[image] ${img.getAttribute('src')}`)
    })
    return [...out]
  }

  const save = async () => {
    const comment = ta.value.trim()
    if (!comment) {
      ta.focus()
      ta.placeholder = 'Write a comment first.'
      return
    }
    const body = {
      deck,
      slide: slideIndex() + 1,
      slides_total: slides().length,
      comment,
      strokes: draft,
      marked: markedText(),
    }
    const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!res.ok) {
      alert('Saving failed: ' + (await res.text()))
      return
    }
    items.push(await res.json())
    discard()
    setPen(false)
    ta.blur() // hand the keyboard back to slide navigation
  }

  const load = async () => {
    try {
      const res = await fetch(`${API}?deck=${encodeURIComponent(deck)}`)
      items = await res.json()
    } catch {
      items = []
    }
    update()
  }

  // ------------------------------------------------------------ events
  canvas.addEventListener('pointerdown', (e) => {
    if (!pen || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    canvas.setPointerCapture(e.pointerId)
    current = [toNorm(e, slideRect(activeSvg()))]
  })
  canvas.addEventListener('pointermove', (e) => {
    if (!current) return
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]
    const r = slideRect(activeSvg())
    for (const ev of evs) current.push(toNorm(ev, r))
    render()
  })
  const endStroke = () => {
    if (!current) return
    draft.push(current.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]))
    current = null
    panel.classList.add('open')
    update()
    ta.focus({ preventScroll: true })
  }
  canvas.addEventListener('pointerup', endStroke)
  canvas.addEventListener('pointercancel', endStroke)
  canvas.addEventListener('wheel', (e) => pen && e.preventDefault(), { passive: false })
  canvas.addEventListener('click', (e) => pen && e.stopPropagation())

  bar.addEventListener('click', (e) => {
    const a = e.target.closest('button')?.dataset.a
    if (a === 'pen') setPen(!pen)
    if (a === 'panel') panel.classList.toggle('open')
    if (a === 'eye') {
      showMarks = !showMarks
      update()
    }
  })

  panel.addEventListener('click', async (e) => {
    const btn = e.target.closest('button')
    if (!btn) return
    if (btn.classList.contains('save')) return save()
    if (btn.classList.contains('discard')) return discard()
    if (btn.classList.contains('undo')) {
      draft.pop()
      return update()
    }
    const id = btn.closest('li')?.dataset.id
    if (!id || btn.dataset.a !== 'del' || !confirm('Delete this comment?')) return
    const res = await fetch(`${API}/${id}`, { method: 'DELETE' })
    if (res.ok) {
      items = items.filter((i) => i.id !== id)
      update()
    }
  })

  panel.addEventListener('change', async (e) => {
    const box = e.target
    if (box.classList.contains('hide-fixed')) {
      hideFixed = box.checked
      try {
        localStorage.setItem('rv-hide-fixed', hideFixed ? '1' : '0')
      } catch {}
      return update()
    }
    if (box.dataset.a !== 'fixed') return
    const id = box.closest('li').dataset.id
    const res = await fetch(`${API}/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: box.checked ? 'fixed' : 'open' }),
    })
    if (res.ok) {
      const updated = await res.json()
      items = items.map((i) => (i.id === id ? updated : i))
    } else {
      box.checked = !box.checked
    }
    update()
  })

  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      save()
    } else if (e.key === 'Escape') {
      discard()
      setPen(false)
      ta.blur()
    }
  })

  // Capture phase so bespoke never sees M / Escape while reviewing.
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.target === ta || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'm' || e.key === 'M') {
        e.stopPropagation()
        e.preventDefault()
        setPen(!pen)
      } else if (e.key === 'Escape' && (pen || draft.length)) {
        e.stopPropagation()
        discard()
        setPen(false)
      }
    },
    true,
  )

  // Navigating away drops an unsaved drawing (it belongs to the old slide).
  let lastSlide = slideIndex()
  const onNav = () => {
    const i = slideIndex()
    if (i !== lastSlide) {
      lastSlide = i
      draft = []
    }
    update()
  }
  window.addEventListener('hashchange', onNav)
  window.addEventListener('resize', render)
  new MutationObserver(onNav).observe(document.querySelector('.bespoke-marp-parent') || document.body, {
    attributes: true,
    subtree: true,
    attributeFilter: ['class'],
  })

  load()
})()

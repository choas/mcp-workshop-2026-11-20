#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=10"]
# ///
"""Slide review: pen marks + comments on the live Marp preview.

    uv run --script review/server.py serve      # proxy on :5006 -> marp on :5005
    uv run --script review/server.py list       # print open items
    uv run --script review/server.py fixed ID [--note "what changed"]

Status: open -> fixed (ticked checkbox in the browser). Fixed items stay on the
slide in green until you delete them; unticking puts them back in the queue.

The proxy forwards everything to the running `marp -s` (watch.sh) and injects
review/overlay.js into each deck. Marks are stored in Presentation/.review/:
  items/<id>.json   one per annotation (strokes, comment, marked text, lines)
  img/<id>.png      slide snapshot with the pen strokes drawn on top
  REVIEW.md         open items, the queue used to fix the Markdown
"""

from __future__ import annotations

import argparse
import json
import os
import re
import secrets
import subprocess
import sys
import threading
import urllib.error
import urllib.request
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # Presentation/
REPO = ROOT.parent
DATA = ROOT / ".review"
ITEMS = DATA / "items"
IMG = DATA / "img"
CACHE = DATA / "cache"
OVERLAY = Path(__file__).resolve().parent / "overlay.js"
MARP = "@marp-team/marp-cli@4.5.1"  # same pin as watch.sh

LOCK = threading.Lock()
RENDER_LOCKS: dict[str, threading.Lock] = {}


# ---------------------------------------------------------------- markdown


FENCE = re.compile(r"^ {0,3}(`{3,}|~{3,})")
HR = re.compile(r"^ {0,3}((-[ \t]*){3,}|(\*[ \t]*){3,}|(_[ \t]*){3,})$")
NOT_PARAGRAPH = re.compile(r"^\s*([-*+]\s|\d+[.)]\s|>|#|\||<|```|~~~)|-->\s*$")


def slide_ranges(text: str) -> list[tuple[int, int]]:
    """1-based (first, last) source line of every slide, separators excluded."""
    lines = text.split("\n")
    i = 0
    if lines and lines[0].strip() == "---":  # front matter
        for j in range(1, len(lines)):
            if lines[j].strip() in ("---", "..."):
                i = j + 1
                break
    ranges, start, fence = [], i, None
    for j in range(i, len(lines)):
        s = lines[j]
        m = FENCE.match(s)
        if fence:
            if m and m.group(1)[0] == fence[0] and len(m.group(1)) >= len(fence):
                fence = None
            continue
        if m:
            fence = m.group(1)
            continue
        if HR.match(s):
            prev = lines[j - 1] if j > i else ""
            setext = s.strip().startswith("-") and prev.strip() and not NOT_PARAGRAPH.match(prev)
            if not setext:
                ranges.append((start + 1, j))
                start = j + 1
    ranges.append((start + 1, len(lines)))
    return [(a, max(a, b)) for a, b in ranges]


def slide_info(deck: Path, slide: int) -> dict:
    text = deck.read_text(encoding="utf-8")
    ranges = slide_ranges(text)
    if not 1 <= slide <= len(ranges):
        return {"lines": None, "heading": None, "slides_in_source": len(ranges)}
    a, b = ranges[slide - 1]
    src = text.split("\n")[a - 1 : b]
    heading = next((l.lstrip("#").strip() for l in src if re.match(r"^#{1,6}\s", l)), None)
    return {"lines": [a, b], "heading": heading, "slides_in_source": len(ranges)}


# ---------------------------------------------------------------- images


def theme_args() -> list[str]:
    css = Path(os.environ.get("MARP_THEME_CSS", ROOT / "../../marp-themes/appliedai.css"))
    if not css.is_absolute():
        css = ROOT / css
    if css.is_file():
        return ["--theme-set", str(css), "--theme", "appliedai"]
    return ["--theme", "gaia"]


def render_deck(deck: Path) -> Path | None:
    """PNG per slide for the deck's current state (cached by mtime)."""
    key = f"{deck.stem}-{int(deck.stat().st_mtime)}"
    out = CACHE / key
    lock = RENDER_LOCKS.setdefault(deck.stem, threading.Lock())
    with lock:
        if any(out.glob("*.png")):
            return out
        out.mkdir(parents=True, exist_ok=True)
        cmd = ["npx", "--yes", MARP, *theme_args(), "--allow-local-files",
               "--images", "png", "-o", str(out / f"{deck.stem}.png"), str(deck)]
        try:
            subprocess.run(cmd, cwd=ROOT, capture_output=True, timeout=300, check=True)
        except (subprocess.SubprocessError, OSError) as e:
            print(f"[review] slide render failed for {deck.name}: {e}", file=sys.stderr)
            return None
        for old in CACHE.glob(f"{deck.stem}-*"):
            if old != out:
                for f in old.iterdir():
                    f.unlink()
                old.rmdir()
        return out


def snapshot(item: dict) -> None:
    """Slide PNG with the item's strokes drawn on top -> .review/img/<id>.png."""
    from PIL import Image, ImageDraw

    out = render_deck(ROOT / item["deck"])
    if not out:
        return
    pngs = sorted(out.glob("*.png"))
    slide = item["slide"]
    if len(pngs) == 1 and slide == 1:
        src = pngs[0]
    else:
        src = next((p for p in pngs if p.name.endswith(f".{slide:03d}.png")), None)
    if not src:
        return
    img = Image.open(src).convert("RGB")
    draw = ImageDraw.Draw(img)
    w, h = img.size
    width = max(3, round(w / 256))
    for stroke in item["strokes"]:
        pts = [(x * w, y * h) for x, y in stroke]
        if len(pts) == 1:
            x, y = pts[0]
            draw.ellipse((x - width, y - width, x + width, y + width), fill=(230, 0, 60))
        else:
            draw.line(pts, fill=(230, 0, 60), width=width, joint="curve")
    IMG.mkdir(parents=True, exist_ok=True)
    img.save(IMG / f"{item['id']}.png")
    with LOCK:
        path = ITEMS / f"{item['id']}.json"
        if path.exists():
            data = json.loads(path.read_text())
            data["image"] = f".review/img/{item['id']}.png"
            path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
            write_review_md()


# ---------------------------------------------------------------- store


def load_items() -> list[dict]:
    if not ITEMS.exists():
        return []
    items = [json.loads(p.read_text()) for p in ITEMS.glob("*.json")]
    for i in items:
        if i["status"] == "done":  # status name before the checkbox existed
            i["status"] = "fixed"
    return sorted(items, key=lambda i: (i["deck"], i["slide"], i["created"]))


def write_review_md() -> None:
    all_items = load_items()
    items = [i for i in all_items if i["status"] == "open"]
    fixed = [i for i in all_items if i["status"] == "fixed"]
    out = [
        "# Slide review: open items",
        "",
        "Generated by `review/server.py`; do not edit. After fixing an item run",
        '`uv run --script review/server.py fixed <id> --note "what changed"` (from Presentation/).',
        "Line ranges are the slide's source lines at the time of the comment.",
        "",
    ]
    if fixed:
        out += [f"{len(fixed)} fixed item(s) wait for a check in the browser (listed at the end).", ""]
    if not items:
        out.append("No open items.")
    deck = None
    for it in items:
        if it["deck"] != deck:
            deck = it["deck"]
            out += [f"## {deck}", ""]
        rel = (ROOT / deck).relative_to(REPO)
        loc = f"{rel}:{it['lines'][0]}-{it['lines'][1]}" if it.get("lines") else str(rel)
        title = f' "{it["heading"]}"' if it.get("heading") else ""
        out.append(f"### `{it['id']}` slide {it['slide']}{title}")
        out.append("")
        out.append(f"- Source: `{loc}`")
        if it.get("lines_uncertain"):
            out.append("- Note: slide count in source differs from the rendered deck; check the line range")
        out.append("- Comment: " + it["comment"].replace("\n", "\n  "))
        for m in it.get("marked", []):
            out.append(f"- Marked: `{m}`")
        if not it.get("strokes"):
            out.append("- Marked: (no pen marks, comment on the whole slide)")
        if it.get("image"):
            out.append(f"- Image: `{(ROOT / it['image']).relative_to(REPO)}`")
        if it.get("note"):  # reopened after a fix: say what was tried
            out.append(f"- Earlier fix (reopened): {it['note']}")
        out.append("")
    if fixed:
        out += ["## Fixed, waiting for a check", ""]
        for it in fixed:
            note = f": {it['note']}" if it.get("note") else ""
            out.append(f"- `{it['id']}` {it['deck']} slide {it['slide']}, \"{it['comment'].splitlines()[0]}\"{note}")
        out.append("")
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / "REVIEW.md").write_text("\n".join(out), encoding="utf-8")


def resolve_deck(name: str) -> Path | None:
    p = (ROOT / name).resolve()
    if p.suffix == ".md" and p.parent == ROOT and p.is_file():
        return p
    return None


def create_item(body: dict) -> dict:
    deck = resolve_deck(str(body.get("deck", "")))
    comment = str(body.get("comment", "")).strip()
    slide = int(body.get("slide", 0))
    if not deck or not comment or slide < 1:
        raise ValueError("deck, slide and comment are required")
    strokes = [[[round(float(x), 4), round(float(y), 4)] for x, y in s] for s in body.get("strokes", [])]
    info = slide_info(deck, slide)
    total = body.get("slides_total")
    item = {
        "id": datetime.now().strftime("%m%d-%H%M%S-") + secrets.token_hex(2),
        "deck": deck.name,
        "slide": slide,
        "lines": info["lines"],
        "heading": info["heading"],
        "lines_uncertain": bool(total) and int(total) != info["slides_in_source"],
        "comment": comment,
        "marked": [str(m)[:300] for m in body.get("marked", [])][:20],
        "strokes": strokes,
        "image": None,
        "status": "open",
        "created": datetime.now().isoformat(timespec="seconds"),
    }
    with LOCK:
        ITEMS.mkdir(parents=True, exist_ok=True)
        (ITEMS / f"{item['id']}.json").write_text(json.dumps(item, indent=2, ensure_ascii=False))
        write_review_md()
    threading.Thread(target=snapshot, args=(item,), daemon=True).start()
    return item


def set_status(item_id: str, status: str | None, note: str | None = None) -> dict | None:
    """status 'open' or 'fixed'; None deletes the item. Returns the item."""
    if not re.fullmatch(r"[0-9a-f-]+", item_id) or status not in ("open", "fixed", None):
        return None
    path = ITEMS / f"{item_id}.json"
    with LOCK:
        if not path.exists():
            return None
        data = json.loads(path.read_text())
        if status is None:
            path.unlink()
            (IMG / f"{item_id}.png").unlink(missing_ok=True)
        else:
            data["status"] = status
            data["fixed_at"] = datetime.now().isoformat(timespec="seconds") if status == "fixed" else None
            if note is not None:
                data["note"] = note.strip()
            path.write_text(json.dumps(data, indent=2, ensure_ascii=False))
        write_review_md()
    return data


# ---------------------------------------------------------------- http


class Handler(BaseHTTPRequestHandler):
    upstream = "http://localhost:5005"

    def log_message(self, fmt, *args):  # quiet: only API calls
        if self.path.startswith("/__review/api"):
            super().log_message(fmt, *args)

    def send(self, code: int, body: bytes, ctype: str = "application/json") -> None:
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def send_json(self, code: int, data) -> None:
        self.send(code, json.dumps(data, ensure_ascii=False).encode())

    def body(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    def do_GET(self):
        if self.path == "/__review/overlay.js":
            return self.send(200, OVERLAY.read_bytes(), "text/javascript; charset=utf-8")
        if self.path.startswith("/__review/api/items"):
            from urllib.parse import parse_qs, urlparse

            deck = parse_qs(urlparse(self.path).query).get("deck", [""])[0]
            items = [i for i in load_items() if i["deck"] == deck]
            return self.send_json(200, items)
        self.proxy()

    do_HEAD = do_GET

    def do_POST(self):
        m = re.fullmatch(r"/__review/api/items/([\w-]+)/status", self.path)
        if m:  # body {"status": "open" | "fixed"}: the checkbox
            item = set_status(m.group(1), str(self.body().get("status")))
            return self.send_json(200 if item else 404, item or {"error": "not found"})
        if self.path == "/__review/api/items":
            try:
                return self.send_json(201, create_item(self.body()))
            except (ValueError, TypeError) as e:
                return self.send_json(400, {"error": str(e)})
        self.send_json(404, {"error": "not found"})

    def do_DELETE(self):
        m = re.fullmatch(r"/__review/api/items/([\w-]+)", self.path)
        ok = bool(m) and set_status(m.group(1), None)
        self.send_json(200 if ok else 404, {"ok": ok})

    def proxy(self):
        req = urllib.request.Request(self.upstream + self.path, method=self.command,
                                     headers={"Accept": self.headers.get("Accept", "*/*")})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                code, ctype, data = r.status, r.headers.get("Content-Type", ""), r.read()
        except urllib.error.HTTPError as e:
            code, ctype, data = e.code, e.headers.get("Content-Type", "text/plain"), e.read()
        except urllib.error.URLError as e:
            msg = f"Marp preview not reachable at {self.upstream} ({e.reason}). Is watch.sh running?"
            return self.send(502, msg.encode(), "text/plain; charset=utf-8")
        if "text/html" in ctype and b"data-marpit-svg" in data:
            html = data.decode("utf-8")
            # Live reload: marp's notifier uses a relative ws:// path; point it at marp.
            ws = self.upstream.replace("http", "ws", 1)
            html = html.replace('__marpCliWatchWS="/', f'__marpCliWatchWS="{ws}/', 1)
            tag = '<script src="/__review/overlay.js" defer></script>'
            html = html.replace("</body>", tag + "</body>", 1) if "</body>" in html else html + tag
            data = html.encode("utf-8")
        self.send(code, data, ctype or "application/octet-stream")


# ---------------------------------------------------------------- cli


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("serve")
    s.add_argument("--port", type=int, default=int(os.environ.get("REVIEW_PORT", 5006)))
    s.add_argument("--upstream", default=os.environ.get("MARP_URL", "http://localhost:5005"))
    sub.add_parser("list")
    for name in ("fixed", "done"):  # "done" kept as an alias
        d = sub.add_parser(name)
        d.add_argument("ids", nargs="+")
        d.add_argument("--note", help="what changed, shown next to the item in the browser")
    r = sub.add_parser("reopen")
    r.add_argument("ids", nargs="+")
    a = ap.parse_args()

    if a.cmd == "serve":
        Handler.upstream = a.upstream.rstrip("/")
        write_review_md()
        srv = ThreadingHTTPServer(("127.0.0.1", a.port), Handler)
        print(f"Slide review on http://localhost:{a.port}  (proxying {Handler.upstream})")
        print(f"Queue: {(DATA / 'REVIEW.md').relative_to(REPO)}")
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            pass
    elif a.cmd == "list":
        for it in load_items():
            if it["status"] == "open":
                lines = "-".join(map(str, it["lines"])) if it.get("lines") else "?"
                print(f"{it['id']}  {it['deck']}:{lines}  slide {it['slide']}  {it['comment']}")
    elif a.cmd in ("fixed", "done"):
        for i in a.ids:
            print(f"{i}: {'fixed' if set_status(i, 'fixed', a.note) else 'not found'}")
    elif a.cmd == "reopen":
        for i in a.ids:
            print(f"{i}: {'open' if set_status(i, 'open') else 'not found'}")


if __name__ == "__main__":
    main()

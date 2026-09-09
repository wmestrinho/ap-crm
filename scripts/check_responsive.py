#!/usr/bin/env python3
"""Static responsive-contract check (workspace Responsive / Mobile Standard).

Reference implementation for the workspace. Copy this file verbatim into a
repo when it is retrofitted and adjust only the configuration block below.
Runs with no dependencies; called from validate_agent_baseline.py so it fires
wherever that already runs (local, cross-machine send check, CI).

Checks:
  FAIL  every shipped *.html has a viewport meta with width=device-width
  FAIL  the viewport meta does not disable zoom (user-scalable=no, maximum-scale=1)
  FAIL  no `overflow-x: hidden` (or `overflow: hidden`) on `html`/`body` in authored CSS
  WARN  @media width values outside the canonical set {600, 900, 1200} px with no
        same-line comment documenting the component exception
  WARN  a file that renders <table> without any table-wrap class in the same file

Standard: ~/.claude/standards/responsive-standard.md
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# ── configuration (the only block that changes per repo) ──────────────────
SKIP_DIRS = {"plan", "node_modules", ".git", ".wrangler", "assets", "docs",
             "supabase", "google-apps-script", "__pycache__", "site"}
AUTHORED_CSS = ["css"]                # dirs (or files) of hand-written CSS
TEMPLATE_JS = ["js"]                  # dirs of JS that may render <table>
CANONICAL_BREAKPOINTS_PX = {600, 900, 1200}
TABLE_WRAP_CLASSES = ("table-wrap",)  # substring match; "hq-table-wrap" counts
# ──────────────────────────────────────────────────────────────────────────

VIEWPORT_RE = re.compile(r'<meta\s+[^>]*name\s*=\s*["\']viewport["\'][^>]*>', re.I)
CONTENT_RE = re.compile(r'content\s*=\s*["\']([^"\']*)["\']', re.I)
ZOOM_LOCK_RE = re.compile(r'user-scalable\s*=\s*(?:no|0)|maximum-scale\s*=\s*1(?:\.0+)?(?![\d.])', re.I)
# selector list made only of html/body (not body::before, not .body-x)
ROOT_RULE_RE = re.compile(
    r'(?<![\w.#\-:])((?:html|body)(?:\s*,\s*(?:html|body))*)\s*\{([^}]*)\}', re.I)
OVERFLOW_RE = re.compile(r'overflow(?:-x)?\s*:\s*hidden', re.I)
MEDIA_WIDTH_RE = re.compile(
    r'@media[^{]*?\((?:min|max)-width\s*:\s*(\d+(?:\.\d+)?)\s*(px|em|rem)\s*\)', re.I)


def _iter_files(suffixes: tuple[str, ...], roots: list[str] | None = None):
    bases = [ROOT / r for r in roots] if roots else [ROOT]
    for base in bases:
        if base.is_file():
            yield base
            continue
        if not base.exists():
            continue
        for path in sorted(base.rglob("*")):
            if path.suffix.lower() not in suffixes or not path.is_file():
                continue
            rel_parts = path.relative_to(ROOT).parts
            if any(part in SKIP_DIRS for part in rel_parts[:-1]):
                continue
            yield path


def _rel(path: Path) -> str:
    return str(path.relative_to(ROOT))


def check_viewport(errors: list[str]) -> None:
    for path in _iter_files((".html",)):
        html = path.read_text(errors="replace")
        m = VIEWPORT_RE.search(html)
        if not m:
            errors.append(f"{_rel(path)}: missing <meta name=\"viewport\"> (responsive-standard §1.1)")
            continue
        content = CONTENT_RE.search(m.group(0))
        value = content.group(1) if content else ""
        if "width=device-width" not in value.replace(" ", ""):
            errors.append(f"{_rel(path)}: viewport meta lacks width=device-width")
        if ZOOM_LOCK_RE.search(value):
            errors.append(f"{_rel(path)}: viewport meta disables pinch-zoom ({value!r})")


COMMENT_RE = re.compile(r'/\*.*?\*/', re.S)


def _strip_comments(css: str) -> str:
    # Blank out comment bodies but keep their newlines so line numbers hold.
    return COMMENT_RE.sub(lambda m: re.sub(r'[^\n]', ' ', m.group(0)), css)


def check_css(errors: list[str], warnings: list[str]) -> None:
    for path in _iter_files((".css",), AUTHORED_CSS):
        css = path.read_text(errors="replace")
        for m in ROOT_RULE_RE.finditer(_strip_comments(css)):
            if OVERFLOW_RE.search(m.group(2)):
                line = css.count("\n", 0, m.start()) + 1
                errors.append(
                    f"{_rel(path)}:{line}: `{m.group(1)}` sets overflow hidden — "
                    "banned, it masks horizontal overflow (responsive-standard §1.6)")
        for idx, text in enumerate(css.splitlines(), 1):
            for mm in MEDIA_WIDTH_RE.finditer(text):
                value, unit = float(mm.group(1)), mm.group(2).lower()
                px = value if unit == "px" else value * 16
                if int(px) in CANONICAL_BREAKPOINTS_PX:
                    continue
                if "/*" in text:
                    continue  # documented component exception
                warnings.append(
                    f"{_rel(path)}:{idx}: @media {int(px)}px is not a canonical breakpoint "
                    "(600/900/1200) and has no same-line comment")


def check_tables(warnings: list[str]) -> None:
    files = list(_iter_files((".html",))) + list(_iter_files((".js",), TEMPLATE_JS))
    for path in files:
        text = path.read_text(errors="replace")
        if "<table" not in text.lower():
            continue
        if any(cls in text for cls in TABLE_WRAP_CLASSES):
            continue
        warnings.append(f"{_rel(path)}: renders <table> without a table-wrap wrapper (responsive-standard §1.5)")


def run() -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    check_viewport(errors)
    check_css(errors, warnings)
    check_tables(warnings)
    return errors, warnings


def main() -> int:
    errors, warnings = run()
    for w in warnings:
        print(f"WARN  {w}")
    if errors:
        print("RESPONSIVE CHECK FAILED")
        for e in errors:
            print(f"- {e}")
        return 1
    print(f"RESPONSIVE CHECK OK ({len(warnings)} warning(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main())

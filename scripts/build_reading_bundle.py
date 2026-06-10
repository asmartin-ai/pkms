"""Build the Phase 2 phone reading bundle: one combined .md and one standalone .html
from the reading queue + theme notes. Output goes to exports/ (not the vault, so the
index never sees duplicate content). Re-run any time the theme notes change."""
import re
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parents[1]
RESEARCH = ROOT / "vault" / "resources" / "research"
EXPORTS = ROOT / "exports"
EXPORTS.mkdir(exist_ok=True)

FILES = [
    "05-reading-queue.md",
    "30-theme-capture.md",
    "31-theme-tasks.md",
    "32-theme-retrieval.md",
    "33-theme-inbox-pipeline.md",
    "34-theme-mobile.md",
    "35-theme-llm-organizer.md",
    "36-theme-anti-perfectionism.md",
    "37-theme-self-knowledge.md",
]

PREAMBLE = (
    "# Phase 2 Reading Bundle\n\n"
    "Generated 2026-06-10 from the PKMS vault. Read top to bottom; mark reactions "
    "(✅ resonates / ❌ not me / ❓ unsure) however is easiest — phone notes, "
    "paper, whatever — and transfer them into the vault theme notes (or just tell "
    "Claude your marks and it will file them). One mark per theme is the done-when.\n"
)


def strip_frontmatter(text: str) -> str:
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            return text[end + 4 :].lstrip("\n")
    return text


def main() -> None:
    parts = [PREAMBLE]
    for name in FILES:
        body = strip_frontmatter((RESEARCH / name).read_text(encoding="utf-8"))
        parts.append("\n\n---\n\n" + body)
    combined = "\n".join(parts)

    (EXPORTS / "phase2-reading-bundle.md").write_text(combined, encoding="utf-8")

    # [[wikilinks]] render as emphasis in the standalone HTML (targets aren't bundled)
    html_src = re.sub(r"\[\[([^\]|#]+)(?:[^\]]*)\]\]", r"<em>\1</em>", combined)
    body_html = markdown.markdown(html_src, extensions=["tables", "sane_lists"])
    page = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PKMS Phase 2 Reading Bundle</title>
<style>
 body {{ font-family: -apple-system, Roboto, "Segoe UI", sans-serif; font-size: 17px;
        line-height: 1.55; max-width: 42em; margin: 0 auto; padding: 1em;
        color: #1d1d1f; background: #fbfbf8; }}
 h1 {{ font-size: 1.5em; }} h2 {{ font-size: 1.2em; margin-top: 2em; }}
 table {{ border-collapse: collapse; width: 100%; font-size: 0.92em; }}
 td, th {{ border: 1px solid #ccc; padding: 0.4em; text-align: left; }}
 blockquote {{ border-left: 3px solid #bbb; margin-left: 0; padding-left: 1em; color: #444; }}
 hr {{ border: none; border-top: 2px solid #ddd; margin: 2.5em 0; }}
 em {{ color: #5b5bd6; font-style: normal; }}
 @media (prefers-color-scheme: dark) {{
   body {{ background: #1b1b1d; color: #e6e6e6; }}
   td, th {{ border-color: #444; }} blockquote {{ color: #aaa; }} em {{ color: #9d9df0; }}
 }}
</style></head><body>
{body_html}
</body></html>
"""
    (EXPORTS / "phase2-reading-bundle.html").write_text(page, encoding="utf-8")
    print(f"Wrote {EXPORTS / 'phase2-reading-bundle.md'} and .html")


if __name__ == "__main__":
    main()

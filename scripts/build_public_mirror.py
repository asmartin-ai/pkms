"""Build a sanitized PKMS public mirror from the private canonical checkout.

The mirror is generated from the publication allowlist in check_publication_safety.py.
It copies only tracked allowlisted files, applies deterministic text scrubs for
machine-local/private path shapes, and validates the generated tree before exit.
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
from collections.abc import Sequence
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts import check_publication_safety as safety  # noqa: E402

DEFAULT_OUTPUT = ROOT / "exports" / "public-mirror"
SCRUB_SUFFIXES = {".cmd", ".css", ".html", ".json", ".md", ".toml", ".txt", ".yaml", ".yml"}

WINDOWS_PATH_RE = re.compile(r"(?<![A-Za-z])(?:[A-Za-z]:[\\/][^\s)`'\"<>]+)")
USER_PATH_RE = re.compile(r"(?:/[Uu]sers/[^\s)`'\"<>]+|/home/[^\s)`'\"<>]+)")

SPECIFIC_REPLACEMENTS = (
    ("K:\\Projects\\PKMS", "/path/to/PKMS"),
    ("K:/Projects/PKMS", "/path/to/PKMS"),
    (
        "K:\\Projects\\adhd-design-language\\DESIGN-LANGUAGE.md",
        "/path/to/adhd-design-language/DESIGN-LANGUAGE.md",
    ),
    (
        "K:/Projects/adhd-design-language/DESIGN-LANGUAGE.md",
        "/path/to/adhd-design-language/DESIGN-LANGUAGE.md",
    ),
    ("K:\\Projects\\adhd-design-language", "/path/to/adhd-design-language"),
    ("K:/Projects/adhd-design-language", "/path/to/adhd-design-language"),
    ("K:\\Projects\\content-hoarder\\data\\app.db", "/path/to/content-hoarder/data/app.db"),
    ("K:/Projects/content-hoarder/data/app.db", "/path/to/content-hoarder/data/app.db"),
    ("C:/Users/Kenja/agent-hub/AGENTS.md", "/path/to/agent-hub/AGENTS.md"),
)


def scrub_text(text: str) -> str:
    """Remove machine-local path shapes from mirrored text.

    The canonical repo may retain concrete local paths where they are useful to the
    private workspace. The public mirror gets generic placeholders instead.
    """

    for old, new in SPECIFIC_REPLACEMENTS:
        text = text.replace(old, new)
    text = WINDOWS_PATH_RE.sub("/path/to/local-resource", text)
    text = USER_PATH_RE.sub("/path/to/local-resource", text)
    return text


def should_scrub(path: Path) -> bool:
    return path.suffix.lower() in SCRUB_SUFFIXES


def copy_file(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if safety.is_probably_text(src) and should_scrub(src):
        try:
            text = src.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            shutil.copy2(src, dst)
            return
        dst.write_text(scrub_text(text), encoding="utf-8", newline="")
    else:
        shutil.copy2(src, dst)


def reset_output_dir(output: Path) -> None:
    resolved = output.resolve()
    exports = (ROOT / "exports").resolve()
    if exports not in resolved.parents and resolved != exports:
        raise ValueError(f"refusing to clear output outside exports/: {output}")
    if resolved.exists():
        shutil.rmtree(resolved)
    resolved.mkdir(parents=True)


def generated_files(output: Path) -> list[str]:
    return sorted(
        safety.normalize_path(path.relative_to(output))
        for path in output.rglob("*")
        if path.is_file()
    )


def validate_generated(output: Path) -> list[safety.Finding]:
    findings: list[safety.Finding] = []
    paths = generated_files(output)
    for path in safety.denylisted_paths(paths):
        findings.append(safety.Finding("FAIL", "mirror private path", path, "matches denylist"))
    for path in paths:
        absolute = output / path
        if not absolute.is_file() or not safety.is_probably_text(absolute):
            continue
        try:
            text = absolute.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for risk in safety.content_risks(path, text):
            findings.append(safety.Finding("FAIL", "mirror content", path, risk))
    return findings


def build(output: Path) -> tuple[list[str], list[safety.Finding]]:
    tracked = safety.git_ls_files()
    manifest = safety.mirror_manifest(tracked)
    reset_output_dir(output)
    for rel in manifest:
        copy_file(ROOT / rel, output / rel)
    findings = validate_generated(output)
    return manifest, findings


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the sanitized PKMS public mirror.")
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="output directory under exports/ (default: exports/public-mirror)",
    )
    parser.add_argument(
        "--manifest",
        action="store_true",
        help="print copied files after building",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    manifest, findings = build(args.output)
    print(f"public mirror: wrote {len(manifest)} files to {args.output}")
    if args.manifest:
        for path in manifest:
            print(path)
    safety.print_findings(findings)
    return 1 if findings else 0


if __name__ == "__main__":
    raise SystemExit(main())

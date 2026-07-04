"""Publication safety checks for PKMS.

This script is intentionally conservative. It is a pre-publish/pre-mirror guard,
not a secret scanner that can prove a repository is safe.
"""

from __future__ import annotations

import argparse
import fnmatch
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

ROOT = Path(__file__).resolve().parents[1]

PUBLIC_ALLOWLIST = (
    "AGENTS.md",
    "CLAUDE.md",
    "DESIGN.md",
    "LICENSE",
    "PRODUCT.md",
    "README.md",
    "pyproject.toml",
    "bin/pkms.cmd",
    "scripts/check_publication_safety.py",
    "scripts/build_public_mirror.py",
    "src/**",
    "tests/**",
    ".github/workflows/**",
    ".claude/skills/**",
    ".agents/skills/impeccable/**",
    "docs/**",
    "vault/resources/adhd-design-language-repo.md",
    "vault/resources/research/**",
    "vault/projects/pkms-design/*.md",
)

PRIVATE_DENYLIST = (
    ".secrets/**",
    ".index/**",
    ".venv/**",
    "**/.venv/**",
    ".pytest_cache/**",
    "dist/**",
    "build/**",
    "**/__pycache__/**",
    "*.db",
    "*.sqlite",
    "*.sqlite3",
    "*.db-shm",
    "*.db-wal",
    ".env",
    "*.env.local",
    "*.pem",
    "*.key",
    "*.p12",
    "vault/daily/**",
    "vault/inbox/**",
    "vault/media/**",
    "vault/areas/**",
    "vault/archive/**",
    "vault/**/*.zip",
    "vault/**/*.tar",
    "vault/**/*.tar.gz",
    "vault/**/*.7z",
    "exports/**",
    "spike/**",
    ".impeccable/live/sessions/**",
)

HISTORY_RISK_PATTERNS = PRIVATE_DENYLIST + (
    "**/*secret*",
    "**/*token*",
    "**/*cookie*",
    "**/*credential*",
)

BINARY_SUFFIXES = {
    ".bmp",
    ".db",
    ".gif",
    ".gz",
    ".ico",
    ".jpeg",
    ".jpg",
    ".pdf",
    ".png",
    ".pyd",
    ".pyc",
    ".sqlite",
    ".sqlite3",
    ".tar",
    ".webp",
    ".zip",
}

LOCAL_PATH_RE = re.compile(
    r"(?<![A-Za-z])(?:[A-Za-z]:[\\/][^\s)`'\"]+|/[Uu]sers/[^\s)`'\"]+|/home/[^\s)`'\"]+)"
)
EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
SECRET_ASSIGNMENT_RE = re.compile(
    r"(?i)\b([A-Za-z0-9_-]*(?:api[_-]?key|client[_-]?secret|secret|token|cookie|credential|password)[A-Za-z0-9_-]*)\b"
    r"[ \t]*[:=][ \t]*['\"]?([^'\"\s#<>;,)}]{12,})"
)

EXAMPLE_EMAIL_DOMAINS = ("example.com", "example.org", "example.net", "users.noreply.github.com")
EXAMPLE_SECRET_PREFIXES = ("test-", "example-", "dummy-", "fake-", "YOUR_", "<")
EXAMPLE_LOCAL_PATH_PREFIXES = (
    "C:/Program",
    "C:/fake/",
    "O:/Temp/",
)


@dataclass(frozen=True)
class Finding:
    severity: str
    category: str
    path: str
    detail: str


def normalize_path(path: str | Path) -> str:
    normalized = str(path).replace("\\", "/")
    if normalized.startswith("./"):
        return normalized[2:]
    return normalized


def matches_any(path: str, patterns: Sequence[str]) -> bool:
    normalized = normalize_path(path)
    return any(fnmatch.fnmatchcase(normalized, pattern) for pattern in patterns)


def is_allowlisted(path: str) -> bool:
    return matches_any(path, PUBLIC_ALLOWLIST)


def is_denylisted(path: str) -> bool:
    return matches_any(path, PRIVATE_DENYLIST)


def mirror_manifest(paths: Iterable[str]) -> list[str]:
    return sorted(path for path in map(normalize_path, paths) if is_allowlisted(path))


def denylisted_paths(paths: Iterable[str]) -> list[str]:
    return sorted(path for path in map(normalize_path, paths) if is_denylisted(path))


def history_risk_paths(paths: Iterable[str]) -> list[str]:
    return sorted(
        path for path in map(normalize_path, paths) if matches_any(path, HISTORY_RISK_PATTERNS)
    )


def run_git(args: Sequence[str], *, check: bool = True) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if check and result.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed:\n{result.stderr.strip()}")
    return result.stdout


def git_ls_files() -> list[str]:
    return [line for line in run_git(["ls-files"]).splitlines() if line]


def git_untracked_unignored() -> list[str]:
    lines = run_git(["status", "--porcelain", "-uall"]).splitlines()
    return [normalize_path(line[3:]) for line in lines if line.startswith("?? ")]


def git_history_added_paths() -> list[str]:
    out = run_git(["log", "--all", "--diff-filter=A", "--name-only", "--pretty=format:"])
    return sorted({line for line in out.splitlines() if line})


def is_probably_text(path: Path) -> bool:
    return path.suffix.lower() not in BINARY_SUFFIXES


def is_example_email(email: str) -> bool:
    lower = email.lower()
    return any(lower.endswith("@" + domain) for domain in EXAMPLE_EMAIL_DOMAINS)


def is_example_secret_value(value: str) -> bool:
    return value.startswith(EXAMPLE_SECRET_PREFIXES) or value.upper().startswith("YOUR")


def is_example_local_path(value: str) -> bool:
    normalized = value.replace("\\", "/")
    return any(normalized.startswith(prefix) for prefix in EXAMPLE_LOCAL_PATH_PREFIXES)


def content_risks(path: str, text: str) -> list[str]:
    risks: list[str] = []

    local_paths = sorted({p for p in LOCAL_PATH_RE.findall(text) if not is_example_local_path(p)})
    for local_path in local_paths:
        risks.append(f"local path: {local_path}")

    emails = sorted({email for email in EMAIL_RE.findall(text) if not is_example_email(email)})
    for email in emails:
        risks.append(f"raw email address: {email}")

    for match in SECRET_ASSIGNMENT_RE.finditer(text):
        key = match.group(1)
        value = match.group(2)
        key_is_env_like = key.upper() == key or any(
            word in key.lower() for word in ("secret", "password", "api_key", "apikey")
        )
        value_is_literal_like = not any(part in value for part in (".", "(", "${", "}"))
        if not key_is_env_like or not value_is_literal_like or is_example_secret_value(value):
            continue
        risks.append(f"credential-shaped assignment near: {match.group(0)[:80]}")

    return risks


def scan_tracked_content(paths: Iterable[str]) -> list[Finding]:
    findings: list[Finding] = []
    for path in paths:
        absolute = ROOT / path
        if not absolute.is_file() or not is_probably_text(absolute):
            continue
        try:
            text = absolute.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for risk in content_risks(path, text):
            findings.append(Finding("FAIL", "content", path, risk))
    return findings


def collect_findings(*, include_history: bool) -> tuple[list[Finding], list[str]]:
    tracked = git_ls_files()
    findings: list[Finding] = []

    for path in denylisted_paths(tracked):
        findings.append(Finding("FAIL", "tracked private path", path, "matches private denylist"))

    for path in denylisted_paths(git_untracked_unignored()):
        findings.append(
            Finding("FAIL", "untracked private path", path, "untracked and not ignored")
        )

    manifest = mirror_manifest(tracked)
    for path in denylisted_paths(manifest):
        findings.append(Finding("FAIL", "mirror manifest", path, "allowlist overlaps denylist"))

    findings.extend(scan_tracked_content(manifest))

    if include_history:
        for path in history_risk_paths(git_history_added_paths()):
            findings.append(
                Finding("FAIL", "history risk", path, "private/generated path added in history")
            )

    return findings, manifest


def print_findings(findings: Sequence[Finding]) -> None:
    if not findings:
        print("publication safety: OK")
        return

    print(f"publication safety: {len(findings)} finding(s)")
    for finding in findings:
        print(f"[{finding.severity}] {finding.category}: {finding.path} — {finding.detail}")


def parse_args(argv: Sequence[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Check PKMS publication/mirror safety.")
    parser.add_argument(
        "--history",
        action="store_true",
        help="also scan historical added paths for private/generated path shapes",
    )
    parser.add_argument(
        "--mirror-manifest",
        action="store_true",
        help="print the public mirror allowlist result after checks",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    findings, manifest = collect_findings(include_history=args.history)
    print_findings(findings)

    if args.mirror_manifest:
        print("\nmirror manifest:")
        for path in manifest:
            print(path)

    return 1 if findings else 0


if __name__ == "__main__":
    raise SystemExit(main())

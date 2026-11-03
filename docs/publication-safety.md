# PKMS publication safety

PKMS is developed in the private `pkms-canonical` repository and published as a sanitized mirror in `pkms`. Never push the private repository directly to the public remote. A public mirror update is a normal fast-forward commit on top of the existing public history, not a history rewrite or force-push.

## Publication boundary

The authoritative allowlist and denylist are `PUBLIC_ALLOWLIST` and `PRIVATE_DENYLIST` in [`scripts/check_publication_safety.ts`](../scripts/check_publication_safety.ts). Review changes to them as changes to the publication boundary. The builder selects only tracked files that match the allowlist; unlisted files are private by default, even if they are useful documentation.

The intended public surface includes the application and tests, the Bun package and tooling needed to run and check it, the README and project documents, explicitly selected setup guides and this policy, and public CI. The agent skill directories `.agents/`, `.claude/` and `.impeccable/`, personal vault material and internal planning or research are not part of that public surface. `AGENTS.md` remains public. There is no blanket grant for `docs/` or `vault/`.

Secrets, local indexes, databases, credentials, private captures, daily notes, media and generated exports must not be published. A tracked file being allowlisted is not proof its contents are safe. Review the candidate tree, including fixtures, examples and documentation, for private data, machine-specific information and third-party material before publishing. Keep raw private evidence in the canonical workspace.

## Build and check

From the canonical checkout:

```sh
bun scripts/check_publication_safety.ts --history --mirror-manifest
bun scripts/build_public_mirror.ts --manifest
```

The builder writes `exports/public-mirror/`, replacing its previous generated output. It uses the tracked-file manifest and scrubs certain local path shapes in supported text file types. It checks the resulting tree for denylisted paths and content risks, and rejects symlinks. `--root <directory>` selects a different checkout; the builder also accepts `--output <path>` within its `exports/` directory.

The checker flags tracked denylisted paths, untracked and unignored private paths, allowlist/denylist overlap, and selected content risks in the manifest. It reports possible private or generated paths added in history as warnings, not as proof of a leak or proof that history is clean. The checker and builder have self-referential scanning exemptions; eligible text suffixes receive local-path scrubbing rather than the same pre-build path check. Neither tool replaces review or a full-history secret scan. Findings can contain sensitive text: handle output privately and do not publish it.

## Overlay and publish

1. Start from a fresh clone of the public repository's current default branch in a temporary directory. Do not use the canonical checkout as the public Git repository.
2. Build the reviewed candidate from the canonical checkout. In the temporary public clone, run `git rm -rq .` and then copy the generated mirror into the clone, preserving its `.git` directory. This overlay removes old public files that are no longer allowlisted as well as adding and updating files. Stage the copied files and review the complete resulting changes before committing.
3. Commit the candidate on top of the fetched public branch. Run the publication checker against the candidate, scan its full history with `gitleaks git --redact`, and check the private denylist. Review and resolve findings before publishing; scans are not guarantees of safety. Treat scanner output and private denylist contents as sensitive.
4. Fetch the public default branch again and verify that its tip is an ancestor of the candidate commit. Publish only if the update is a fast-forward. If the public branch moved, stop and rebuild or integrate its changes; never force-push.

The public CI leak scan is an additional check, not a substitute for pre-publication review. Removing a file from the current public tree does not remove it from existing commits, clones or caches. Assume previously published history remains public; this process does not rewrite it.

The public CI personal-path scan excludes only `.github/workflows/leak-scan.yml`, which contains the scan expression, and `tests/ts/publication-safety.test.ts`, which contains synthetic paths used to test the checker. These exclusions apply to that scan, not to every publication check.

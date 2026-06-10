---
tags: [pkms-design, research, adhd, sweep-a, reddit-mcp]
created: 2026-06-09
modified: 2026-06-09
status: raw-findings
---

# Reddit MCP Server Options (tooling scout)

Raw findings from the Sweep A community-anecdotes workflow. 10 findings; 6 sample-verified by an adversarial fact-checker, 0 failed.
Program: [[00-ground-truths]] - Synthesis target: [[10-synthesis]]

## Top takeaways

**Recommendation: `reddit-mcp-buddy`** (704★, read-only by construction, no telemetry, active, official-registry published) — **but anonymous mode is currently broken from this machine**: Reddit started network-blocking unauthenticated JSON in mid-2026 (verified live, 403 from this IP; F2). The fix is a free 2-minute "script app" at reddit.com/prefs/apps (client ID + secret, app-only mode, 60 req/min) — this is NOT the paid API tier.

- **Runner-up:** `jordanburke/reddit-mcp-server` — most active, works keyless at ~10 req/min, but ships write tools (post/edit/delete); read-only-by-construction beats read-only-by-configuration (F3).
- **Hosted plan C:** `reddit-research-mcp` — dodges IP blocks via third-party hosting at a privacy cost (F7).
- **Avoid:** Hawstein (14 months dormant, F4), Arindam200 (mandatory creds + write tools, F5), eliasbiondo (no auth fallback, F6).
- The official MCP registry's "reddit" results are mostly engagement-spam tooling — whitelist a specific audited server, never browse (F8).
- **User action needed:** create the free script app, then add the config in F10's quote to `.mcp.json`. Residual risk to keep in mind: Reddit content is untrusted input to the LLM; read-only tooling caps the blast radius (F9).

**DECISION (2026-06-09):** script-app creation failed silently for the user (same wall as content-hoarder; suspected unverified-email or captcha-block). Interim: **hosted `dialog-mcp` (reddit-research-mcp) added to Claude Code local config** — `claude mcp add --scope local --transport http dialog-mcp https://reddit-research-mcp.fastmcp.app/mcp` — pending one-time OAuth via `/mcp`. Privacy note: queries route through their servers. Backlogged: retry script-app creation, then switch to reddit-mcp-buddy app-only and drop the hosted server.

---

## Findings

### F1. reddit-mcp-buddy is the strongest community-vetted Reddit MCP server: strictly read-only (5 tools: browse_subreddit, search_reddit, get_post_details with full comment trees, user_analysis, reddit_explain), works with zero credentials in anonymous mode (10 req/min), TypeScript via npx, explicit no-telemetry policy, npm OIDC trusted publishing, published in the official MCP registry. 704 GitHub stars, ~6,249 npm downloads/month, v1.1.13 released 2026-05-26, MIT license.

> All tools are read-only - the server never posts, comments, or modifies any Reddit content

- **Source:** https://github.com/karanb192/reddit-mcp-buddy
- **Who:** Repo by karanb192; stats verified via GitHub/npm APIs 2026-06-09 (704 stars, pushed 2026-05-26, 8 open issues). Single-maintainer risk: 58 of 59 commits by one person.
- **Tool/system:** reddit-mcp-buddy — https://github.com/karanb192/reddit-mcp-buddy
- **Design implication:** RECOMMEND as the PKMS's Reddit read tool — read-only matches the threat model, get_post_details returns nested comment trees (the user's win scenario: capture post + discussion). Caveat: pair with free app credentials (next finding).

### F2. CRITICAL caveat verified live: as of June 2026 Reddit network-blocks the unauthenticated JSON API from many IPs ('403 Blocked' from snooserv regardless of User-Agent). reddit-mcp-buddy issues #58/#59 (June 3, 2026) report anonymous mode broken; I reproduced it from this exact Windows machine (www.reddit.com and old.reddit.com .json both 403; RSS endpoint returns 200; OAuth token endpoint returns 401 i.e. reachable, just needs credentials). An open PR (#60, June 8) adds an RSS fallback but is unmerged.

> Reddit network-blocks the unauthenticated JSON API from many IPs... returning 403 Blocked from Server: snooserv... regardless of User-Agent or headers.

- **Source:** https://github.com/karanb192/reddit-mcp-buddy/issues/58
- **Who:** GitHub issues #58–#60 by three separate users, June 2026; blocking behavior independently verified by me from the user's machine (K:\Projects\PKMS host) on 2026-06-09.
- **Tool/system:** reddit-mcp-buddy anonymous mode — https://github.com/karanb192/reddit-mcp-buddy/pull/60
- **Design implication:** Do NOT rely on the zero-credential path for ongoing research from this machine. Create a free Reddit 'script' app (~2 min at reddit.com/prefs/apps — this is NOT the paid API tier) and run buddy in app-only mode: client ID + secret only, no username/password, 60 req/min via OAuth, which bypasses the public-endpoint block.

### F3. jordanburke/reddit-mcp-server is the most actively maintained alternative (v1.4.8 on 2026-05-30, pushed 2026-06-06, 127 stars, ~3,884 npm downloads/month, official-registry published) and also runs credential-free (~10 req/min), but it is NOT read-only: it ships create_post, reply_to_post, edit_post, edit_comment, delete_post, delete_comment. It has thoughtful safeguards (Safe Mode default, write-rate delays, duplicate blocking, no voting/DM tools by policy) but write capability is unnecessary attack surface for research use.

- **Source:** https://github.com/jordanburke/reddit-mcp-server
- **Who:** Repo by jordanburke; stats verified via GitHub/npm APIs 2026-06-09; README capabilities verified by direct read.
- **Tool/system:** reddit-mcp-server (jordanburke) — https://github.com/jordanburke/reddit-mcp-server
- **Design implication:** Runner-up. Acceptable if buddy dies (write tools are inert without username/password configured), but prefer a server that cannot post even in principle — Reddit comments are untrusted input to Claude, and read-only-by-construction beats read-only-by-configuration.

### F4. Hawstein/mcp-server-reddit (177 stars, Python/uvx, read-only 8 tools, no credentials needed via redditwarp) is effectively abandoned: last push 2025-04-14, zero releases ever published, 8 open issues, ~15 total commits. It is also exposed to the same 2026 anonymous-JSON blocking with no maintainer to ship a fix.

- **Source:** https://github.com/Hawstein/mcp-server-reddit
- **Who:** Repo by Hawstein; staleness verified via GitHub API 2026-06-09 (pushed_at 2025-04-14).
- **Tool/system:** mcp-server-reddit (Hawstein) — https://github.com/Hawstein/mcp-server-reddit
- **Design implication:** AVOID for ongoing use despite the appealing read-only/no-key design — fourteen months dormant in an ecosystem where Reddit just changed its blocking behavior means it will break and stay broken.

### F5. Arindam200/reddit-mcp (288 stars, Python/PRAW) requires Reddit client ID + secret even for reads, includes three write tools (create_post, reply_to_post, reply_to_comment), and installs by cloning the repo and pointing uv at server.py rather than a packaged uvx/npx one-liner. Last push 2025-12-21.

- **Source:** https://github.com/Arindam200/reddit-mcp
- **Who:** Repo by Arindam200 (Nebius DevRel); stats via GitHub API 2026-06-09; README verified by direct read.
- **Tool/system:** reddit-mcp (Arindam200) — https://github.com/Arindam200/reddit-mcp
- **Design implication:** AVOID for this use case: it combines the worst of both worlds for the user — mandatory credentials AND write capability AND the clunkiest Windows install of the field.

### F6. eliasbiondo/reddit-mcp-server (141 stars, Python, pushed 2026-03-11) is a credible zero-config, no-API-key, read-only option, but it scrapes the same public JSON endpoints that Reddit began blocking in mid-2026, has a much smaller user base than buddy (fewer eyes on code, fewer people to hit bugs first), and offers no credentialed fallback mode at all.

- **Source:** https://github.com/eliasbiondo/reddit-mcp-server
- **Who:** Repo by eliasbiondo; stats via GitHub API 2026-06-09 (141 stars, 1 open issue).
- **Tool/system:** reddit-mcp-server (eliasbiondo) — https://github.com/eliasbiondo/reddit-mcp-server
- **Design implication:** Pass. Its only differentiator over buddy (zero config) is exactly the mode that is now unreliable, and it lacks buddy's app-only OAuth escape hatch.

### F7. king-of-the-grackles/reddit-research-mcp (121 stars) is a hosted, read-only, research-oriented remote MCP (reddit-research-mcp.fastmcp.app) with discover_subreddits/fetch_comments-style operations and citation-friendly output; no Reddit credentials needed because their servers do the fetching. Trade-offs: your queries route through a third party, auth via Descope OAuth, and you depend on someone else's free hosting staying up.

- **Source:** https://github.com/king-of-the-grackles/reddit-research-mcp
- **Who:** Repo by king-of-the-grackles; published in official MCP registry (v1.0.1); README verified 2026-06-09.
- **Tool/system:** reddit-research-mcp — https://github.com/king-of-the-grackles/reddit-research-mcp
- **Design implication:** Viable plan-C precisely because hosted IPs sidestep Reddit's blocking — but for a privacy-conscious personal vault, a local stdio server with the user's own free credentials is strictly better. Note for the PKMS: its 'structured insights with citations' framing matches the research-capture use case.

### F8. The official MCP registry (registry.modelcontextprotocol.io) search for 'reddit' is dominated by marketing/growth/ads servers (RedditGrow 'cold DMs, autopilot', Reddit Ads MCPs, monitoring SaaS) — a meaningful adverse-selection signal. Only reddit-mcp-buddy and jordanburke/reddit-mcp-server appear as actively-versioned general-purpose readers; the official modelcontextprotocol/servers reference set includes no Reddit server at all.

- **Source:** https://registry.modelcontextprotocol.io/v0/servers?search=reddit
- **Who:** Official MCP registry API, queried directly 2026-06-09 (31 entries reviewed).
- **Tool/system:** Official MCP registry — https://registry.modelcontextprotocol.io
- **Design implication:** Vetting matters in this niche: most 'Reddit MCP' results exist to automate engagement spam, not reading. Whitelist a specific audited server rather than browsing a marketplace; both finalists being registry-published with OIDC-verified npm publishing is the best available provenance signal.

### F9. Security posture check on the winner: reddit-mcp-buddy states no telemetry ('We don't collect, store, or transmit any analytics'), keeps passwords in-memory only, never logs client secrets, recommends env-var credential injection, fixed a vulnerable MCP SDK dependency promptly (issue #47, May 2026), and moved to npm trusted publishing/OIDC (Feb 2026). Gaps: no SECURITY.md/private disclosure route yet (open issues #49/#56), and it is single-maintainer. Separately, any Reddit reader feeds untrusted text to Claude — prompt injection via post/comment content is the residual risk, which is why read-only tooling matters.

> No Tracking: We don't collect, store, or transmit any analytics, telemetry, or usage data

- **Source:** https://github.com/karanb192/reddit-mcp-buddy/issues/49
- **Who:** README security section + issue tracker read directly 2026-06-09; prompt-injection framing per Embrace The Red / Unit 42 MCP security research (2025).
- **Tool/system:** reddit-mcp-buddy security posture — https://github.com/karanb192/reddit-mcp-buddy
- **Design implication:** For the PKMS capture pipeline: treat fetched Reddit content as data, not instructions (the read-only server caps blast radius at 'bad note content', not 'agent posts on your account'). Use app-only creds (no Reddit password anywhere). Pin the npm version in config if paranoid about single-maintainer supply chain.

### F10. FINAL RANKING: (1) reddit-mcp-buddy — read-only by construction, best stars/downloads, active May-2026 release, no telemetry; run it in app-only mode (free 2-minute script app at reddit.com/prefs/apps, client ID + secret only, 60 req/min) because anonymous mode is currently broken from this machine's network. (2) jordanburke/reddit-mcp-server — most active maintenance, works credential-free at ~10 req/min, but ships write tools (leave username/password unset if used). (3) king-of-the-grackles/reddit-research-mcp — hosted fallback that dodges IP blocks at the cost of third-party routing. Everything else: stale (Hawstein), credentials+write (Arindam200), niche/no-fallback (eliasbiondo), or marketing-ware (registry bulk).

> "reddit": {"command": "npx", "args": ["-y", "reddit-mcp-buddy"], "env": {"REDDIT_CLIENT_ID": "<free-script-app-id>", "REDDIT_CLIENT_SECRET": "<secret>"}}

- **Source:** https://github.com/karanb192/reddit-mcp-buddy#authentication-setup-optional
- **Who:** Synthesis of all sources above; endpoint behavior verified live from the user's Windows machine 2026-06-09.
- **Tool/system:** Winner install — reddit-mcp-buddy
- **Design implication:** Install winner in claude_desktop_config.json / .mcp.json (see quote). Works in Claude Desktop and Claude Code on Windows via npx (Node already present). Verify after install by asking Claude to fetch a known thread's comments; if 403s appear, the app-only env vars are the fix, not a different server.

---

## Coverage notes (what was NOT covered)

Searched: web search (multiple queries), official MCP registry API (31 reddit-matching entries reviewed), GitHub API (stars/push dates/issues/contributors for 6 repos), npm downloads API, and direct README reads for 5 candidates. Verified live from the user's machine: reddit.com + old.reddit.com unauthenticated .json = 403 (snooserv block), .rss = 200, OAuth token endpoint = 401 (reachable) — so the no-API-key constraint is the one thing this environment cannot reliably satisfy long-term; a free script app (not the paid API) is the honest fix. Found but NOT fully evaluated: SuperMCP (webmatrices) — reuses your logged-in Chrome session, flagged as a security anti-pattern for agent use, not audited; Apify Reddit MCP (makework36, mypracticaltools wrapper) — hosted, residential proxies, paid platform; BigVik193-reddit-user-mcp (Smithery-hosted); ai.trendsmcp/reddit, lignertys/reddit-insights-mcp, malamutemayhem/unclick (registry entries, mostly SaaS); GeLi2001/reddit-mcp (3 stars, skipped); netixc and sumitroyyy forks (no traction). Dead ends: could not read r/mcp or r/ClaudeAI threads directly (Reddit JSON blocked from this machine — which itself became a finding) and web searches surfaced no substantial named-server discussion threads, so 'community-vetted' rests on stars/downloads/registry presence/issue-tracker health rather than quoted Reddit testimonials. Did not test an end-to-end install with real credentials (user has none yet); app-only mode viability is inferred from the reachable OAuth token endpoint plus the README's documented mode, not a live token exchange. PyPI stats not pulled for Python candidates (all were eliminated on other grounds first).

## Verification sample

- [verified] https://github.com/karanb192/reddit-mcp-buddy — All checkable facts match live sources (GitHub API, npm registry, raw README, MCP registry, 2026-06-09/10): 704 stars; MIT; TypeScript; v1.1.13 published 2026-05-26; 6,249 npm downloads/month; exactly the 5 named tools; anonymous mode 10 req/min; explicit 'No Tracking... analytics, telemetry, or usage data' policy; npx install; SLSA provenance attestations on the 1.1.13 npm dist (trusted publishing); listed in registry.modelcontextprotocol.io as io.github.karanb192/reddit-mcp-buddy. Quote is verbatim from README ('All tools are read-only - the server never posts, comments, or modifies any Reddit content'). Contributor split confirmed: karanb192 58 commits, MurphyLo 1 (58 of 59). 'Strongest community-vetted' is opinion but consistent with the star/download lead over alternatives I checked.
- [verified] https://github.com/karanb192/reddit-mcp-buddy/issues/58 — Issue #58 exists, open, created 2026-06-03, titled 'Anon API access no longer works' (body empty — title only). Issue #59 ('Not working anymore') also 2026-06-03, different user. PR #60 exists, created 2026-06-08, unmerged, adds RSS fallback; the finding's quote appears verbatim in PR #60's body (the PR is cited in the finding's tool_or_system field), not in issue #58 itself. Three distinct users across #58/#59/#60 confirmed. I independently reproduced the block from this machine on 2026-06-10: www.reddit.com/r/programming/hot.json -> 403 (HTML block page) even with full browser UA; old.reddit.com .json -> 403; /hot/.rss -> 200; OAuth token endpoint -> 401 (reachable, needs credentials). Every element of the claim holds.
- [verified] https://github.com/jordanburke/reddit-mcp-server — GitHub API: 127 stars, pushed 2026-06-06, TypeScript. npm 'reddit-mcp-server' (repository field links to this repo): latest v1.4.8 published 2026-05-30; 3,884 downloads/month. Listed in official MCP registry as io.github.jordanburke/reddit-mcp-server. README confirms all six write tools by exact name (create_post, reply_to_post, edit_post, edit_comment, delete_post, delete_comment), REDDIT_SAFE_MODE default 'standard' with write delays and duplicate detection (including cross-subreddit), explicit policy exclusions of voting/karma and DM tools, and zero-setup anonymous mode at ~10 req/min. No quote to check (empty).
- [verified] https://github.com/Hawstein/mcp-server-reddit — GitHub API: 177 stars, Python, pushed_at 2025-04-14 (~14 months before 2026-06-09), 8 open issues, 0 releases and 0 tags ever, exactly 15 commits (Link header last page=15 at per_page=1). README confirms uvx install, redditwarp against Reddit's public API (no credentials), and exactly 8 tools, all read-only (get_frontpage_posts through get_post_comments). 'Exposed to the same 2026 blocking' is an inference, but sound: it uses the same unauthenticated public API I verified returns 403 from this machine. No quote to check (empty).
- [verified] https://github.com/Arindam200/reddit-mcp — GitHub API: 288 stars, Python, pushed 2025-12-21. README confirms PRAW-based; install is 'Clone this repository' then point uv at server.py in the client config (no packaged uvx/npx one-liner anywhere in README); 'Read-only Tools (require only client credentials)' confirms client ID+secret are mandatory even for reads; authenticated tools are exactly create_post, reply_to_post, reply_to_comment. No quote to check (empty).
- [verified] https://github.com/eliasbiondo/reddit-mcp-server — GitHub API: 141 stars, Python, pushed 2026-03-11, 1 open issue. README: 'No API keys, no authentication, no browser required'; all 6 tools (search, search_subreddit, get_post, get_subreddit_posts, get_user, get_user_posts) are read-only; no credentialed/OAuth fallback mode appears anywhere in the README or config options. Underlying 'redd' library README states 'No API keys — uses Reddit's public .json endpoints', supporting the claim it depends on exactly the endpoints now returning 403 (which I verified live from this machine). Smaller user base than buddy is consistent (141 vs 704 stars; PyPI package, no npm download comparison available). No quote to check (empty).


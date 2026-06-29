---
target: src/pkms/web/index.html
total_score: 23
p0_count: 0
p1_count: 3
timestamp: 2026-06-29T19-46-57Z
slug: src-pkms-web-index-html
---
# Firefox New Tab UI Critique

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Initial load has no skeleton; auxiliary loads fail quietly; done feedback reads real though completion is session-local. |
| 2 | Match System / Real World | 3 | Tone fits ADHD re-entry, but terms like pebbles, fold in, and resurface require learned meaning. |
| 3 | User Control and Freedom | 2 | Undo is partial; lead-action completion is ambiguous; service/setup recovery is weak. |
| 4 | Consistency and Standards | 2 | Calm/more/everything, find/search, and deeper surfaces do not all keep their promises. |
| 5 | Error Prevention | 2 | Accidental completion is too easy; capture clear and let-go flows need stronger guardrails. |
| 6 | Recognition Rather Than Recall | 3 | Recognition-first intent is strong, but recent/search candidates are currently thin/unwired. |
| 7 | Flexibility and Efficiency | 2 | Capture shortcut and density modes help, but density/search/done state are not yet robust. |
| 8 | Aesthetic and Minimalist Design | 3 | Calm editorial hierarchy works, but top chrome and repeated kickers compete with the lede. |
| 9 | Error Recovery | 2 | Error copy is understandable but not recovery-oriented enough for a new-tab front door. |
| 10 | Help and Documentation | 2 | Inline hints exist, but first-run/setup/vocabulary onboarding is thin. |
| **Total** | | **23/40** | **Acceptable: strong concept, trust gaps before it feels dependable.** |

## Anti-Patterns Verdict

**LLM assessment:** Mostly not AI slop. The UI avoids generic SaaS tells like hero metrics, glass, gradients, red urgency, and Momentum-style clock/greeting theater. The strongest risk is over-authored calm: warm paper, serif prose, mono kickers, pebbles, and explanatory copy can become self-conscious if every section uses the same cadence.

**Deterministic scan:** The isolated target scan reported 1 `single-font` warning on `src/pkms/web/index.html`, likely a false positive because the CSS uses three explicit font roles: serif, sans, and mono. A broader configured baseline after ignores reports 16 actionable findings on the source UI: 10 low-contrast, 2 tiny-text, 1 cramped-padding, 1 all-caps-body, 1 flat-type-hierarchy, and 1 layout-transition.

**Visual overlays:** Browser automation could not launch Chrome in this environment, so no reliable user-visible overlay is available.

## Overall Impression

The concept is right: a new-tab briefing that restores context without becoming a dashboard. But the implementation is halfway between poetic poster and product surface. The next overhaul should make the UI more trustworthy and less performative: fewer controls before the lede, fewer cute labels, clearer primary action semantics, and persistence behind every state that looks real.

## What's Working

1. **The product stance is specific.** The interface rejects Momentum cosplay and task-manager guilt. The lede plus one-next-action model directly serves ADHD re-entry.
2. **Density as a concept is good.** Calm by default with denser modes one click away is aligned with the design language.
3. **Capture feels emotionally safe.** The copy and keyboard path reinforce that the system owns later.

## Priority Issues

### [P1] Completion UI is not trustworthy

**Why it matters:** `toggleDone()` changes local JS state only. If the UI says done and reload loses it, the product breaks its own source-of-truth promise.

**Fix:** Persist task completion through a backend endpoint that updates the markdown task line, or remove completion affordances from the new-tab UI until persistence exists.

**Suggested command:** `$impeccable harden src/pkms/web`

### [P1] The primary lead action is dangerously ambiguous

**Why it matters:** The largest button says “the next thing,” but clicking marks the task done. It looks like start/open/continue, not complete.

**Fix:** Split the lead row into a primary “continue/open note” action and a secondary explicit “mark done” action.

**Suggested command:** `$impeccable shape Firefox new-tab lead action`

### [P1] Advanced surfaces are promised before they are real

**Why it matters:** Find/search, recent candidates, more actions, and everything mode imply deeper functionality that is currently thin or stubbed. That erodes confidence.

**Fix:** Either wire search/recent/more-actions or hide/rename those routes until they are useful.

**Suggested command:** `$impeccable harden src/pkms/web`

### [P2] Top chrome competes with re-entry

**Why it matters:** Before the user reaches the day’s actual context, they see density controls and five nav links. That creates decision load above the intended glance anchor.

**Fix:** Persist density, reduce the salience control prominence, and consider making capture the only always-prominent secondary route.

**Suggested command:** `$impeccable layout src/pkms/web/index.html`

### [P2] Visual polish has accessibility debt

**Why it matters:** The configured detector still finds low contrast, tiny text, flat small-type hierarchy, cramped shelf padding, all-caps body-like text, and a layout-property transition.

**Fix:** Raise `--ink-faint` contrast or scope it to non-body labels only; increase tiny metadata sizes; replace `padding-left` transition with transform/opacity; add shelf inset.

**Suggested command:** `$impeccable polish src/pkms/web`

## Persona Red Flags

**ADHD primary user:** Too many controls before the next action; local-only done state creates future distrust; service failure does not offer a calm fallback; `Esc` clearing capture is risky.

**First-timer:** “fold in,” “pebbles,” and “resurface” are charming but not self-explanatory. The find route may look broken if candidates/search are empty.

**Power user:** No persisted density, no functional global search, no keyboard route shortcuts, and no trustworthy full backlog path.

## Minor Observations

- The repeated mono uppercase kickers are close to the “tiny uppercase eyebrow everywhere” trope.
- The warm paper identity is intentional but now needs stronger content specificity to avoid beige-product sameness.
- `PAGE CLEARED` is conceptually right, but only if completion is persisted truth.
- Route naming mismatch (`find` vs `search`) is small but symptomatic of promise drift.

## Questions to Consider

1. What if the primary new-tab action was continue/open, and completion was always secondary?
2. If calm is the default, why does density need to sit above the day’s actual context?
3. Which private terms are worth keeping, and which make the first week harder?
4. What should the page become when the service is down: setup card, offline shell, or local capture-only mode?

/* ============================================================================
   PKMS "focus" — app logic #3
   Single-focus: one action at a time, huge type, near-monochrome.
   Same data contract; different interaction model (serial, not list-first).
   ============================================================================ */

(() => {
  "use strict";

  /* ---------------------------------------------------------------------------
     1. FAKE DATA — identical contract to mockups #1 and #2.
     --------------------------------------------------------------------------- */
  const TODAY = {
    date: "2026-06-22",
    breadcrumb: {
      name: "2026-06-21",
      lines: [
        "folded the F6 promote path-mismatch fix into the sweep lane",
        "drafted the GLM frontend brief — blind take, mockup-first",
        "started slicing the design-language §4 decay-card work",
        "left the B6 quiet-decay-line copy half-written",
      ],
    },
    inbox_new: 3,
    done_today: 2,
    next_read: {
      title: "The Cost of Interrupted Work: More Faster and Worse",
      minutes: 12,
      promoted: "2026-06-18",
    },
    resurface: {
      title: "Barkley on the performance/knowledge distinction",
      question: "Still chewing on what 'performance disorder' means in practice?",
      why: "short · cited in 4 of your recent notes",
      path: "resources/barkley-performance-disorder.md",
    },
    next_actions: [
      {
        note: "projects/pkms-design.md",
        title: "PKMS design",
        text: "land the GLM visual-home mockup",
        size: "30m",
        first_action: "open the design-brief and re-read the HARD BOUNDS",
        done_when: "the four deliverables sit in spike/visual-home-glm/ and open clean",
      },
      {
        note: "projects/sweep-bakeoff.md",
        title: "Sweep bakeoff",
        text: "close out the B6 quiet-decay-line copy",
        size: "15m",
        first_action: "open vault/projects/sweep-bakeoff.md and find the half-written line",
        done_when: "the decay-line copy is merged and reads ambient, not accusatory",
      },
      {
        note: "projects/decay-cards.md",
        title: "Decay cards",
        text: "sketch the §4 reshape-before-fade card states",
        size: "45m",
        first_action: "make a list of the 3 card variants (reshaped / not-now / stashed)",
        done_when: "each state has a one-line spec and a shame-free label",
      },
      {
        note: "projects/capture-on-ramp.md",
        title: "Capture on-ramp",
        text: "decide on the keyboard shortcut for the capture ramp",
        size: "10m",
        first_action: "open the decisions log and add the gate",
        done_when: "one option is picked with a one-line why",
      },
      {
        note: "projects/indexer-rebuild.md",
        title: "Indexer rebuild",
        text: "write the regeneration test for the .as_posix() path invariant",
        size: "20m",
        first_action: "open src/pkms/indexer.py at line 25",
        done_when: "the test fails when rel uses backslashes, passes with .as_posix()",
      },
      {
        note: "projects/reading-queue-promote.md",
        title: "Reading queue promote",
        text: "wire the promoted-date sort into the queue view",
        size: "25m",
        first_action: "open today.py:124 (the queued-items sort)",
        done_when: "queue renders oldest-promoted first, matches the design",
      },
      {
        note: "projects/resurface-filter.md",
        title: "Resurface filter",
        text: "add the resurface:never frontmatter check to candidates",
        size: "15m",
        first_action: "open resurface.py and find filter_never",
        done_when: "frontmatter flag is respected and tested",
      },
      {
        note: "projects/honesty-section.md",
        title: "Honesty section",
        text: "audit the mockup for any forbidden patterns",
        size: "10m",
        first_action: "open HONESTY.md and run the absence checklist",
        done_when: "every forbidden pattern is confirmed absent or explicitly flagged",
      },
    ],
    more_notes: 4,
  };

  const MORE_ACTIONS = [
    { note: "projects/quiet-decay-line.md", title: "Quiet decay line", text: "land the ambient disclosure copy for sweep waves", size: "15m", first_action: "open vault/projects/sweep-bakeoff.md and find the half-written line", done_when: "decay line reads ambient and dismissable, never modal or alerting" },
    { note: "projects/mobile-capture-latency.md", title: "Mobile capture latency", text: "measure the cold-start time of the capture ramp", size: "20m", first_action: "open the capture ramp on a cold mobile browser tab", done_when: "latency is under the 2-second bar (§1) or a fix is filed" },
    { note: "projects/pebble-reset-logic.md", title: "Pebble reset logic", text: "verify pebbles reset at local midnight with no debt", size: "10m", first_action: "open the pebbles data-contract spec (DATA-CONTRACT.md §4)", done_when: "the reset invariant is tested and the no-debt property holds" },
    { note: "projects/resurface-no-renag.md", title: "Resurface no-renag", text: "confirm the not-now window actually suppresses re-presentation", size: "15m", first_action: "open resurface.py and find the dismissal/offer bookkeeping", done_when: "dismissed items do not reappear inside the no-renag window" },
  ];

  const RECOGNITION_CARDS = [
    { kind: "reading", title: "The Cost of Interrupted Work: More Faster and Worse", why: "next in your reading queue", minutes: 12, promoted: "2026-06-18" },
    { kind: "resurface", title: "Barkley on the performance/knowledge distinction", why: "short · cited in 4 of your recent notes" },
    { kind: "reading", title: "Recognition vs. recall in memory research (Gathercole)", why: "next in your reading queue", minutes: 18, promoted: "2026-06-15" },
  ];

  const READING_QUEUE = [
    { title: "The Cost of Interrupted Work: More Faster and Worse", minutes: 12, promoted: "2026-06-18", why: "next up · shortest in the queue", path: "resources/reading/cost-of-interrupted-work.md" },
    { title: "Recognition vs. recall in memory research", minutes: 18, promoted: "2026-06-15", why: "cited by three notes you've touched this week", path: "resources/reading/recognition-vs-recall.md" },
    { title: "Barkley — ADHD as a performance disorder (BK1–BK8)", minutes: 25, promoted: "2026-06-12", why: "foundational · you've quoted it twice", path: "resources/reading/barkley-performance-disorder.md" },
    { title: "Loss aversion and the sunk-cost fallacy in personal archives", minutes: null, promoted: "2026-06-08", why: "long read · no minutes recorded", path: "resources/reading/loss-aversion-archives.md" },
  ];

  const PEBBLES = {
    date: "2026-06-22", count: 2, goal: null,
    entries: [
      { label: "folded the F6 promote fix", at: "09:42" },
      { label: "drafted the GLM frontend brief", at: "11:15" },
    ],
  };

  const RECENT_NOTES = [
    { title: "PKMS design", path: "projects/pkms-design.md", touched: "yesterday" },
    { title: "Sweep bakeoff", path: "projects/sweep-bakeoff.md", touched: "yesterday" },
    { title: "Frontend design brief — GLM-5.2", path: "projects/pkms-design/frontend-design-brief-glm.md", touched: "yesterday" },
    { title: "Decay cards", path: "projects/decay-cards.md", touched: "2 days ago" },
    { title: "Barkley on performance disorders", path: "resources/barkley-performance-disorder.md", touched: "3 days ago" },
    { title: "Capture on-ramp", path: "projects/capture-on-ramp.md", touched: "4 days ago" },
    { title: "The Cost of Interrupted Work", path: "resources/reading/cost-of-interrupted-work.md", touched: "5 days ago" },
    { title: "Indexer rebuild", path: "projects/indexer-rebuild.md", touched: "last week" },
  ];

  const MAX_NOTES_SHOWN = 8;

  /* ---------------------------------------------------------------------------
     2. STATE + HELPERS (identical to #1/#2)
     --------------------------------------------------------------------------- */
  const state = {
    route: "today",
    density: "calm",
    doneNotes: new Set(),
    moreExpanded: false,
    resurfaceDismissed: false,
    elsewhereOpen: false,
  };

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const fmtDate = (iso) => {
    try { return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }); }
    catch { return iso; }
  };
  const fmtShortDate = (iso) => {
    try { return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
    catch { return iso; }
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function ledeText() {
    const bc = TODAY.breadcrumb;
    if (!bc || !bc.name) {
      const a = TODAY.next_actions[0];
      return { html: `A few days have passed. Nothing's overdue — here's where you left <strong>${esc(a.title)}</strong>.`, lines: [] };
    }
    const a = TODAY.next_actions[0];
    return { html: `Yesterday you were in <strong>${esc(a.title)}</strong>.`, lines: bc.lines || [] };
  }

  /* ---------------------------------------------------------------------------
     3. RENDER — Today (single-focus hero)
     --------------------------------------------------------------------------- */
  function renderToday() {
    $("#masthead-date").textContent = fmtDate(TODAY.date);

    const lede = ledeText();
    $("#lede").innerHTML = lede.html;
    const subEl = $("#lede-sub");
    if (lede.lines.length) {
      subEl.innerHTML = `<ul>${lede.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
      subEl.hidden = false;
    } else { subEl.hidden = true; }

    // The hero action — the first not-done action
    const hero = TODAY.next_actions.find((a) => !state.doneNotes.has(a.note));
    const heroEl = $("#hero");
    const clearedEl = $("#cleared");

    if (hero) {
      $("#hero-action-text").textContent = hero.first_action || hero.text;
      $("#hero-do-size").textContent = hero.size ? `⏱ ${hero.size}` : "";
      $("#hero-meta").innerHTML =
        `<span class="hero__meta-item" data-glyph="✓">${esc(hero.done_when || hero.text)}</span>` +
        `<span class="hero__meta-item" data-glyph="※">${esc(hero.note)}</span>`;
      heroEl.style.display = "";
      heroEl.querySelector(".hero__kicker").textContent = `the one thing · ${hero.title}`;
      // Hide cleared
      clearedEl.classList.add("is-hidden");
    } else {
      // No hero — show cleared (but cleared is rendered separately too; hide hero content)
      heroEl.style.display = "none";
    }

    // Fold-in progress
    const inbox = TODAY.inbox_new;
    const done = TODAY.done_today + state.doneNotes.size;
    const foldTotal = inbox + TODAY.done_today;
    const foldEl = $("#fold");
    if (inbox > 0) {
      foldEl.innerHTML =
        `<span class="hero__fold-progress">${done} / ${foldTotal}</span>` +
        `<span>${inbox} new to fold in</span>` +
        `<span class="hero__fold-hint">when something sparks</span>`;
    } else {
      foldEl.innerHTML = `<span>nothing new to fold in.</span>`;
    }

    renderResurface();
    renderReadingLine();
    renderChain($("#actions"), true);
    renderMoreNotes();
    renderPebbles();
    checkCleared();
  }

  function renderResurface() {
    const el = $("#resurface");
    if (!TODAY.resurface || state.resurfaceDismissed) { el.innerHTML = ""; return; }
    const r = TODAY.resurface;
    el.innerHTML = `
      <p class="resurface__question">${esc(r.question)}</p>
      <p class="resurface__why">${esc(r.why)}</p>
      <div class="resurface__actions">
        <button type="button" data-resurface="not-now">not now</button>
        <button type="button" data-resurface="let-go" class="btn--ghost">let it go</button>
      </div>`;
  }

  function renderReadingLine() {
    const el = $("#reading-line");
    const c = RECOGNITION_CARDS.find((c) => c.kind === "reading");
    if (!c) { el.innerHTML = ""; return; }
    el.innerHTML = `
      <h3 class="elsewhere__reading-title"><a href="#">${esc(c.title)}</a></h3>
      <div class="elsewhere__reading-row">
        ${c.minutes ? `<span class="elsewhere__reading-cost">⏱ ~${c.minutes} min</span>` : ""}
        <span>${esc(c.why)}</span>
      </div>`;
  }

  function renderChain(listEl, leadExcluded) {
    // In single-focus mode, the hero is the first not-done; the chain shows the rest
    const items = TODAY.next_actions.filter((a, i) => state.doneNotes.has(a.note) ? false : !(leadExcluded && a === TODAY.next_actions.find((x) => !state.doneNotes.has(x.note))));
    listEl.innerHTML = items.map(actionHtml).join("");
  }

  function actionHtml(a) {
    const done = state.doneNotes.has(a.note);
    const doneWhen = a.done_when || a.text;
    return `
      <li class="chain__item ${done ? "chain__item--done" : ""}" data-note="${esc(a.note)}">
        <h3 class="chain__title"><a href="#actions" data-go="actions">${esc(a.title)}</a></h3>
        <p class="chain__first"><span class="chain__first-verb">▶</span>${esc(a.first_action || a.text)}</p>
        <div class="chain__meta">
          ${a.size ? `<span>⏱ ${esc(a.size)}</span>` : ""}
          <span>✓ ${esc(doneWhen)}</span>
        </div>
        <button class="chain__toggle" type="button" data-done-toggle="${esc(a.note)}">
          ${done ? "✓ done" : "mark done"}
        </button>
      </li>`;
  }

  function renderMoreNotes() {
    const el = $("#more-notes");
    const more = TODAY.more_notes;
    if (more <= 0 || state.density === "everything") { el.hidden = true; return; }
    el.hidden = false;
    const expanded = state.moreExpanded;
    const hiddenItems = MORE_ACTIONS.slice(0, more);
    el.innerHTML = `
      <button class="chain__more-toggle" type="button" data-more-toggle>
        ${expanded ? "hide" : `${more} more one click away`}
      </button>
      <div class="chain__more-list" ${expanded ? "" : "hidden"}>
        <ul class="chain" style="list-style:none; margin:0.5rem 0 0; padding:0;">
          ${hiddenItems.map((a) => actionHtml(a)).join("")}
        </ul>
      </div>`;
  }

  function renderPebbles() {
    const el = $("#pebbles");
    const total = PEBBLES.count + state.doneNotes.size;
    if (total === 0) {
      el.className = "pebbles pebbles--empty";
      el.innerHTML = `nothing finished yet — that's fine.`;
      return;
    }
    el.className = "pebbles";
    const dots = Array.from({ length: total }, () => `<span class="pebble"></span>`).join("");
    const caption = PEBBLES.goal
      ? `<span class="pebbles__caption">${total} of ${PEBBLES.goal} today</span>`
      : `<span class="pebbles__caption">${total} ${total === 1 ? "win" : "wins"} today</span>`;
    el.innerHTML = dots + caption;
  }

  function checkCleared() {
    const cleared = $("#cleared");
    const visible = TODAY.next_actions.slice(0, MAX_NOTES_SHOWN);
    const allDone = visible.length > 0 && visible.every((a) => state.doneNotes.has(a.note));
    if (allDone) {
      cleared.classList.remove("is-hidden");
      $("#hero").style.display = "none";
      const cp = $("#cleared-pebbles");
      const total = PEBBLES.count + state.doneNotes.size;
      cp.innerHTML = Array.from({ length: total }, () => `<span class="pebble"></span>`).join("");
    } else {
      cleared.classList.add("is-hidden");
    }
  }

  /* ---------------------------------------------------------------------------
     4. RENDER — other surfaces
     --------------------------------------------------------------------------- */
  function renderReading() {
    $("#reading-list").innerHTML = READING_QUEUE.map((r) => {
      const cost = r.minutes ? `<span class="reading-item__cost">⏱ ~${r.minutes} min</span>` : `<span class="reading-item__cost" style="color:var(--ink-faint);">long read</span>`;
      return `
        <li class="reading-item">
          <h3 class="reading-item__title"><a href="#">${esc(r.title)}</a></h3>
          <div class="reading-item__row">${cost}<span>${esc(r.why)}</span><span>queued ${esc(fmtShortDate(r.promoted))}</span></div>
        </li>`;
    }).join("");
  }

  function renderActionsFull() {
    // Full surface: show ALL actions including done, no lead exclusion
    const items = TODAY.next_actions;
    $("#actions-full").innerHTML = items.map(actionHtml).join("");
  }

  function renderSearch() {
    $("#search-candidates").innerHTML = RECENT_NOTES.map((n) => `
      <li data-path="${esc(n.path)}">
        ${esc(n.title)}
        <small>${esc(n.path)} · touched ${esc(n.touched)}</small>
      </li>`).join("");
  }

  /* ---------------------------------------------------------------------------
     5. ROUTER
     --------------------------------------------------------------------------- */
  function router() {
    const hash = (location.hash || "#today").replace(/^#/, "");
    const route = ["today", "capture", "reading", "actions", "search"].includes(hash) ? hash : "today";
    state.route = route;
    $$("[data-surface]").forEach((s) => { s.hidden = s.dataset.surface !== route; });
    $$(".nav a").forEach((a) => {
      a.removeAttribute("aria-current");
      if (a.dataset.route === route) a.setAttribute("aria-current", "page");
    });
    if (route === "today")   renderToday();
    if (route === "reading") renderReading();
    if (route === "actions") renderActionsFull();
    if (route === "search")  renderSearch();
    if (route === "capture") { const f = $("#capture-field"); if (f) f.focus(); }
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  /* ---------------------------------------------------------------------------
     6. INTERACTIONS
     --------------------------------------------------------------------------- */
  function setDensity(level) {
    state.density = level;
    document.body.className = `density-${level}`;
    $$("[data-density]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.density === level)));
    if (state.route === "today") renderToday();
  }

  function toggleDone(note) {
    if (state.doneNotes.has(note)) {
      state.doneNotes.delete(note);
    } else {
      state.doneNotes.add(note);
      const all = [...TODAY.next_actions, ...MORE_ACTIONS];
      const label = all.find((a) => a.note === note)?.title || "done";
      showToast(`✓ ${label}`, {
        action: "undo",
        onAction: () => { state.doneNotes.delete(note); rerenderCurrent(); },
        duration: 3500,
      });
    }
    rerenderCurrent();
  }

  function rerenderCurrent() {
    if (state.route === "today") renderToday();
    else if (state.route === "actions") renderActionsFull();
  }

  function toggleElsewhere() {
    state.elsewhereOpen = !state.elsewhereOpen;
    const btn = $("[data-elsewhere]");
    const content = $("#elsewhere-content");
    btn.setAttribute("aria-expanded", String(state.elsewhereOpen));
    content.classList.toggle("is-open", state.elsewhereOpen);
  }

  function saveCapture() {
    const field = $("#capture-field");
    const text = field.value.trim();
    if (!text) return;
    const stem = new Date().toISOString().slice(0, 10);
    const slug = text.toLowerCase().slice(0, 30).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const filename = `${stem}-${slug || "note"}.md`;
    const wrap = $(".capture");
    const confirm = document.createElement("div");
    confirm.className = "capture__confirm";
    confirm.innerHTML = `saved.<small>${esc(filename)}</small>`;
    field.replaceWith(confirm);
    $("#capture-status").textContent = "saved ✓";
    setTimeout(() => {
      const newField = document.createElement("textarea");
      newField.className = "capture__field";
      newField.id = "capture-field";
      newField.placeholder = "say it…";
      newField.setAttribute("aria-label", "Capture box");
      newField.autofocus = true;
      confirm.replaceWith(newField);
      newField.focus();
      $("#capture-status").textContent = "unsaved";
    }, 1500);
    showToast(`✓ captured`, { duration: 2500 });
  }

  function dismissResurface(kind) {
    state.resurfaceDismissed = true;
    renderResurface();
    if (kind === "let-go") {
      showToast(`let go.`, {
        action: "keep it",
        onAction: () => { state.resurfaceDismissed = false; renderResurface(); },
        duration: 5000,
      });
    }
  }

  let toastTimer = null;
  function showToast(msg, opts = {}) {
    const toast = $("#toast");
    $("#toast-msg").textContent = msg;
    const actionBtn = $("#toast-action");
    if (opts.action && opts.onAction) {
      actionBtn.textContent = opts.action;
      actionBtn.hidden = false;
      actionBtn.onclick = () => { opts.onAction(); hideToast(); };
    } else { actionBtn.hidden = true; }
    toast.classList.add("toast--visible");
    clearTimeout(toastTimer);
    if (opts.duration !== 0) toastTimer = setTimeout(hideToast, opts.duration || 3500);
  }
  function hideToast() { $("#toast").classList.remove("toast--visible"); }

  /* ---------------------------------------------------------------------------
     7. WIRING + INIT
     --------------------------------------------------------------------------- */
  function wire() {
    window.addEventListener("hashchange", router);

    $$("[data-density]").forEach((b) => b.addEventListener("click", () => setDensity(b.dataset.density)));

    $("#hero-do").addEventListener("click", () => {
      const hero = TODAY.next_actions.find((a) => !state.doneNotes.has(a.note));
      if (hero) toggleDone(hero.note);
    });

    document.addEventListener("click", (e) => {
      const t = e.target.closest("[data-done-toggle], [data-resurface], [data-more-toggle], [data-go], [data-path], [data-elsewhere]");
      if (!t) return;
      if (t.dataset.doneToggle) toggleDone(t.dataset.doneToggle);
      else if (t.dataset.resurface) dismissResurface(t.dataset.resurface);
      else if (t.hasAttribute("data-more-toggle")) { state.moreExpanded = !state.moreExpanded; renderMoreNotes(); }
      else if (t.dataset.elsewhere) toggleElsewhere();
      else if (t.dataset.go) location.hash = `#${t.dataset.go}`;
      else if (t.dataset.path) showToast(`→ ${t.dataset.path} (mockup: would open the note)`, { duration: 2500 });
    });

    document.addEventListener("keydown", (e) => {
      if (state.route !== "capture") return;
      const field = $("#capture-field");
      if (!field) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); saveCapture(); }
      else if (e.key === "Escape") { field.value = ""; field.focus(); }
    });
  }

  function init() { wire(); router(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

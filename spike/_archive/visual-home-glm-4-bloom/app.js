/* ============================================================================
   PKMS "the bloom" — app logic #4
   Same /api/today data contract. Distinct interactions:
   - Rhythm partition (Fresh / Later) — clock-free, Things 3 "This Evening" generalized
   - Half-life resurface indicator — Readwise-inspired, clock-free
   - Logbook as wins-only archive — Things 3 inspired
   - Bounded daily edition — The Browser's finite refresh pattern
   See RESEARCH.md for provenance.
   ============================================================================ */

(() => {
  "use strict";

  /* ---------------------------------------------------------------------------
     1. FAKE DATA — identical contract to #1/#2/#3.
        Plus two research-informed derivations: rhythm partition + half-life.
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
        rhythm: "fresh",   // proposed field — see DATA-CONTRACT.md
      },
      {
        note: "projects/sweep-bakeoff.md",
        title: "Sweep bakeoff",
        text: "close out the B6 quiet-decay-line copy",
        size: "15m",
        first_action: "open vault/projects/sweep-bakeoff.md and find the half-written line",
        done_when: "the decay-line copy is merged and reads ambient, not accusatory",
        rhythm: "fresh",
      },
      {
        note: "projects/decay-cards.md",
        title: "Decay cards",
        text: "sketch the §4 reshape-before-fade card states",
        size: "45m",
        first_action: "make a list of the 3 card variants (reshaped / not-now / stashed)",
        done_when: "each state has a one-line spec and a shame-free label",
        rhythm: "later",  // long, better when settled
      },
      {
        note: "projects/capture-on-ramp.md",
        title: "Capture on-ramp",
        text: "decide on the keyboard shortcut for the capture ramp",
        size: "10m",
        first_action: "open the decisions log and add the gate",
        done_when: "one option is picked with a one-line why",
        rhythm: "fresh",
      },
      {
        note: "projects/indexer-rebuild.md",
        title: "Indexer rebuild",
        text: "write the regeneration test for the .as_posix() path invariant",
        size: "20m",
        first_action: "open src/pkms/indexer.py at line 25",
        done_when: "the test fails when rel uses backslashes, passes with .as_posix()",
        rhythm: "later",
      },
      {
        note: "projects/reading-queue-promote.md",
        title: "Reading queue promote",
        text: "wire the promoted-date sort into the queue view",
        size: "25m",
        first_action: "open today.py:124 (the queued-items sort)",
        done_when: "queue renders oldest-promoted first, matches the design",
        rhythm: "later",
      },
      {
        note: "projects/resurface-filter.md",
        title: "Resurface filter",
        text: "add the resurface:never frontmatter check to candidates",
        size: "15m",
        first_action: "open resurface.py and find filter_never",
        done_when: "frontmatter flag is respected and tested",
        rhythm: "fresh",
      },
      {
        note: "projects/honesty-section.md",
        title: "Honesty section",
        text: "audit the mockup for any forbidden patterns",
        size: "10m",
        first_action: "open HONESTY.md and run the absence checklist",
        done_when: "every forbidden pattern is confirmed absent or explicitly flagged",
        rhythm: "later",
      },
    ],
    more_notes: 4,
  };

  const MORE_ACTIONS = [
    { note: "projects/quiet-decay-line.md", title: "Quiet decay line", text: "land the ambient disclosure copy for sweep waves", size: "15m", first_action: "open vault/projects/sweep-bakeoff.md and find the half-written line", done_when: "decay line reads ambient and dismissable, never modal or alerting", rhythm: "fresh" },
    { note: "projects/mobile-capture-latency.md", title: "Mobile capture latency", text: "measure the cold-start time of the capture ramp", size: "20m", first_action: "open the capture ramp on a cold mobile browser tab", done_when: "latency is under the 2-second bar (§1) or a fix is filed", rhythm: "later" },
    { note: "projects/pebble-reset-logic.md", title: "Pebble reset logic", text: "verify pebbles reset at local midnight with no debt", size: "10m", first_action: "open the pebbles data-contract spec (DATA-CONTRACT.md §4)", done_when: "the reset invariant is tested and the no-debt property holds", rhythm: "fresh" },
    { note: "projects/resurface-no-renag.md", title: "Resurface no-renag", text: "confirm the not-now window actually suppresses re-presentation", size: "15m", first_action: "open resurface.py and find the dismissal/offer bookkeeping", done_when: "dismissed items do not reappear inside the no-renag window", rhythm: "later" },
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
     2. STATE + HELPERS
     --------------------------------------------------------------------------- */
  const state = {
    route: "today",
    density: "calm",
    doneNotes: new Set(),
    moreExpanded: false,
    resurfaceDismissed: false,
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
      return { html: `A few days have passed. <strong>Nothing's overdue</strong> — here's where you left <strong>${esc(a.title)}</strong>.`, lines: [] };
    }
    const a = TODAY.next_actions[0];
    return { html: `Yesterday you were in <strong>${esc(a.title)}</strong>.`, lines: bc.lines || [] };
  }

  /// Half-life indicator — Readwise-inspired, clock-free.
  /// Mockup: derives a friendly "recall dipping" label from the promoted date.
  function halflifeLabel(promoted) {
    const days = Math.floor((Date.now() - new Date(promoted + "T00:00:00").getTime()) / 86400000);
    if (days < 7)  return "recall fading gently";
    if (days < 14) return "recall dipping";
    if (days < 28) return "ready to resurface";
    return "worth another look";
  }

  /* ---------------------------------------------------------------------------
     3. RENDER — Today (the bloom)
     --------------------------------------------------------------------------- */
  function renderToday() {
    $("#masthead-date").textContent = fmtDate(TODAY.date);
    $("#edition-date").textContent = fmtShortDate(TODAY.date);

    // Lede
    const lede = ledeText();
    $("#lede").innerHTML = lede.html;
    const subEl = $("#lede-sub");
    if (lede.lines.length) {
      subEl.innerHTML = `<ul>${lede.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
      subEl.hidden = false;
    } else { subEl.hidden = true; }

    // The bloom — the first not-done fresh-rhythm action
    const hero = TODAY.next_actions.find((a) => !state.doneNotes.has(a.note));
    const bloomEl = $("#bloom");
    const clearedEl = $("#cleared");

    if (hero) {
      $("#bloom-action-text").textContent = hero.first_action || hero.text;
      $("#bloom-do-size").textContent = hero.size ? `⏱ ${hero.size}` : "";
      bloomEl.style.display = "";
      clearedEl.classList.add("is-hidden");
    } else {
      bloomEl.style.display = "none";
    }

    // Fold-in progress
    const inbox = TODAY.inbox_new;
    const done = TODAY.done_today + state.doneNotes.size;
    const foldTotal = inbox + TODAY.done_today;
    const foldEl = $("#fold");
    if (inbox > 0) {
      foldEl.innerHTML =
        `<span class="bloom__fold-progress">${done} / ${foldTotal}</span>` +
        `<span>${inbox} new to fold in</span>` +
        `<span class="bloom__fold-hint">when something sparks</span>`;
    } else {
      foldEl.innerHTML = `<span>nothing new to fold in.</span>`;
    }

    renderRhythm();
    renderAmbient();
    renderPebbles();
    checkCleared();
  }

  function renderRhythm() {
    // Fresh = short actions, high energy. Later = longer, settle-in work.
    const freshItems = TODAY.next_actions.filter((a) => a.rhythm === "fresh" && !state.doneNotes.has(a.note));
    const laterItems = TODAY.next_actions.filter((a) => a.rhythm === "later" && !state.doneNotes.has(a.note));

    // Exclude the hero (it's shown in the bloom)
    const hero = TODAY.next_actions.find((a) => !state.doneNotes.has(a.note));
    const freshFiltered = freshItems.filter((a) => a.note !== hero?.note);

    $("#rhythm-fresh").innerHTML = freshFiltered.length
      ? freshFiltered.map(rhythmItemHtml).join("")
      : `<p style="font-family:var(--display);font-style:italic;color:var(--ink-faint);font-size:var(--step--1);">nothing fresh left — nice.</p>`;

    $("#rhythm-later").innerHTML = laterItems.length
      ? laterItems.map(rhythmItemHtml).join("")
      : `<p style="font-family:var(--display);font-style:italic;color:var(--ink-faint);font-size:var(--step--1);">nothing for later — all clear.</p>`;
  }

  function rhythmItemHtml(a) {
    const done = state.doneNotes.has(a.note);
    return `
      <div class="rhythm__item ${done ? "rhythm__item--done" : ""}" data-note="${esc(a.note)}">
        <div class="rhythm__item-title">${esc(a.title)}</div>
        <div class="rhythm__item-first"><span class="rhythm__item-first-verb">▶</span>${esc(a.first_action || a.text)}</div>
        <div class="rhythm__item-meta">${a.size ? `⏱ ${esc(a.size)} · ` : ""}✓ ${esc(a.done_when || a.text)}</div>
        <button class="rhythm__item-toggle" type="button" data-done-toggle="${esc(a.note)}">
          ${done ? "✓ done" : "mark done"}
        </button>
      </div>`;
  }

  function renderAmbient() {
    const el = $("#ambient");
    const cards = [];

    // Resurface card (sky) — the single curious question
    if (TODAY.resurface && !state.resurfaceDismissed) {
      const r = TODAY.resurface;
      cards.push(`
        <div class="card card--sky">
          <span class="card__kind">a curious question</span>
          <p class="card__question">${esc(r.question)}</p>
          <span class="card__halflife">recall dipping · ready to resurface</span>
          <p class="card__why">${esc(r.why)}</p>
          <div class="card__actions">
            <button type="button" data-resurface="not-now">not now</button>
            <button type="button" data-resurface="let-go" class="btn--ghost">let it go</button>
          </div>
        </div>`);
    }

    // Reading card (sage) — today's long-read
    const reading = RECOGNITION_CARDS.find((c) => c.kind === "reading");
    if (reading) {
      cards.push(`
        <div class="card card--sage">
          <span class="card__kind">on the reading tray</span>
          <h3 class="card__title"><a href="#">${esc(reading.title)}</a></h3>
          ${reading.minutes ? `<span class="card__cost">⏱ ~${reading.minutes} min</span>` : ""}
          <p class="card__why">${esc(reading.why)}</p>
        </div>`);
    }

    el.innerHTML = cards.join("");
  }

  function renderPebbles() {
    const el = $("#pebbles");
    const total = PEBBLES.count + state.doneNotes.size;
    if (total === 0) {
      el.className = "pebbles pebbles--empty";
      el.innerHTML = `nothing in the logbook yet — that's fine.`;
      return;
    }
    el.className = "pebbles";
    // Show pebbles as labeled pills (Things 3 Logbook style — named wins)
    const dots = PEBBLES.entries.slice(0, PEBBLES.count).map((e) =>
      `<span class="pebble"><span class="pebble__dot"></span>${esc(e.label)}</span>`
    ).join("");
    // Add session dones as unlabeled pebbles
    const sessionDones = Array.from(state.doneNotes).map((note) => {
      const all = [...TODAY.next_actions, ...MORE_ACTIONS];
      const a = all.find((x) => x.note === note);
      return `<span class="pebble"><span class="pebble__dot"></span>${esc(a?.title || "done")}</span>`;
    }).join("");
    const caption = PEBBLES.goal
      ? `<span class="pebbles__caption">${total} of ${PEBBLES.goal} today</span>`
      : `<span class="pebbles__caption">${total} ${total === 1 ? "win" : "wins"} today</span>`;
    el.innerHTML = dots + sessionDones + caption;
  }

  function checkCleared() {
    const cleared = $("#cleared");
    const visible = TODAY.next_actions.slice(0, MAX_NOTES_SHOWN);
    const allDone = visible.length > 0 && visible.every((a) => state.doneNotes.has(a.note));
    if (allDone) {
      cleared.classList.remove("is-hidden");
      $("#bloom").style.display = "none";
      const cp = $("#cleared-pebbles");
      const total = PEBBLES.count + state.doneNotes.size;
      cp.innerHTML = Array.from({ length: total }, () => `<span class="pebble"><span class="pebble__dot"></span></span>`).join("");
    } else {
      cleared.classList.add("is-hidden");
    }
  }

  /* ---------------------------------------------------------------------------
     4. RENDER — other surfaces
     --------------------------------------------------------------------------- */
  function renderReading() {
    $("#reading-list").innerHTML = READING_QUEUE.map((r) => {
      const cost = r.minutes ? `<span class="reading-item__cost">⏱ ~${r.minutes} min</span>` : `<span class="reading-item__cost" style="color:var(--ink-faint);background:transparent;">long read</span>`;
      return `
        <li class="reading-item">
          <h3 class="reading-item__title"><a href="#">${esc(r.title)}</a></h3>
          <div class="reading-item__row">${cost}<span>${esc(r.why)}</span><span>queued ${esc(fmtShortDate(r.promoted))}</span></div>
        </li>`;
    }).join("");
  }

  function renderActionsFull() {
    // Full actions surface: all actions split by rhythm
    const fresh = TODAY.next_actions.filter((a) => a.rhythm === "fresh");
    const later = TODAY.next_actions.filter((a) => a.rhythm === "later");
    $("#actions-fresh").innerHTML = fresh.map(rhythmItemHtml).join("");
    $("#actions-later").innerHTML = later.map(rhythmItemHtml).join("");
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
      showToast(`✓ ${label} — logged`, {
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
    confirm.innerHTML = `saved to the garden.<small>${esc(filename)}</small>`;
    field.replaceWith(confirm);
    $("#capture-status").textContent = "saved ✓";
    setTimeout(() => {
      const newField = document.createElement("textarea");
      newField.className = "capture__field";
      newField.id = "capture-field";
      newField.placeholder = "whatever just bloomed…";
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
    renderAmbient();
    if (kind === "let-go") {
      showToast(`let go. you can undo if not.`, {
        action: "keep it",
        onAction: () => { state.resurfaceDismissed = false; renderAmbient(); },
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
    $("#bloom-do").addEventListener("click", () => {
      const hero = TODAY.next_actions.find((a) => !state.doneNotes.has(a.note));
      if (hero) toggleDone(hero.note);
    });
    document.addEventListener("click", (e) => {
      const t = e.target.closest("[data-done-toggle], [data-resurface], [data-go], [data-path]");
      if (!t) return;
      if (t.dataset.doneToggle) toggleDone(t.dataset.doneToggle);
      else if (t.dataset.resurface) dismissResurface(t.dataset.resurface);
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

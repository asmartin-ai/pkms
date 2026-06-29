/* ============================================================================
   PKMS "ambient poster" — new-tab edition — app logic
   Vanilla JS, no framework, no build step, no external fetch.
   Same data contract as the daily-edition mockup (exact /api/today field
   names, verified against today.py:172-184); only the render targets differ
   because the HTML structure recomposed from app-column to full-bleed poster.
   ============================================================================ */

(() => {
  "use strict";

  /* ---------------------------------------------------------------------------
     1. LIVE DATA — fetched from /api/today (the app's only data source).
     Token rides in location.search (?token=...). Shape is the exact contract
     from today.py:172-184; the mockup's inlined fake JSON is gone.
     Overflow actions, recognition cards, reading queue, pebbles, recent notes
     are proposed endpoints (see DATA-CONTRACT.md). Until those ship, the
     optional surfaces stay empty and calm mode (the default) hides them.
     --------------------------------------------------------------------------- */
  let TODAY = null;          // populated by loadToday()
  const MORE_ACTIONS = [];   // populated when /api/next-actions ships
  const RECOGNITION_CARDS = [];
  const READING_QUEUE = [];
  const PEBBLES = { count: 0, goal: null, entries: [] };
  const RECENT_NOTES = [];

  /// MAX_NOTES_SHOWN mirrors today.py:15.
  const MAX_NOTES_SHOWN = 8;

  /// Fetch /api/today and render. The capture service serves this at the same
  /// origin as /web/, so the fetch is same-origin + token-gated via ?token=...
  async function loadToday() {
    try {
      const r = await fetch("/api/today" + location.search, {
        headers: { Accept: "application/json" },
      });
      if (r.status === 403) return showError("token required — open with ?token=..."  );
      if (!r.ok) return showError("couldn't load today (" + r.status + ")");
      TODAY = await r.json();
      // pebbles derive from done_today until /api/pebbles ships
      PEBBLES.count = TODAY.done_today || 0;
      if (state.route === "today") renderToday();
    } catch (e) {
      showError("couldn't reach the service — is pkms serve running?");
    }
  }

  function showError(msg) {
    const el = document.getElementById("error-banner");
    if (el) { el.textContent = msg; el.hidden = false; }
  }

  /* ---------------------------------------------------------------------------
     2. STATE
     --------------------------------------------------------------------------- */
  const state = {
    route: "today",
    density: "calm",
    doneNotes: new Set(),
    moreExpanded: false,
    resurfaceDismissed: false,
  };

  /* ---------------------------------------------------------------------------
     3. HELPERS
     --------------------------------------------------------------------------- */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const fmtDate = (iso) => {
    try {
      const d = new Date(iso + "T00:00:00");
      return d.toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });
    } catch { return iso; }
  };

  const fmtShortDate = (iso) => {
    try {
      const d = new Date(iso + "T00:00:00");
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch { return iso; }
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));

  /// The lede renders the breadcrumb as prose. THIS is the page's glance anchor
  /// — it does the re-entry welcome-back job (§7) without a Momentum-style
  /// greeting. Gap logic: if no daily note yesterday, soften the lede — shame-free.
  /// Empty-actions guard: when nothing is owed (the design's "win" state), the
  /// lede says so calmly instead of dereferencing next_actions[0] (which would
  /// throw and leave the poster half-rendered — no error banner, stuck on the
  /// HTML-comment placeholder).
  function ledeText() {
    const bc = TODAY.breadcrumb;
    const action = TODAY.next_actions[0];
    if (!action) {
      // Nothing owed — the calm win state (fresh install, cleared, weekend).
      return {
        html: `Nothing's owed today. Come back when something sparks.`,
        lines: [],
      };
    }
    if (!bc || !bc.name) {
      // Gap day — no breadcrumb. Soften, never bill.
      return {
        html: `It's been a few days. Nothing's overdue — here's where ` +
              `<strong>${esc(action.title)}</strong> was when you last touched it.`,
        lines: [],
      };
    }
    return {
      html: `Yesterday you were in <strong>${esc(action.title)}</strong>, ` +
            `${esc(action.text)}.`,
      lines: bc.lines || [],
    };
  }

  /* ---------------------------------------------------------------------------
     4. RENDER — Today (the poster centerpiece)
     --------------------------------------------------------------------------- */
  function renderToday() {
    if (!TODAY) return;  // loadToday() re-calls renderToday() once data lands
    try {
      _renderTodayImpl();
    } catch (e) {
      // A render error must never leave the poster half-rendered (stuck on
      // HTML-comment placeholders with no banner). Surface it explicitly.
      console.error(e);
      showError("today-view hit a render error — check the console");
    }
  }

  function _renderTodayImpl() {
    // Masthead date — quiet mono metadata, NOT a hero.
    $("#masthead-date").textContent = fmtDate(TODAY.date);

    // ── Lede (re-entry breadcrumb-as-prose) — the glance anchor ──
    const lede = ledeText();
    $("#lede").innerHTML = lede.html;
    const subEl = $("#lede-sub");
    if (lede.lines.length) {
      subEl.innerHTML = `<ul>${lede.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
      subEl.hidden = false;
    } else {
      subEl.hidden = true;
    }

    // ── Lead action — the single biggest, warmest affordance ──
    const lead = TODAY.next_actions[0];
    const leadBody = $("#lead-action-body");
    const leadSize = $("#lead-action-size");
    if (lead && !state.doneNotes.has(lead.note)) {
      leadBody.innerHTML = `<span class="lead-action__verb">▶</span>${esc(lead.first_action || lead.text)}`;
      leadSize.textContent = lead.size ? `⏱ ${lead.size}` : "";
      $("#lead-action").hidden = false;
    } else {
      $("#lead-action").hidden = true;
    }

    // ── Shelf: to fold in, pebbles, resurface ──
    renderFold();
    renderPebbles();
    renderResurface();

    // ── Optional blocks (density-gated) ──
    renderRecognitionCards();
    renderActions($("#actions"), true);
    renderMoreNotes();

    checkCleared();
  }

  function renderFold() {
    const inbox = TODAY.inbox_new;
    const done = TODAY.done_today + state.doneNotes.size;
    const foldTotal = inbox + TODAY.done_today;
    const foldEl = $("#fold");
    if (inbox > 0) {
      foldEl.innerHTML =
        `<span class="fold__progress">${done} / ${foldTotal}</span>` +
        `<span>${inbox} new to fold in</span>` +
        `<span class="fold__hint">when something sparks</span>`;
    } else {
      foldEl.innerHTML = `<span>nothing new to fold in.</span>`;
    }
  }

  function renderRecognitionCards() {
    const el = $("#recognition-cards");
    if (!el || !RECOGNITION_CARDS.length) { if (el) el.innerHTML = ""; return; }

    el.innerHTML = RECOGNITION_CARDS.map((c) => {
      const kindClass = c.kind === "reading" ? "card--reading" : "card--resurface";
      const kindLabel = c.kind === "reading" ? "reading" : "resurfacing";
      const cost = (c.kind === "reading" && c.minutes)
        ? `<span class="card__cost">⏱ ~${c.minutes} min</span>`
        : "";
      return `
        <article class="card ${kindClass}">
          <span class="card__kind">${kindLabel}</span>
          <h3 class="card__title">${esc(c.title)}</h3>
          ${cost}
          <p class="card__why">${esc(c.why)}</p>
        </article>`;
    }).join("");
  }

  function renderResurface() {
    const cell = $("#resurface-cell");
    const el = $("#resurface");
    if (!TODAY.resurface || state.resurfaceDismissed) {
      cell.hidden = true;
      return;
    }
    cell.hidden = false;
    const r = TODAY.resurface;
    el.innerHTML = `
      <p class="resurface__question">${esc(r.question)}</p>
      <p class="resurface__why">${esc(r.why)}</p>
      <div class="resurface__actions">
        <button type="button" data-resurface="not-now">not now</button>
        <button type="button" data-resurface="let-go" class="btn--ghost">let it go</button>
      </div>`;
  }

  function renderActions(listEl, leadExcluded) {
    if (!listEl) return;
    const items = TODAY.next_actions.filter((a, i) =>
      !(leadExcluded && i === 0)
    );
    listEl.innerHTML = items.map((a) => actionHtml(a)).join("");
  }

  function actionHtml(a) {
    const done = state.doneNotes.has(a.note);
    const doneWhen = a.done_when || a.text;
    return `
      <li class="action ${done ? "action--done" : ""}" data-note="${esc(a.note)}">
        <div class="action__title"><a href="#actions" data-go="actions">${esc(a.title)}</a></div>
        <div class="action__size">${a.size ? `⏱ ${esc(a.size)}` : ""}</div>
        <div class="action__first">
          <span class="action__first-verb">▶</span><span class="action__first-text">${esc(a.first_action || a.text)}</span>
        </div>
        <div class="action__done-when">${esc(doneWhen)}</div>
        <button class="action__done-toggle" type="button" data-done-toggle="${esc(a.note)}">
          <span class="glyph">✓</span> ${done ? "done" : "mark done"}
        </button>
      </li>`;
  }

  function renderMoreNotes() {
    const el = $("#more-notes");
    if (!el) return;
    const more = TODAY.more_notes;
    if (more <= 0 || state.density === "everything") {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const expanded = state.moreExpanded;
    const hiddenItems = MORE_ACTIONS.slice(0, more);

    el.innerHTML = `
      <button class="more-notes__toggle" type="button" data-more-toggle>
        ${expanded ? "▲ hide" : `${more} more one click away`}
      </button>
      <div class="more-notes__list" ${expanded ? "" : "hidden"}>
        <ul class="actions" style="list-style:none; margin:0.5rem 0 0; padding:0;">
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
      ? `<span class="pebbles__caption">${total}${PEBBLES.goal ? ` of ${PEBBLES.goal}` : ""} today</span>`
      : `<span class="pebbles__caption">${total} ${total === 1 ? "win" : "wins"} today</span>`;
    el.innerHTML = dots + caption;
  }

  function checkCleared() {
    const cleared = $("#cleared");
    const visibleActions = TODAY.next_actions.filter((_, i) => i < MAX_NOTES_SHOWN);
    const allDone = visibleActions.length > 0 &&
      visibleActions.every((a) => state.doneNotes.has(a.note));

    if (allDone) {
      cleared.classList.remove("is-hidden");
      const cp = $("#cleared-pebbles");
      const total = PEBBLES.count + state.doneNotes.size;
      cp.innerHTML = Array.from({ length: total }, () => `<span class="pebble"></span>`).join("");
    } else {
      cleared.classList.add("is-hidden");
    }
  }

  /* ---------------------------------------------------------------------------
     5. RENDER — Reading queue
     --------------------------------------------------------------------------- */
  function renderReading() {
    const el = $("#reading-list");
    el.innerHTML = READING_QUEUE.map((r) => {
      const cost = r.minutes
        ? `<span class="reading-item__cost">⏱ ~${r.minutes} min</span>`
        : `<span class="reading-item__cost" style="background:transparent;color:var(--ink-faint);">long read</span>`;
      return `
        <li class="reading-item">
          <h3 class="reading-item__title"><a href="#">${esc(r.title)}</a></h3>
          <div class="reading-item__row">
            ${cost}
            <span>${esc(r.why)}</span>
            <span>queued ${esc(fmtShortDate(r.promoted))}</span>
          </div>
        </li>`;
    }).join("");
  }

  /* ---------------------------------------------------------------------------
     6. RENDER — Actions surface (full list)
     --------------------------------------------------------------------------- */
  function renderActionsFull() {
    renderActions($("#actions-full"), false);
  }

  /* ---------------------------------------------------------------------------
     7. RENDER — Search (recognition-first picker)
     --------------------------------------------------------------------------- */
  function renderSearch() {
    const el = $("#search-candidates");
    el.innerHTML = RECENT_NOTES.map((n) => `
      <li data-path="${esc(n.path)}">
        ${esc(n.title)}
        <small>${esc(n.path)} · touched ${esc(n.touched)}</small>
      </li>`).join("");
  }

  /* ---------------------------------------------------------------------------
     8. ROUTER
     --------------------------------------------------------------------------- */
  function router() {
    const hash = (location.hash || "#today").replace(/^#/, "");
    const route = ["today", "capture", "reading", "actions", "search"].includes(hash)
      ? hash : "today";
    state.route = route;

    $$("[data-surface]").forEach((s) => {
      s.hidden = s.dataset.surface !== route;
    });

    $$(".nav a").forEach((a) => {
      a.removeAttribute("aria-current");
      if (a.dataset.route === route) a.setAttribute("aria-current", "page");
    });

    if (route === "today")   renderToday();
    if (route === "reading") renderReading();
    if (route === "actions") renderActionsFull();
    if (route === "search")  renderSearch();
    if (route === "capture") {
      const f = $("#capture-field");
      if (f) f.focus();
    }

    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  /* ---------------------------------------------------------------------------
     9. INTERACTIONS
     --------------------------------------------------------------------------- */

  /// Salience knob — the one sanctioned personalization (§8).
  function setDensity(level) {
    state.density = level;
    document.body.className = `density-${level}`;
    $$("[data-density]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.density === level));
    });
    if (state.route === "today") renderToday();
  }

  /// Mark an action done → pebble appears, item settles out, check cleared.
  function toggleDone(note) {
    if (state.doneNotes.has(note)) {
      state.doneNotes.delete(note);
    } else {
      state.doneNotes.add(note);
      const all = [...TODAY.next_actions, ...MORE_ACTIONS];
      const label = all.find((a) => a.note === note)?.title || "done";
      showToast(`✓ ${label} — a pebble for today`, {
        action: "undo",
        onAction: () => {
          state.doneNotes.delete(note);
          rerenderCurrent();
        },
        duration: 3500,
      });
    }
    rerenderCurrent();
  }

  function rerenderCurrent() {
    if (state.route === "today")       renderToday();
    else if (state.route === "actions") renderActionsFull();
  }

  /// Capture save — Cmd/Ctrl+Enter. Never loads the app.
  async function saveCapture() {
    const field = $("#capture-field");
    const text = field.value.trim();
    if (!text) return;

    const status = $("#capture-status");
    field.disabled = true;
    if (status) status.textContent = "saving…";

    let savedLabel = "saved";
    try {
      const r = await fetch("/capture" + location.search, {
        method: "POST",
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: text,
      });
      const body = await r.text();
      if (!r.ok) throw new Error(body || `capture failed (${r.status})`);
      savedLabel = body || savedLabel;
    } catch (e) {
      field.disabled = false;
      field.focus();
      if (status) status.textContent = "not saved yet";
      showToast("not saved yet — service unreachable", { duration: 3500 });
      return;
    }

    const confirm = document.createElement("div");
    confirm.className = "capture__confirm";
    confirm.innerHTML = `<span class="glyph">✓</span> saved<small>${esc(savedLabel)}</small>`;
    field.replaceWith(confirm);
    if (status) status.textContent = "saved ✓";

    await loadToday();

    setTimeout(() => {
      const newField = document.createElement("textarea");
      newField.className = "capture__field";
      newField.id = "capture-field";
      newField.placeholder = "whatever just crossed your mind…";
      newField.setAttribute("aria-label", "Capture box");
      newField.autofocus = true;
      confirm.replaceWith(newField);
      newField.focus();
      if (status) status.textContent = "unsaved";
    }, 1500);

    showToast(`✓ captured — the system owns "later"`, { duration: 2500 });
  }

  /// Resurface: not-now (silent, no-renag) or let-it-go (forever-exit, reversible).
  function dismissResurface(kind) {
    state.resurfaceDismissed = true;
    renderResurface();

    if (kind === "let-go") {
      showToast(`let go. you can undo if not.`, {
        action: "keep it",
        onAction: () => {
          state.resurfaceDismissed = false;
          renderResurface();
        },
        duration: 5000,
      });
    }
  }

  /// The toast is the ambient disclosure channel — never a modal/badge/alert (§4).
  let toastTimer = null;
  function showToast(msg, opts = {}) {
    const toast = $("#toast");
    const msgEl = $("#toast-msg");
    const actionBtn = $("#toast-action");
    msgEl.textContent = msg;

    if (opts.action && opts.onAction) {
      actionBtn.textContent = opts.action;
      actionBtn.hidden = false;
      actionBtn.onclick = () => {
        opts.onAction();
        hideToast();
      };
    } else {
      actionBtn.hidden = true;
    }

    toast.classList.add("toast--visible");
    clearTimeout(toastTimer);
    if (opts.duration !== 0) {
      toastTimer = setTimeout(hideToast, opts.duration || 3500);
    }
  }
  function hideToast() {
    $("#toast").classList.remove("toast--visible");
  }

  /* ---------------------------------------------------------------------------
     10. EVENT WIRING
     --------------------------------------------------------------------------- */
  function wire() {
    window.addEventListener("hashchange", router);

    $$("[data-density]").forEach((b) => {
      b.addEventListener("click", () => setDensity(b.dataset.density));
    });

    $("#lead-action").addEventListener("click", () => {
      const lead = TODAY.next_actions[0];
      if (lead) toggleDone(lead.note);
    });

    document.addEventListener("click", (e) => {
      const t = e.target.closest(
        "[data-done-toggle], [data-resurface], [data-more-toggle], [data-go], [data-path]"
      );
      if (!t) return;

      if (t.dataset.doneToggle) {
        toggleDone(t.dataset.doneToggle);
      } else if (t.dataset.resurface) {
        dismissResurface(t.dataset.resurface);
      } else if (t.hasAttribute("data-more-toggle")) {
        state.moreExpanded = !state.moreExpanded;
        renderMoreNotes();
      } else if (t.dataset.go) {
        location.hash = `#${t.dataset.go}`;
      } else if (t.dataset.path) {
        showToast(`→ ${t.dataset.path} (mockup: would open the note)`, { duration: 2500 });
      }
    });

    document.addEventListener("keydown", (e) => {
      if (state.route !== "capture") return;
      const field = $("#capture-field");
      if (!field) return;

      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        saveCapture();
      } else if (e.key === "Escape") {
        field.value = "";
        field.focus();
      }
    });

    document.addEventListener("input", (e) => {
      if (e.target.id === "capture-field") {
        const status = $("#capture-status");
        if (status) status.textContent = "unsaved";
      }
    });
  }

  /* ---------------------------------------------------------------------------
     11. INIT
     --------------------------------------------------------------------------- */
  function init() {
    wire();
    router();
    loadToday();   // fetch live data; re-renders today when it lands
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

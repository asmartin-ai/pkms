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
     1. LIVE DATA — fetched from token-gated /api/* endpoints.
     Token rides in location.search (?token=...). /api/today remains the
     required core payload; reading queue + recognition cards are read-only
     auxiliary surfaces loaded from the same service.
     --------------------------------------------------------------------------- */
  let TODAY = null; // populated by loadToday()
  const MORE_ACTIONS = []; // populated when /api/next-actions ships
  let RECOGNITION_CARDS = [];
  let READING_QUEUE = [];
  const PEBBLES = { count: 0, goal: null, entries: [] };
  let RECENT_NOTES = []; // populated by loadRecentNotes() -> /api/recent-notes
  let INBOX_ITEMS = []; // populated by loadAuxiliarySurfaces -> /api/inbox-items

  let PKMS_BASE_URL = "";
  let PKMS_TOKEN = "";
  let CONFIG_PROMISE = null;

  /// MAX_NOTES_SHOWN mirrors today.py:15.
  const MAX_NOTES_SHOWN = 8;

  const extensionApi = () => {
    if (
      !location.protocol.startsWith("moz-extension") &&
      !location.protocol.startsWith("chrome-extension")
    ) {
      return null;
    }
    return globalThis.browser || globalThis.chrome || null;
  };

  function storageGet(keys) {
    const api = extensionApi();
    return new Promise((resolve, reject) => {
      if (!api?.storage?.local) {
        resolve({});
        return;
      }

      try {
        const maybePromise = api.storage.local.get(keys);
        if (maybePromise?.then) {
          maybePromise.then((value) => resolve(value || {}), reject);
          return;
        }
      } catch {
        // Fall through to the Chrome callback form below.
      }

      api.storage.local.get(keys, (value) => {
        const err = api.runtime?.lastError;
        if (err) reject(new Error(err.message));
        else resolve(value || {});
      });
    });
  }

  function configFromStoredUrl(pkmsUrl) {
    if (!pkmsUrl) return null;
    try {
      const parsed = new URL(pkmsUrl);
      return {
        baseUrl: parsed.origin,
        token: parsed.searchParams.get("token") || "",
      };
    } catch {
      return null;
    }
  }

  async function loadConfig() {
    if (!extensionApi()) return;

    const stored = await storageGet(["pkmsBaseUrl", "pkmsToken", "pkmsUrl"]);
    const legacy = configFromStoredUrl(stored.pkmsUrl);
    PKMS_BASE_URL = String(
      stored.pkmsBaseUrl || legacy?.baseUrl || "http://localhost:8765",
    ).replace(/\/$/, "");
    PKMS_TOKEN = String(stored.pkmsToken || legacy?.token || "").trim();
    if (!PKMS_TOKEN) {
      throw new Error(
        "token required — open the extension options and save your PKMS URL",
      );
    }
  }

  async function ensureConfig() {
    CONFIG_PROMISE ||= loadConfig();
    await CONFIG_PROMISE;
  }

  function apiUrl(path) {
    return PKMS_BASE_URL
      ? `${PKMS_BASE_URL}${path}`
      : `${path}${location.search}`;
  }

  async function apiFetch(path, init = {}) {
    await ensureConfig();
    const headers = new Headers(init.headers || {});
    if (PKMS_TOKEN) headers.set("X-Capture-Token", PKMS_TOKEN);
    return fetch(apiUrl(path), { ...init, headers });
  }

  async function fetchJson(path) {
    const r = await apiFetch(path, {
      headers: { Accept: "application/json" },
    });
    if (!r.ok) throw new Error(`${path} failed (${r.status})`);
    return await r.json();
  }

  /// Fetch /api/today and render. Served /web/ mode uses same-origin requests
  /// token-gated via ?token=...; packaged extension mode uses X-Capture-Token.
  async function loadToday() {
    try {
      TODAY = await fetchJson("/api/today");
      // pebbles derive from done_today until /api/pebbles ships
      PEBBLES.count = TODAY.done_today || 0;
      if (state.route === "today") renderToday();
      loadAuxiliarySurfaces();
    } catch (e) {
      showError(
        e.message.includes("403") || e.message.includes("token required")
          ? "token required — open the extension options or use ?token=..."
          : "couldn't reach the service — is pkms serve running?",
      );
    }
  }

  async function loadAuxiliarySurfaces() {
    try {
      const [reading, recognition, recent, inbox] = await Promise.all([
        fetchJson("/api/reading-queue"),
        fetchJson("/api/recognition-cards"),
        fetchJson("/api/recent-notes"),
        fetchJson("/api/inbox-items"),
      ]);
      READING_QUEUE = reading;
      RECOGNITION_CARDS = recognition;
      RECENT_NOTES = recent;
      INBOX_ITEMS = inbox;
      if (state.route === "today") renderToday();
      if (state.route === "reading") renderReading();
      if (state.route === "search") renderSearch();
    } catch (e) {
      console.warn(e);
    }
  }

  function showError(msg) {
    const el = document.getElementById("error-banner");
    if (el) {
      el.textContent = msg;
      el.hidden = false;
    }
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
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const fmtDate = (iso) => {
    try {
      const d = new Date(iso + "T00:00:00");
      return d.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  };

  const fmtShortDate = (iso) => {
    try {
      const d = new Date(iso + "T00:00:00");
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return iso;
    }
  };

  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );

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
        html: `Nothing is asking for you right now.`,
        lines: [],
      };
    }
    if (!bc || !bc.name) {
      // Gap day — no breadcrumb. Soften, never bill.
      return {
        html:
          `It's been a few days. Nothing's overdue — here's where ` +
          `<strong>${esc(action.title)}</strong> was when you last touched it.`,
        lines: [],
      };
    }
    return {
      html:
        `Yesterday you were in <strong>${esc(action.title)}</strong>, ` +
        `${esc(action.text)}.`,
      lines: bc.lines || [],
    };
  }

  /* ---------------------------------------------------------------------------
     4. RENDER — Today (the poster centerpiece)
     --------------------------------------------------------------------------- */
  function renderToday() {
    if (!TODAY) return; // loadToday() re-calls renderToday() once data lands
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
      // Strip a leading markdown bullet ("- ") so the CSS `—` ::before isn't
      // doubled into "— - text" when a daily-note breadcrumb section uses
      // "- " bullets. Keep the CSS marker; never add a JS-side bullet.
      const stripBullet = (l) => l.replace(/^-\s+/, "");
      subEl.innerHTML = `<ul>${lede.lines.map((l) => `<li>${esc(stripBullet(l))}</li>`).join("")}</ul>`;
      subEl.hidden = false;
    } else {
      subEl.hidden = true;
    }

    // ── Lead continuation — primary action opens context; completion stays secondary. ──
    renderLeadContinuation();

    // ── Context rail: fold in, read next, still curious, done today ──
    renderFold();
    renderInbox();
    renderNextRead();
    renderResurface();
    renderPebbles();

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

  /// The inbox surface — recent captures as recognition (NOT a pile). Density-gated
  /// (visible at more/everything, hidden in calm — the `.block--optional` wrapper
  /// in index.html handles the visibility; this function only renders the items
  /// when the surface exists and has data). The fold block above carries the
  /// progress copy ("N new to fold in"); this surface is the recognition expansion
  /// — each item one gentle action (open). No count badges, no urgency, no shame
  /// ("you haven't folded in N days" is forbidden). Empty inbox hides the surface.
  function renderInbox() {
    const surface = $("#inbox-surface");
    if (!surface) return;
    const ul = $("#inbox-items");
    if (!ul) return;
    // INBOX_ITEMS comes from /api/inbox-items (loadAuxiliarySurfaces). When the
    // fetch hasn't landed yet or the inbox is empty, hide the surface — the
    // empty state is a reward, never a hole.
    if (!INBOX_ITEMS || INBOX_ITEMS.length === 0) {
      surface.hidden = true;
      ul.innerHTML = "";
      return;
    }
    ul.innerHTML = INBOX_ITEMS.map(
      (it) => `
      <li class="inbox-surface__item" data-path="${esc(it.path)}">
        <span class="inbox-surface__preview">${esc(it.preview || "(empty capture)")}</span>
        <small class="inbox-surface__meta">${esc(it.source || "")}${it.captured ? ` · ${esc(_fmtTouched(it.captured))}` : ""}</small>
      </li>`,
    ).join("");
    surface.hidden = false;
  }

  function renderNextRead() {
    const el = $("#next-read");
    if (!el) return;
    const item = READING_QUEUE[0] || TODAY.next_read;
    if (!item) {
      el.className = "next-read next-read--empty";
      el.innerHTML = "nothing queued to read.";
      return;
    }

    el.className = "next-read";
    const cost = item.minutes
      ? `<span class="next-read__cost">⏱ ~${esc(item.minutes)} min</span>`
      : "";
    const title = item.path
      ? `<button class="next-read__title" type="button" data-path="${esc(item.path)}">${esc(item.title)}</button>`
      : `<span class="next-read__title">${esc(item.title)}</span>`;
    el.innerHTML = `${title}${cost}`;
  }

  function renderLeadContinuation() {
    const panel = $("#lead-continuation");
    const label = $("#lead-action-label");
    const title = $("#lead-action-title");
    const body = $("#lead-action-body");
    const meta = $("#lead-action-meta");
    const secondary = $("#lead-action-secondary");
    if (!panel || !label || !title || !body || !meta || !secondary) return;

    const lead = TODAY.next_actions[0];
    panel.hidden = false;

    if (lead && !state.doneNotes.has(lead.note)) {
      panel.dataset.mode = "continue";
      label.textContent = "continue";
      title.textContent = lead.title ? `Open ${lead.title}` : "Open the note";
      body.innerHTML = `<span class="lead-continuation__verb">▶</span>${esc(lead.first_action || lead.text)}`;
      meta.textContent = [lead.size ? `⏱ ${lead.size}` : "", lead.note || ""]
        .filter(Boolean)
        .join(" · ");
      secondary.hidden = false;
      return;
    }

    panel.dataset.mode = "capture";
    label.textContent = "nothing queued";
    title.textContent = "Capture a thought";
    body.innerHTML = `<span class="lead-continuation__verb">+</span>Nothing needs an action right now. Add the thing that just sparked.`;
    meta.textContent =
      TODAY.inbox_new > 0
        ? `${TODAY.inbox_new} safe to fold in later`
        : "the system owns later";
    secondary.hidden = true;
  }

  function renderRecognitionCards() {
    const el = $("#recognition-cards");
    if (!el || !RECOGNITION_CARDS.length) {
      if (el) el.innerHTML = "";
      return;
    }

    el.innerHTML = RECOGNITION_CARDS.map((c) => {
      const kindClass =
        c.kind === "reading" ? "card--reading" : "card--resurface";
      const kindLabel = c.kind === "reading" ? "reading" : "resurfacing";
      const cost =
        c.kind === "reading" && c.minutes
          ? `<span class="card__cost">⏱ ~${c.minutes} min</span>`
          : "";
      const title = c.path
        ? `<button class="card__title card__title-button" type="button" data-path="${esc(c.path)}">${esc(c.title)}</button>`
        : `<h3 class="card__title">${esc(c.title)}</h3>`;
      return `
        <article class="card ${kindClass}">
          <span class="card__kind">${kindLabel}</span>
          ${title}
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
    const items = TODAY.next_actions.filter(
      (a, i) => !(leadExcluded && i === 0),
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
    const dots = Array.from(
      { length: total },
      () => `<span class="pebble"></span>`,
    ).join("");
    const caption = PEBBLES.goal
      ? `<span class="pebbles__caption">${total}${PEBBLES.goal ? ` of ${PEBBLES.goal}` : ""} today</span>`
      : `<span class="pebbles__caption">${total} ${total === 1 ? "win" : "wins"} today</span>`;
    el.innerHTML = dots + caption;
  }

  function checkCleared() {
    const cleared = $("#cleared");
    const visibleActions = TODAY.next_actions.filter(
      (_, i) => i < MAX_NOTES_SHOWN,
    );
    const allDone =
      visibleActions.length > 0 &&
      visibleActions.every((a) => state.doneNotes.has(a.note));

    if (allDone) {
      cleared.classList.remove("is-hidden");
      const cp = $("#cleared-pebbles");
      const total = PEBBLES.count + state.doneNotes.size;
      cp.innerHTML = Array.from(
        { length: total },
        () => `<span class="pebble"></span>`,
      ).join("");
    } else {
      cleared.classList.add("is-hidden");
    }
  }

  /* ---------------------------------------------------------------------------
     5. RENDER — Reading queue
     --------------------------------------------------------------------------- */
  function renderReading() {
    const el = $("#reading-list");
    if (!READING_QUEUE.length) {
      el.innerHTML = `<li class="reading-item">nothing queued right now.</li>`;
      return;
    }
    el.innerHTML = READING_QUEUE.map((r) => {
      const cost = r.minutes
        ? `<span class="reading-item__cost">⏱ ~${r.minutes} min</span>`
        : `<span class="reading-item__cost" style="border:0;padding:0;color:var(--bone-faint);">long read</span>`;
      return `
        <li class="reading-item">
          <h3 class="reading-item__title"><a href="#" data-path="${esc(r.path)}">${esc(r.title)}</a></h3>
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
  // Render a relative "last touched" label from an ISO timestamp. Quiet, never
  // a count or urgency cue — "3d ago", "just now", "last week". Falls back to
  // the date when older than a week. Design language: no red, no streaks.
  function _fmtTouched(iso) {
    if (!iso) return "";
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) return "";
    const diffMs = Date.now() - t.getTime();
    const sec = Math.max(0, Math.round(diffMs / 1000));
    if (sec < 60) return "just now";
    const min = Math.round(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.round(hr / 24);
    if (day === 1) return "yesterday";
    if (day < 7) return `${day}d ago`;
    const wk = Math.round(day / 7);
    if (wk === 1) return "last week";
    if (wk < 5) return `${wk}w ago`;
    // Older — show the date plainly.
    return t.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function renderSearch() {
    const el = $("#search-candidates");
    // Candidates come from /api/recent-notes (loadAuxiliarySurfaces). When the
    // fetch failed or the vault is empty, render nothing — the empty state is a
    // reward, not a hole. Never a count, never "you have no notes."
    el.innerHTML = RECENT_NOTES.map(
      (n) => `
      <li data-path="${esc(n.path)}">
        ${esc(n.title)}
        <small>${esc(n.path)}${n.last_touched ? ` · ${esc(_fmtTouched(n.last_touched))}` : ""}</small>
      </li>`,
    ).join("");
  }

  // Debounced free-text search: typed -> /api/search?q= -> results list below the
  // candidates. Recognition stays primary; results are the fallback. No result
  // count is ever shown (the design language forbids piles/counts on the self).
  let _searchTimer = null;
  async function _runSearch(q) {
    const ul = $("#search-results");
    if (!ul) return;
    const trimmed = q.trim();
    if (!trimmed) {
      // Empty input — hide results, leave candidates visible.
      ul.hidden = true;
      ul.innerHTML = "";
      return;
    }
    try {
      const results = await fetchJson(
        `/api/search?q=${encodeURIComponent(trimmed)}`,
      );
      ul.innerHTML = (results || [])
        .map(
          (r) => `
          <li data-path="${esc(r.path)}">
            ${esc(r.title)}
            <small>${esc(r.path)}${r.excerpt ? ` · ${esc(r.excerpt)}` : ""}</small>
          </li>`,
        )
        .join("");
      ul.hidden = false;
    } catch (e) {
      console.warn(e);
      ul.hidden = true;
    }
  }

  /* ---------------------------------------------------------------------------
     8. ROUTER
     --------------------------------------------------------------------------- */
  function router() {
    const hash = (location.hash || "#today").replace(/^#/, "");
    const route = ["today", "capture", "reading", "actions", "search"].includes(
      hash,
    )
      ? hash
      : "today";
    state.route = route;

    $$("[data-surface]").forEach((s) => {
      s.hidden = s.dataset.surface !== route;
    });

    $$(".nav a").forEach((a) => {
      a.removeAttribute("aria-current");
      if (a.dataset.route === route) a.setAttribute("aria-current", "page");
    });

    if (route === "today") renderToday();
    if (route === "reading") renderReading();
    if (route === "actions") renderActionsFull();
    if (route === "search") renderSearch();
    if (route === "capture") {
      const f = $("#capture-field");
      if (f) f.focus();
    }

    window.scrollTo({
      top: 0,
      behavior: "instant" in window ? "instant" : "auto",
    });
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
      showToast(`✓ ${label} — counted for today`, {
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
    if (state.route === "today") renderToday();
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
      const r = await apiFetch("/capture", {
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

  async function openNote(path) {
    try {
      const r = await apiFetch("/api/open-note", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ path }),
      });
      if (!r.ok) throw new Error(`open failed (${r.status})`);
      showToast(`opened ${path}`, { duration: 2500 });
    } catch (e) {
      showToast(`couldn't open ${path} — service unreachable`, {
        duration: 3500,
      });
    }
  }

  /// Resurface: not-now (silent, no-renag) or let-it-go (forever-exit).
  async function dismissResurface(kind) {
    const card = TODAY && TODAY.resurface;
    if (!card || !card.path) return;

    try {
      const r = await apiFetch("/api/resurface", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ path: card.path, action: kind }),
      });
      if (!r.ok) throw new Error(`resurface failed (${r.status})`);
    } catch (e) {
      showToast("not changed yet — service unreachable", { duration: 3500 });
      return;
    }

    state.resurfaceDismissed = true;
    TODAY.resurface = null;
    renderResurface();

    if (kind === "let-go") {
      showToast("let go — asking stops", { duration: 3500 });
    } else {
      showToast("rested — it won't come up for a while", { duration: 3500 });
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

    const navSearch = $(".nav-search");
    if (navSearch) {
      navSearch.addEventListener("submit", (e) => {
        e.preventDefault();
        const navInput = navSearch.querySelector(".nav-search__input");
        const searchInput = $("#search-input");
        if (navInput && searchInput) searchInput.value = navInput.value;
        location.hash = "#search";
        // Trigger an immediate search on submit so the nav-submit -> #search
        // handoff shows results for the just-typed term, not a stale input.
        if (navInput && searchInput) _runSearch(searchInput.value);
      });
    }

    // Free-text search input: debounced -> /api/search?q= -> #search-results.
    // Recognition-first: candidates stay visible above; results render below.
    const searchInput = $("#search-input");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        if (_searchTimer) clearTimeout(_searchTimer);
        _searchTimer = setTimeout(() => _runSearch(searchInput.value), 250);
      });
    }

    $("#lead-action").addEventListener("click", () => {
      const lead = TODAY.next_actions[0];
      if (lead && !state.doneNotes.has(lead.note)) {
        openNote(lead.note);
      } else {
        location.hash = "#capture";
      }
    });

    document.addEventListener("click", (e) => {
      const t = e.target.closest(
        "[data-done-toggle], [data-resurface], [data-more-toggle], [data-go], [data-path]",
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
        e.preventDefault();
        openNote(t.dataset.path);
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
    loadToday(); // fetch live data; re-renders today when it lands
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

(() => {
  "use strict";

  let TOKEN = new URLSearchParams(location.search).get("token") || "";

  const tokenReady = window.pkmsToken
    .resolve(location.search, "caches" in window ? caches : null)
    .then((resolved) => {
      if (!TOKEN) TOKEN = resolved;

      if (TOKEN && "caches" in window) {
        caches
          .open(window.pkmsToken.AUTH_CACHE)
          .then((c) => c.put(window.pkmsToken.TOKEN_PATH, new Response(TOKEN)))
          .catch(() => {});
      }
    });

  document.body.addEventListener("htmx:configRequest", (e) => {
    if (TOKEN) e.detail.headers["X-Capture-Token"] = TOKEN;
  });

  document.body.addEventListener("htmx:confirm", (e) => {
    if (TOKEN || !e.detail.issueRequest) return;
    e.preventDefault();

    void tokenReady.then(() => e.detail.issueRequest(false)).catch(() => {});
  });

  if (new URLSearchParams(location.search).get("saved") === "share") {
    queueMicrotask(() =>
      document.body.dispatchEvent(new CustomEvent("pkms:toast", { detail: { msg: "Saved ✓" } })),
    );
  }

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  let toastTimer = null;

  function showToast(msg, opts = {}) {
    const toast = $("#toast");

    if (!toast) return;
    const msgEl = $("#toast-msg");
    const actionBtn = $("#toast-action");

    if (msgEl) msgEl.textContent = msg;

    if (opts.action && opts.onAction) {
      if (actionBtn) {
        actionBtn.textContent = opts.action;
        actionBtn.hidden = false;
        actionBtn.onclick = () => {
          opts.onAction();
          hideToast();
        };
      }
    } else if (actionBtn) {
      actionBtn.hidden = true;
    }

    toast.classList.add("toast--visible");
    clearTimeout(toastTimer);

    if (opts.duration !== 0) toastTimer = setTimeout(hideToast, opts.duration || 3500);
  }

  function hideToast() {
    const t = $("#toast");

    if (t) t.classList.remove("toast--visible");
  }

  document.body.addEventListener("pkms:toast", (e) => {
    const d = e.detail;
    showToast(d?.msg ?? d, d?.opts || {});
  });

  document.addEventListener("pkms:refresh", () => {
    for (const sel of ["#today-root", "#reading-list", "#actions-full", "#search-candidates"]) {
      const el = document.querySelector(sel);

      if (el && window.htmx) htmx.trigger(el, "refresh");
    }
  });

  const ROUTES = ["today", "capture", "reading", "actions", "search"];

  function router() {
    const hash = (location.hash || "#today").replace(/^#/, "");
    const route = ROUTES.includes(hash) ? hash : "today";
    $$("[data-surface]").forEach((s) => {
      s.hidden = s.dataset.surface !== route;
    });
    $$(".nav a").forEach((a) => {
      a.removeAttribute("aria-current");

      if (a.dataset.route === route) a.setAttribute("aria-current", "page");
    });

    if (route === "capture") {
      const f = $("#capture-field");

      if (f) f.focus();
    }

    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  window.addEventListener("hashchange", router);

  function setDensity(level) {
    document.body.className = `density-${level}`;
    $$("[data-density]").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.density === level)),
    );
  }

  const doneNotes = new Set();

  function cssNote(note) {
    try {
      return CSS.escape(note);
    } catch {
      return note;
    }
  }

  function visibleActionNotes() {
    const notes = $$("#today-root .action[data-note]").map((r) => r.dataset.note);
    const lead = $("#lead-continuation");

    if (lead && lead.dataset.note) notes.unshift(lead.dataset.note);

    return notes;
  }

  function pebbleTotal() {
    const el = $("#pebbles");

    return Number(el ? el.dataset.count : 0) + doneNotes.size;
  }

  function refreshPebbles() {
    const el = $("#pebbles");

    if (!el) return;
    const total = pebbleTotal();

    if (total === 0) {
      el.className = "pebbles pebbles--empty";
      el.innerHTML = "nothing finished yet — that's fine.";

      return;
    }

    el.className = "pebbles";
    const dots = Array.from({ length: total }, () => '<span class="pebble"></span>').join("");
    const label = total === 1 ? "win" : "wins";
    el.innerHTML = dots + `<span class="pebbles__caption">${total} ${label} today</span>`;
  }

  function checkCleared() {
    const cleared = $("#cleared");

    if (!cleared) return;
    const notes = visibleActionNotes();
    const allDone = notes.length > 0 && notes.every((n) => doneNotes.has(n));

    if (allDone) {
      cleared.classList.remove("is-hidden");
      const cp = $("#cleared-pebbles");
      const total = pebbleTotal();

      if (cp)
        cp.innerHTML = Array.from({ length: total }, () => '<span class="pebble"></span>').join("");
    } else {
      cleared.classList.add("is-hidden");
    }
  }

  function applyDoneState() {
    for (const note of doneNotes) {
      const row = $(`.action[data-note="${cssNote(note)}"]`);

      if (row) row.classList.add("action--done");
    }

    $$(".action[data-note]").forEach((r) => {
      const note = r.dataset.note;
      const done = doneNotes.has(note);
      r.classList.toggle("action--done", done);
      const btn = r.querySelector("[data-done-toggle]");

      if (btn) btn.innerHTML = `<span class="glyph">✓</span> ${done ? "done" : "mark done"}`;
    });
    const lead = $("#lead-continuation");
    const capture = $("#lead-capture");

    if (lead && lead.dataset.note && capture) {
      const done = doneNotes.has(lead.dataset.note);
      lead.hidden = done;
      capture.hidden = !done;
    }

    refreshPebbles();
    checkCleared();
  }

  function toggleDone(note) {
    if (doneNotes.has(note)) {
      doneNotes.delete(note);
    } else {
      doneNotes.add(note);
      const row = $(`.action[data-note="${cssNote(note)}"]`);
      const label = row ? (row.querySelector(".action__title")?.textContent || "").trim() : "done";
      showToast(`✓ ${label} — counted for today`, {
        action: "undo",
        onAction: () => {
          doneNotes.delete(note);
          applyDoneState();
        },
        duration: 3500,
      });
    }

    applyDoneState();
  }

  function captureField() {
    return $("#capture-field");
  }

  document.body.addEventListener("htmx:beforeRequest", (e) => {
    if (e.detail.elt === captureField()) {
      const s = $("#capture-status");

      if (s) s.textContent = "saving…";
    }
  });
  document.body.addEventListener("htmx:afterResponse", (e) => {
    const f = captureField();

    if (e.detail.elt !== f) return;

    if (e.detail.successful) {
      f.value = "";
      f.focus();
      showToast('✓ captured — the system owns "later"', { duration: 2500 });
      setTimeout(() => {
        const s = $("#capture-status");

        if (s) s.textContent = "unsaved";
      }, 1500);
    } else {
      f.focus();
      const s = $("#capture-status");

      if (s) s.textContent = "not saved yet";
      showToast("not saved yet — service unreachable", { duration: 3500 });
    }
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "capture-field") {
      const s = $("#capture-status");

      if (s) s.textContent = "unsaved";
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && e.target === captureField()) {
      e.target.value = "";
      e.target.focus();
    }
  });

  function banner() {
    return $("#error-banner");
  }

  document.body.addEventListener("htmx:responseError", (e) => {
    const elt = e.detail.elt;
    const onToday = elt && (elt.id === "today-root" || elt.closest("#today-root"));

    if (!onToday) return;
    const b = banner();

    if (!b) return;
    const status = e.detail.xhr && e.detail.xhr.status;
    b.textContent =
      status === 403
        ? "token required — open the extension options or use ?token=..."
        : "couldn't reach the service — is pkms serve running?";
    b.hidden = false;
  });
  document.body.addEventListener("htmx:afterResponse", (e) => {
    if (e.detail.elt && e.detail.elt.id === "today-root" && e.detail.successful) {
      const b = banner();

      if (b) b.hidden = true;
    }
  });

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-done-toggle], [data-go]");

    if (!t) return;

    if (t.dataset.doneToggle) {
      toggleDone(t.dataset.doneToggle);
    } else if (t.dataset.go) {
      location.hash = `#${t.dataset.go}`;
    }
  });

  const navSearch = $(".nav-search");

  if (navSearch) {
    navSearch.addEventListener("submit", (e) => {
      e.preventDefault();
      const navInput = navSearch.querySelector(".nav-search__input");
      const searchInput = $("#search-input");

      if (navInput && searchInput) searchInput.value = navInput.value;
      location.hash = "#search";

      if (searchInput && window.htmx) htmx.trigger(searchInput, "pkms:search-now");
    });
  }

  setDensity("calm");
  router();
})();

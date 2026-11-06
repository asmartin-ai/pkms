(function () {
  const panel = document.getElementById("rag-panel");
  const form = document.getElementById("rag-form");
  const status = document.getElementById("rag-status");
  const message = document.getElementById("rag-message");
  const answer = document.getElementById("rag-answer");
  const evidence = document.getElementById("rag-evidence");
  const consent = document.getElementById("rag-consent");
  const offline = document.getElementById("rag-offline");
  const indexButton = document.getElementById("rag-index");
  const sourceDialog = document.getElementById("rag-source");
  let busy = false;

  async function request(path, payload) {
    const token = await window.pkmsToken.resolve(location.search, window.caches);

    const init = {
      method: payload === undefined ? "GET" : "POST",
      headers: { "X-Capture-Token": token, "Content-Type": "application/json" },
      cache: "no-store",
    };

    if (payload !== undefined) init.body = JSON.stringify(payload);

    const response = await fetch(path, init);

    const result = await response.json();

    if (!response.ok) throw new Error(result.error || "Request failed");

    return result;
  }

  async function refresh() {
    try {
      const result = await request("/api/rag/status");
      status.textContent =
        (result.running ? "Indexing in progress. " : "") +
        result.current +
        " current notes, " +
        result.pending +
        " pending, " +
        result.obsolete +
        " obsolete, " +
        result.chunks +
        " stored chunks. " +
        (result.updatedAt
          ? "Last completed: " + result.updatedAt + ". "
          : "No completed indexing run. ") +
        (result.providerConfigured
          ? "Answer provider configured. "
          : "Ask unavailable: configure rag-llm-base-url/api-key/model. ") +
        result.scope +
        (result.error ? " Last indexing error: " + result.error : "");
      indexButton.disabled = busy || result.running;
    } catch (error) {
      status.textContent = error.message;
    }
  }

  function setBusy(value) {
    busy = value;
    panel.setAttribute("aria-busy", String(value));
    form.querySelectorAll("button").forEach((button) => {
      button.disabled = value;
    });
    indexButton.disabled = value;
  }

  async function openSource(row) {
    sourceDialog.showModal();
    document.getElementById("rag-source-title").textContent =
      row.ref + ":" + row.startLine + "–" + row.endLine;
    const text = document.getElementById("rag-source-text");
    text.textContent = "Loading original Markdown lines…";

    try {
      const params = new URLSearchParams({
        ref: row.ref,
        start: row.startLine,
        end: row.endLine,
        text: row.text,
      });

      const result = await request("/api/rag/source?" + params);
      text.textContent = result.text;
    } catch (error) {
      text.textContent = error.message;
    }
  }

  function citationButton(row) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "[" + row.id + "] " + row.ref + ":" + row.startLine + "–" + row.endLine;
    button.addEventListener("click", () => openSource(row));

    return button;
  }

  function render(result) {
    answer.replaceChildren();
    evidence.replaceChildren();

    if (result.answer) {
      const byId = new Map(result.evidence.map((row) => [row.id, row]));

      for (const part of result.answer.split(/(\[E\d+\])/g)) {
        const row = byId.get(part.slice(1, -1));
        answer.append(row ? citationButton(row) : document.createTextNode(part));
      }
    }

    for (const row of result.evidence) {
      const li = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = row.title;
      const passage = document.createElement("p");
      passage.textContent = row.text;
      li.append(title, document.createTextNode(" "), citationButton(row), passage);
      evidence.append(li);
    }

    message.textContent =
      result.mode +
      " retrieval · " +
      result.evidence.length +
      " passages. " +
      (result.warning || "") +
      (result.evidence.length
        ? ""
        : " No matching current evidence; try another query or update the index.");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (busy) return;
    const mode = event.submitter && event.submitter.value === "ask" ? "ask" : "search";
    const allowRemote = consent.checked;
    consent.checked = false;

    if (mode === "ask" && (!allowRemote || offline.checked)) {
      message.textContent =
        "Ask needs explicit consent for this question and is unavailable offline. Evidence search remains local.";

      return;
    }

    setBusy(true);
    answer.replaceChildren();
    evidence.replaceChildren();
    message.textContent =
      mode === "ask"
        ? "Retrieving evidence and asking the configured provider…"
        : "Searching current evidence locally…";

    try {
      render(
        await request("/api/rag/" + mode, {
          query: document.getElementById("rag-question").value,
          semantic: document.getElementById("rag-semantic").checked,
          offline: offline.checked,
          allowRemote: mode === "ask" && allowRemote,
        }),
      );
    } catch (error) {
      message.textContent = error.message;
    } finally {
      setBusy(false);
    }
  });

  indexButton.addEventListener("click", async () => {
    if (busy) return;
    setBusy(true);
    message.textContent = offline.checked
      ? "Indexing with cached local model…"
      : "Updating semantic index; the first run may download the pinned local model…";

    try {
      const result = await request("/api/rag/index", { offline: offline.checked });
      message.textContent =
        "Indexed " +
        result.indexed +
        ", unchanged " +
        result.skipped +
        ", deleted " +
        result.deleted +
        ", changed during indexing " +
        result.stale +
        ".";
    } catch (error) {
      message.textContent = error.message;
    } finally {
      setBusy(false);
      await refresh();
    }
  });
  panel.addEventListener("toggle", () => {
    if (panel.open) refresh();
  });
  document.getElementById("rag-refresh").addEventListener("click", refresh);
  document.getElementById("rag-source-close").addEventListener("click", () => sourceDialog.close());
})();

const api = globalThis.browser || globalThis.chrome;
const form = document.getElementById("settings-form");
const input = document.getElementById("pkms-url");
const statusEl = document.getElementById("status");

function storageGet(key) {
  return new Promise((resolve, reject) => {
    if (!api?.storage?.local) {
      reject(new Error("extension storage is unavailable"));
      return;
    }

    try {
      const maybePromise = api.storage.local.get(key);
      if (maybePromise?.then) {
        maybePromise.then((value) => resolve(value || {}), reject);
        return;
      }
    } catch {
      // Fall through to the Chrome callback form below.
    }

    api.storage.local.get(key, (value) => {
      const err = api.runtime?.lastError;
      if (err) reject(new Error(err.message));
      else resolve(value || {});
    });
  });
}

function storageSet(value) {
  return new Promise((resolve, reject) => {
    if (!api?.storage?.local) {
      reject(new Error("extension storage is unavailable"));
      return;
    }

    try {
      const maybePromise = api.storage.local.set(value);
      if (maybePromise?.then) {
        maybePromise.then(resolve, reject);
        return;
      }
    } catch {
      // Fall through to the Chrome callback form below.
    }

    api.storage.local.set(value, () => {
      const err = api.runtime?.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

function setStatus(message) {
  statusEl.textContent = message;
}

(async () => {
  try {
    const { pkmsUrl, pkmsBaseUrl, pkmsToken } = await storageGet([
      "pkmsUrl",
      "pkmsBaseUrl",
      "pkmsToken",
    ]);
    input.value =
      pkmsUrl ||
      `${pkmsBaseUrl || "http://localhost:8765"}/web/?token=${pkmsToken || ""}`;
  } catch (e) {
    setStatus(`Could not load current setting: ${e.message}`);
  }
})();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const pkmsUrl = input.value.trim();

  try {
    const parsed = new URL(pkmsUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("URL must start with http:// or https://");
    }
    const pkmsToken = parsed.searchParams.get("token");
    if (!pkmsToken) {
      throw new Error("URL must include ?token=...");
    }
    const pkmsBaseUrl = parsed.origin;

    await storageSet({ pkmsUrl, pkmsBaseUrl, pkmsToken });
    setStatus("Saved. Open a new tab to use PKMS.");
  } catch (e) {
    setStatus(`Not saved: ${e.message}`);
  }
});

// Redirector (G-N2): open the configured pkms serve URL as the new tab.
// The URL (with ?token=...) is stored in extension storage; set it from the
// extension's options page or by running the snippet in the README.
const DEFAULT_URL = "http://localhost:8765/web/";

(async () => {
  const api = (typeof browser !== "undefined") ? browser : chrome;
  try {
    const { pkmsUrl } = await api.storage.local.get("pkmsUrl");
    const target = pkmsUrl || DEFAULT_URL;
    location.replace(target);
  } catch (e) {
    document.getElementById("hint").innerHTML =
      "set your pkms URL in the extension options, then open a new tab.";
  }
})();

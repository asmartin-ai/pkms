(function () {
  const AUTH_CACHE = "pkms-auth";
  const TOKEN_PATH = "/__token";

  async function storedToken(cachesApi) {
    if (!cachesApi) return "";

    try {
      const cache = await cachesApi.open(AUTH_CACHE);
      const hit = await cache.match(TOKEN_PATH);

      if (!hit) return "";

      return (await hit.text()).trim();
    } catch {
      return "";
    }
  }

  async function resolve(search, cachesApi) {
    const fromUrl = new URLSearchParams(search).get("token");

    if (fromUrl) return fromUrl;

    return storedToken(cachesApi);
  }

  window.pkmsToken = {
    AUTH_CACHE: AUTH_CACHE,
    TOKEN_PATH: TOKEN_PATH,
    resolve: resolve,
    storedToken: storedToken,
  };
})();

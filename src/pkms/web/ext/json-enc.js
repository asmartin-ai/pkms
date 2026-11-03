/* htmx-ext-json-enc 2.0.2
 * Upstream: bigskysoftware/htmx-extensions, src/json-enc/json-enc.js
 * Source blob: 39918928b03ff89f926f9be49915d2b44e99c5d0
 * BSD Zero Clause License; Copyright (c) 2023, Alexander Petros.
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted.
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */
(function () {
  let api;
  htmx.defineExtension("json-enc", {
    init: function (apiRef) {
      api = apiRef;
    },
    onEvent: function (name, evt) {
      if (name === "htmx:configRequest") {
        evt.detail.headers["Content-Type"] = "application/json";
      }
    },
    encodeParameters: function (xhr, parameters, elt) {
      xhr.overrideMimeType("text/json");
      const object = {};
      parameters.forEach(function (value, key) {
        if (Object.hasOwn(object, key)) {
          if (!Array.isArray(object[key])) object[key] = [object[key]];
          object[key].push(value);
        } else {
          object[key] = value;
        }
      });
      const vals = api.getExpressionVars(elt);
      Object.keys(object).forEach(function (key) {
        // Restore hx-vals/hx-vars types after FormData's string encoding.
        object[key] = Object.hasOwn(vals, key) ? vals[key] : object[key];
      });

      return JSON.stringify(object);
    },
  });
})();

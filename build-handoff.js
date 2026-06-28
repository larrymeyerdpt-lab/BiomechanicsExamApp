/* BUILD Athlete Suite — handoff reader (interim bridge).
 *
 * Reads the launch hand-off from the URL fragment that the Client Profile builds
 * (#client=<janeId>&profile=<base64 record>), decodes the client record, and
 * pre-fills the host app's fields per a small selector→value mapping.
 *
 * Forward-compatible with the shared cloud store: today the record travels in the
 * fragment; when Firebase is live, only readRecord() changes (fetch by client id).
 * Every app's mapping stays exactly the same. The fragment (not the query string)
 * is used so the JaneApp ID never lands in a server log.
 *
 * Works with plain inputs AND React-controlled inputs (uses the native value setter
 * plus a dispatched input event so React state updates).
 */
(function (global) {
  "use strict";

  function parseFragment() {
    var h = (location.hash || "").replace(/^#/, "");
    var out = {};
    h.split("&").forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf("=");
      var k = i < 0 ? kv : kv.slice(0, i);
      var v = i < 0 ? "" : kv.slice(i + 1);
      try { out[decodeURIComponent(k)] = decodeURIComponent(v); } catch (e) { out[k] = v; }
    });
    return out;
  }

  function decodeProfile(b64) {
    try { return JSON.parse(decodeURIComponent(escape(atob(b64)))); }
    catch (e) { return null; }
  }

  // INTERIM: the record is embedded in the fragment.
  // LATER (Firebase): if only `client` is present, fetch the record from the store
  // by id and return it (the rest of this file is unchanged).
  function readRecord() {
    var p = parseFragment();
    if (p.profile) return decodeProfile(p.profile);
    // TODO(cloud): if (p.client) return store.get(p.client);
    return null;
  }

  function setValue(el, value) {
    if (!el) return;
    var proto = el.tagName === "TEXTAREA"
      ? global.HTMLTextAreaElement.prototype
      : global.HTMLInputElement.prototype;
    var setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, value == null ? "" : String(value));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function fill(mapping, record, root) {
    root = root || document;
    var filled = 0;
    Object.keys(mapping).forEach(function (sel) {
      var el = root.querySelector(sel);
      if (!el) return;
      var val;
      try { val = mapping[sel](record); } catch (e) { return; }
      if (val == null) return;
      setValue(el, val);
      filled++;
    });
    return filled;
  }

  /* apply({ mapping, maxTries, intervalMs, onDone })
   * Reads the record, then waits for the first mapped field to mount (React renders
   * asynchronously) and fills once. No-op when there's no hand-off in the URL. */
  function apply(opts) {
    var record = readRecord();
    if (!record) return null;
    var mapping = opts.mapping || {};
    var anchor = Object.keys(mapping)[0];
    var tries = 0;
    var max = opts.maxTries || 40;
    var gap = opts.intervalMs || 150;
    (function attempt() {
      if (anchor && document.querySelector(anchor)) {
        var n = fill(mapping, record, document);
        if (opts.onDone) opts.onDone(record, n);
        return;
      }
      if (++tries < max) setTimeout(attempt, gap);
    })();
    return record;
  }

  global.BUILDHandoff = { readRecord: readRecord, apply: apply, setValue: setValue, parseFragment: parseFragment };
})(window);

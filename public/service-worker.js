/*
 * service-worker.js
 *
 * Network-first everywhere (except Supabase calls, which are never
 * intercepted — those need live data every time). Cache is only a
 * fallback for when the network is unavailable.
 *
 * Earlier draft used cache-first for /editor/* for faster repeat loads,
 * but that meant an updated file (e.g. a corrected API key) could keep
 * getting served stale indefinitely unless the cache name was bumped on
 * every single change — a sharp edge, especially mid-development. Given
 * this app isn't performance-constrained enough to need that speedup,
 * simplicity and "always fresh when online" wins.
 */
const CACHE_NAME = "ran-pdf-cache-v2";
const PRECACHE = [
  "/editor/pdf-editor.html",
  "/editor/editor-bridge.js",
  "/editor/pdf-to-docx.js",
  "/editor/vendor/pdf.min.mjs",
  "/editor/vendor/pdf.worker.min.mjs",
  "/editor/vendor/docx.iife.js",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
  );
  self.clients.claim();
});

function isSupabaseRequest(url) {
  return url.hostname.endsWith(".supabase.co");
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only ever handle plain http(s) GETs on our own origin. Browser
  // extensions (Grammarly, etc.) running on the page can trigger fetch
  // events with schemes like chrome-extension:// that the Cache API
  // can't store — respondWith() would also hijack requests that were
  // never meant for us.
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    isSupabaseRequest(url)
  ) {
    return;
  }

  // Network-first, cache as a fallback for offline use — never serves a
  // stale cached file while online, which is what matters most here.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

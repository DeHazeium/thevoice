const CACHE = "voice40-v3";
const APP_SHELL = ["./", "./index.html", "./styles.css", "./app.js", "./firebase-config.js", "./manifest.webmanifest"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL))));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(fetch(event.request).then((response) => {
    const clone = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, clone)); return response;
  }).catch(() => caches.match(event.request)));
});

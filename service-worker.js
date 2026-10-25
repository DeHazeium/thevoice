const CACHE = "voice40-v8";
const APP_SHELL = ["./", "./index.html", "./styles.css?v=6", "./editorial.css?v=8", "./app.js?v=8", "./firebase-config.js", "./manifest.webmanifest", "./assets/ukeb-logo.png?v=1", "./assets/the-voice-4-logo.png?v=1"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL))));
self.addEventListener("activate", (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== location.origin) return;
  event.respondWith(fetch(event.request).then((response) => {
    const clone = response.clone(); caches.open(CACHE).then((cache) => cache.put(event.request, clone)); return response;
  }).catch(() => caches.match(event.request)));
});

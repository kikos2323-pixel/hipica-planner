const CACHE = "finca-planner-v2";
const BASE = "/hipica-planner";
const ASSETS = [
  BASE + "/",
  BASE + "/index.html",
  BASE + "/css/styles.css",
  BASE + "/js/app.js",
  BASE + "/js/firebase.js",
  BASE + "/manifest.json"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // Solo cachear GET, ignorar Firebase y extensiones Chrome
  if (e.request.method !== "GET") return;
  if (e.request.url.includes("firestore") || e.request.url.includes("googleapis")) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

const CACHE = "finca-planner-v8";
const BASE = "/hipica-planner";
const ASSETS = [
  BASE + "/",
  BASE + "/index.html",
  BASE + "/css/styles.css",
  BASE + "/js/app.js",
  BASE + "/js/firebase.js",
  BASE + "/games/game-characters.js",
  BASE + "/games/flappy-horse-preview.html",
  BASE + "/games/pixel-runner.html",
  BASE + "/manifest.json",
  BASE + "/icons/ui/timer.svg",
  BASE + "/icons/ui/calendar-days.svg",
  BASE + "/icons/ui/calendar-range.svg",
  BASE + "/icons/ui/list-checks.svg",
  BASE + "/icons/ui/gauge.svg",
  BASE + "/icons/ui/sun.svg",
  BASE + "/icons/ui/arrow-right.svg",
  BASE + "/icons/ui/bar-chart.svg",
  BASE + "/icons/ui/pencil.svg",
  BASE + "/icons/ui/clipboard-list.svg",
  BASE + "/icons/ui/calendar-clock.svg",
  BASE + "/icons/ui/map-pin.svg",
  BASE + "/icons/ui/stable.svg",
  BASE + "/icons/ui/horse.svg",
  BASE + "/icons/ui/droplet.svg",
  BASE + "/icons/ui/wheat.svg",
  BASE + "/icons/ui/wrench.svg",
  BASE + "/icons/ui/scissors.svg",
  BASE + "/icons/ui/sparkle.svg",
  BASE + "/icons/ui/sticky-note.svg",
  BASE + "/icons/ui/trending-up.svg",
  BASE + "/icons/ui/pie-chart.svg",
  BASE + "/icons/ui/calendar-check.svg",
  BASE + "/icons/ui/trophy.svg",
  BASE + "/icons/ui/history.svg",
  BASE + "/icons/ui/trash.svg",
  BASE + "/icons/ui/share.svg",
  BASE + "/icons/ui/check.svg",
  BASE + "/icons/ui/eye.svg",
  BASE + "/icons/ui/save.svg",
  BASE + "/icons/ui/eraser.svg",
  BASE + "/icons/ui/plus.svg",
  BASE + "/icons/ui/download.svg",
  BASE + "/icons/ui/upload.svg",
  BASE + "/icons/ui/camera.svg",
  BASE + "/icons/ui/bell.svg",
  BASE + "/icons/ui/search.svg",
  BASE + "/icons/ui/mic.svg",
  BASE + "/icons/ui/moon.svg"
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

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});


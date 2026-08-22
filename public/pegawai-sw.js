// Service worker KHUSUS untuk PWA "Absen Mandiri" (scope: /pegawai/).
// Sengaja MINIMAL — cuma menyimpan ikon & manifest di cache supaya Chrome/
// Android menganggap halaman ini "installable". Semua request halaman
// (HTML/data pegawai/absensi) SELALU diteruskan ke jaringan (bukan cache),
// karena data absensi harus selalu real-time, bukan data lama yang tersimpan
// di HP. Ini BUKAN service worker offline-first.

const CACHE_NAME = "absen-koempoel-shell-v1";
const SHELL_ASSETS = [
  "/icons/absen-192.png",
  "/icons/absen-512.png",
  "/icons/absen-apple-touch.png",
  "/manifest-absen.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isShellAsset = SHELL_ASSETS.some((path) => url.pathname === path);

  if (isShellAsset) {
    // Ikon/manifest: cache-first (jarang berubah).
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
    return;
  }

  // Semua request lain (halaman, data, foto absensi, dsb) SELALU network —
  // tidak ada fallback offline yang menampilkan data absensi basi.
});

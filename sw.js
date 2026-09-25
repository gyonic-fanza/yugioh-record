// App shell only: IndexedDB holds records; authentication and remote data are never cached.
const CACHE = 'ocg-record-shell-v21';
const SHELL = [
 './', './index.html', './manifest.webmanifest', './css/style.css', './css/luxe.css',
 './js/main.js', './js/storage.js', './js/services.js', './js/cloud.js',
 './js/analysisService.js', './js/analysisView.js', './js/pdfImport.js',
 './js/defaultPeriods.js', './js/deckSearch.js', './js/deckSelection.js', './js/searchText.js',
 './js/recordDefaults.js', './js/opponentSuggestions.js', './js/eventLinks.js',
 './js/cardTypes.js', './js/recipeHistory.js', './js/icons.js', './js/help.js', './js/battleSort.js', './js/csvImport.js', './js/calculatorImport.js', './js/community.js', './js/communityView.js',
 './assets/home.svg', './assets/record.svg', './assets/events.svg',
 './assets/decks.svg', './assets/analysis.svg', './assets/settings.svg',
 './assets/filigree.svg', './assets/favicon.svg', './assets/icon-180.png', './assets/icon-192.png',
 './assets/icon-512.png'
];
self.addEventListener('install', event => {
 event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
 event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('ocg-record-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
 const request = event.request, url = new URL(request.url);
 if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
 event.respondWith(fetch(request).then(response => {
  if (response.ok && response.type === 'basic') {
   const copy = response.clone();
   event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)));
  }
  return response;
 }).catch(async () => {
  const cached = await caches.match(request);
  if (cached) return cached;
  if (request.mode === 'navigate') return caches.match('./index.html');
  return Response.error();
 }));
});

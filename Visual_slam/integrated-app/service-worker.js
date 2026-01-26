const CACHE_NAME = 'indoor-nav-v1';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './js/vision.js',
    './js/odometry.js',
    './js/navigation.js',
    './js/accessibility.js',
    './js/app.js',
    'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js',
    'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@latest/dist/coco-ssd.min.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => {
            // Return cached response if found
            if (response) return response;

            // Otherwise fetch from network
            return fetch(e.request).then((networkResponse) => {
                // Cache new requests (dynamic caching for model files)
                // We only cache valid responses
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    // Note: CORS requests (like CDN) have type 'cors', so we should allow them too if needed.
                    // For simplicity, we just return the network response for external resources unless we explicitly cache them.
                    // But for model files, we want to cache them.
                    return networkResponse;
                }

                // Clone response because it can only be consumed once
                const responseToCache = networkResponse.clone();

                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(e.request, responseToCache);
                });

                return networkResponse;
            });
        })
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.map((key) => {
                if (key !== CACHE_NAME) return caches.delete(key);
            })
        ))
    );
});

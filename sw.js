// https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers

const addResourcesToCache = async (resources) => {
    const cache = await caches.open("v1");
    await cache.addAll(resources);
};

self.addEventListener("install", (event) => {
    event.waitUntil(
        addResourcesToCache([
            "./",
            "./index.html",
            "./bootstrap/css/bootstrap.min.css",
            "./bootstrap/js/bootstrap.bundle.min.js",
            "./jquery/jquery-3.7.0.min.js",
            "./jszip/jszip.min.js",
            "./three.module.min.js",
            "./addons/controls/OrbitControls.js",
            "./app.js",
            "./project.js",
            "./profiler.js",
            "./deviceposition.js",
            "./terrain.js",
            "./terrain_chunk.js",
        ]),
    );
});


const cacheFirst = async (request) => {
    const responseFromCache = await caches.match(request);
    if (responseFromCache) {
        return responseFromCache;
    }
    return fetch(request);
};

self.addEventListener("fetch", (event) => {
    event.respondWith(cacheFirst(event.request));
});



const deleteCache = async (key) => {
    await caches.delete(key);
};

const deleteOldCaches = async () => {
    const cacheKeepList = ["v1"];
    const keyList = await caches.keys();
    const cachesToDelete = keyList.filter((key) => !cacheKeepList.includes(key));
    console.log(cachesToDelete);
    await Promise.all(cachesToDelete.map(deleteCache));
};

self.addEventListener("activate", (event) => {
    console.log('activate?');
    event.waitUntil(deleteOldCaches());
});

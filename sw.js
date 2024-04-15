// https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers

const app_version = "v1.4.1";

const addResourcesToCache = async (resources) => {
    const cache = await caches.open(app_version);
    await cache.addAll(resources);
};

self.addEventListener("install", (event) => {
    event.waitUntil(
        addResourcesToCache([
            "./",
            "./index.html",
            // css
            "./bootstrap/css/bootstrap.min.css",
            "./bootstrap/css/bootstrap-icons.min.css",
            "./bootstrap/css/fonts/bootstrap-icons.woff2",
            "./app.css",
            // images
            "./images/compass.png",
            "./images/gps_follow.png",
            "./images/gps_on.png",
            "./images/gps_off.png",
            "./images/gps_location.png",
            // scripts - dependencies
            "./bootstrap/js/bootstrap.bundle.min.js",
            "./jquery/jquery-3.7.0.min.js",
            "./jszip/jszip.min.js",
            "./three.module.min.js",
            "./addons/controls/OrbitControls.js",
            "./addons/controls/MapControls.js",
            "./geodesy/latlon-ellipsoidal-datum.js",
            "./geodesy/latlon-ellipsoidal.js",
            "./geodesy/dms.js",
            "./geodesy/vector3d.js",
            "./geodesy/utm.js",
            // scripts - app
            "./app.js",
            "./project.js",
            "./profiler.js",
            "./deviceposition.js",
            "./terrain.js",
            "./terrain_chunk.js",
            "./position_marker.js",
            "./kml.js",
            "./distance.js",
            "./location_manager.js",
            "./helper.js"
        ]),
    );
    console.log('installed');
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
    const cacheKeepList = [app_version];
    const keyList = await caches.keys();
    const cachesToDelete = keyList.filter((key) => !cacheKeepList.includes(key));
    console.log(cachesToDelete);
    await Promise.all(cachesToDelete.map(deleteCache));
};

self.addEventListener("activate", (event) => {
    console.log('activate');
    event.waitUntil(deleteOldCaches());
});

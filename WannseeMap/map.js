/* =========================================================
   map.js — Leaflet fullscreen map
   - OpenStreetMap base layer
   - GeoTIFF overlays: loaded 3 → 2 → 1  (1 ends up on top)
   - GPS: small dot marker + accuracy circle
   - GPS spark/reconnect button (bottom-left)
   ========================================================= */

/* ── 1. Initialise Map ─────────────────────────────────── */
const map = L.map('map', {
  center: [52.52, 13.405], // fallback centre (Berlin) — overridden by GPS / TIF bounds
  zoom: 13,
  zoomControl: true,
});

// Move zoom control away from our GPS button
map.zoomControl.setPosition('bottomright');

// OpenStreetMap base layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
}).addTo(map);


/* ── 2. GeoTIFF Overlays ───────────────────────────────── */

/**
 * Load a single GeoTIFF file and add it as a GeoRasterLayer.
 * georaster-layer-for-leaflet reads the embedded CRS (25833 or 4326)
 * and reprojects automatically using proj4.
 *
 * @param {string}   url       – path to the .tif file
 * @param {number}   opacity   – layer opacity (0–1)
 * @returns {Promise<GeoRasterLayer>}
 */
async function loadGeoTiff(url, opacity = 0.75) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);

  const arrayBuffer = await response.arrayBuffer();
  const georaster   = await parseGeoraster(arrayBuffer);

  const layer = new GeoRasterLayer({
    georaster,
    opacity,
    resolution: 256,           // tile resolution in px (higher = sharper but slower)
    pixelValuesToColorFn: null, // use default single-band greyscale / RGBA passthrough
  });

  return layer;
}

/**
 * Load all three TIFFs in display order: 3 → 2 → 1.
 * Each is awaited sequentially so layers stack correctly
 * (last added = on top, so 1.tif will be topmost).
 *
 * The map view is fitted to the combined bounds of all loaded layers.
 */
async function loadAllTiffs() {
  const files = [
    { url: '3.tif', opacity: 0.70 },
    { url: '2.tif', opacity: 0.75 },
    { url: '1.tif', opacity: 0.80 },
  ];

  const loadedBounds = [];

  for (const { url, opacity } of files) {
    try {
      const layer = await loadGeoTiff(url, opacity);
      layer.addTo(map);

      // Collect bounds so we can fit the map view afterwards
      const b = layer.getBounds();
      if (b && b.isValid()) loadedBounds.push(b);

      console.log(`✓ Loaded ${url}`);
    } catch (err) {
      console.warn(`✗ Could not load ${url}:`, err.message);
    }
  }

  // Fit map to the union of all TIF bounds (if any loaded successfully)
  if (loadedBounds.length > 0) {
    const unionBounds = loadedBounds.reduce((acc, b) => acc.extend(b), loadedBounds[0]);
    map.fitBounds(unionBounds, { padding: [20, 20] });
  }
}

// Kick off TIF loading (non-blocking — map is interactive immediately)
loadAllTiffs();


/* ── 3. GPS Tracking ───────────────────────────────────── */

// Elements
const gpsBtn        = document.getElementById('gps-btn');
const gpsStatus     = document.getElementById('gps-status');
const gpsStatusText = document.getElementById('gps-status-text');

// Leaflet layers for GPS position
let gpsDotMarker       = null;   // the small dot marker
let gpsAccuracyCircle  = null;   // blue accuracy radius circle
let gpsWatchId         = null;   // ID from watchPosition, so we can clear it

/** Show a toast message in the status bar */
function showStatus(msg, type = '', duration = 3500) {
  gpsStatusText.textContent = msg;
  gpsStatus.className = 'gps-status' + (type ? ` ${type}` : '');
  if (duration > 0) {
    setTimeout(() => { gpsStatus.classList.add('hidden'); }, duration);
  }
}

/** Build the custom GPS dot icon (HTML-based, no default marker image) */
function createGpsDotIcon() {
  return L.divIcon({
    className: '',           // wipe Leaflet's default classes
    html: `
      <div class="gps-dot-wrapper">
        <div class="gps-dot-ring"></div>
        <div class="gps-dot-core"></div>
      </div>`,
    iconSize:   [16, 16],
    iconAnchor: [8, 8],      // centre of the 16×16 icon
  });
}

/** Called every time the browser delivers a new position fix */
function onPositionUpdate(pos) {
  const { latitude, longitude, accuracy } = pos.coords;
  const latlng = L.latLng(latitude, longitude);

  // Stop "searching" animation on the spark button
  gpsBtn.classList.remove('searching');

  // ── Dot marker ──────────────────────────────────────────
  if (!gpsDotMarker) {
    gpsDotMarker = L.marker(latlng, {
      icon:        createGpsDotIcon(),
      zIndexOffset: 1000,
      interactive: false,    // no click events needed on the dot itself
    }).addTo(map);
  } else {
    gpsDotMarker.setLatLng(latlng);
  }

  // ── Accuracy circle ──────────────────────────────────────
  if (!gpsAccuracyCircle) {
    gpsAccuracyCircle = L.circle(latlng, {
      radius:      accuracy,
      color:       '#4287f5',
      fillColor:   '#4287f5',
      fillOpacity: 0.10,
      weight:      1.5,
      interactive: false,
    }).addTo(map);
  } else {
    gpsAccuracyCircle.setLatLng(latlng);
    gpsAccuracyCircle.setRadius(accuracy);
  }

  // Pan to user on first successful fix (only once per session)
  if (!gpsDotMarker._hasInitialView) {
    map.setView(latlng, Math.max(map.getZoom(), 16));
    gpsDotMarker._hasInitialView = true;
  }

  showStatus(`GPS active · ±${Math.round(accuracy)} m`, 'success', 3000);
}

/** Called when the browser refuses or loses GPS */
function onPositionError(err) {
  gpsBtn.classList.remove('searching');

  const messages = {
    1: 'Location access denied. Tap ⚡ to try again.',
    2: 'Position unavailable. Tap ⚡ to retry.',
    3: 'GPS timed out. Tap ⚡ to retry.',
  };

  showStatus(messages[err.code] || 'GPS error. Tap ⚡ to retry.', 'error', 0);
  console.warn('Geolocation error:', err.message);
}

/** Start (or restart) GPS watching */
function startGPS() {
  if (!navigator.geolocation) {
    showStatus('Geolocation not supported by this browser.', 'error', 0);
    return;
  }

  // Stop any existing watch before starting fresh
  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }

  // Show "searching" state on button
  gpsBtn.classList.add('searching');
  showStatus('Searching for GPS signal…', '', 0);

  gpsWatchId = navigator.geolocation.watchPosition(
    onPositionUpdate,
    onPositionError,
    {
      enableHighAccuracy: true,
      timeout:            15000,   // 15 s before triggering an error
      maximumAge:         5000,    // accept a cached fix up to 5 s old
    }
  );
}

// ── Spark / reconnect button ──────────────────────────────────────────────
gpsBtn.addEventListener('click', () => {
  // Clear old layers so the dot re-appears cleanly after reconnect
  if (gpsDotMarker)      { map.removeLayer(gpsDotMarker);      gpsDotMarker      = null; }
  if (gpsAccuracyCircle) { map.removeLayer(gpsAccuracyCircle); gpsAccuracyCircle = null; }

  startGPS();
});

// ── Auto-start GPS on page load ───────────────────────────────────────────
startGPS();
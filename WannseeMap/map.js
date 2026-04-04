/* =================================================================
   map.js — XYZ Tile + GPS viewer
================================================================= */

/* ── 1. Initialise Map ──────────────────────────────────────────── */
const map = L.map('map', {
  center:      [52.52, 13.405],
  zoom:        13,
  zoomControl: true,
});

map.zoomControl.setPosition('bottomright');

/* ── 2. Base layer (OpenStreetMap) ──────────────────────────────── */
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
}).addTo(map);

/* ── 3. Your merged tile overlay ────────────────────────────────── */
L.tileLayer('tiles/{z}/{x}/{y}.png', {
  opacity:     1,
  maxZoom:     18,
  minZoom:     12,
  tms:         false,   // XYZ scheme (standard from QGIS)
  errorTileUrl: '',     // outside your tile extent → just show basemap
}).addTo(map);


/* ── 4. GPS Tracking ────────────────────────────────────────────── */

const gpsBtn        = document.getElementById('gps-btn');
const gpsStatus     = document.getElementById('gps-status');
const gpsStatusText = document.getElementById('gps-status-text');

let gpsDotMarker      = null;
let gpsAccuracyCircle = null;
let gpsWatchId        = null;
let gpsInitialView    = false;


function showStatus(msg, type = '', duration = 3500) {
  gpsStatusText.textContent = msg;
  gpsStatus.className = 'gps-status' + (type ? ` ${type}` : '');
  if (duration > 0) setTimeout(() => gpsStatus.classList.add('hidden'), duration);
}

function createGpsDotIcon() {
  return L.divIcon({
    className: '',
    html: `<div class="gps-dot-wrapper">
             <div class="gps-dot-ring"></div>
             <div class="gps-dot-core"></div>
           </div>`,
    iconSize:   [16, 16],
    iconAnchor: [8, 8],
  });
}

function onPositionUpdate(pos) {
  const { latitude, longitude, accuracy } = pos.coords;
  const latlng = L.latLng(latitude, longitude);

  gpsBtn.classList.remove('searching');

  if (!gpsDotMarker) {
    gpsDotMarker = L.marker(latlng, {
      icon:         createGpsDotIcon(),
      zIndexOffset: 1000,
      interactive:  false,
    }).addTo(map);
  } else {
    gpsDotMarker.setLatLng(latlng);
  }

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

  if (!gpsInitialView) {
    gpsInitialView = true;
    map.setView(latlng, Math.max(map.getZoom(), 16));
  }

  showStatus(`GPS active · ±${Math.round(accuracy)} m`, 'success', 3000);
}

function onPositionError(err) {
  gpsBtn.classList.remove('searching');
  const messages = {
    1: 'Location access denied. Press GPS Reconnect to try again.',
    2: 'Position unavailable. Press GPS Reconnect to retry.',
    3: 'GPS timed out. Press GPS Reconnect to retry.',
  };
  showStatus(messages[err.code] || 'GPS error. Press GPS Reconnect to retry.', 'error', 0);
}

function startGPS() {
  if (!navigator.geolocation) {
    showStatus('Geolocation not supported by this browser.', 'error', 0);
    return;
  }
  if (gpsWatchId !== null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }
  gpsBtn.classList.add('searching');
  showStatus('Searching for GPS signal…', '', 0);
  gpsWatchId = navigator.geolocation.watchPosition(
    onPositionUpdate,
    onPositionError,
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
  );
}

gpsBtn.addEventListener('click', () => {
  if (gpsDotMarker)      { map.removeLayer(gpsDotMarker);      gpsDotMarker      = null; }
  if (gpsAccuracyCircle) { map.removeLayer(gpsAccuracyCircle); gpsAccuracyCircle = null; }
  gpsInitialView = false;
  startGPS();
});

startGPS();
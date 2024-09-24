var map;
var L;
var ZoomMax = 23; // Allows zooming to level 21
var ZoomVegeationLimit = 15;
var NativeMaxZoom = 19; // Maximum zoom level where new tiles are loaded

let SourceList = [];
async function InitializeMap() {

    map = L.map('map', {
        keyboard: false,
        maxZoom: ZoomMax // Allows map to zoom up to level 21
    }).setView([52.52, 13.40], 12);

    map.removeControl(map.zoomControl);

    map.on('click', function (e) {
        onMapClick(e);
      });

    map.on('contextmenu', function(e) {
        e.originalEvent.preventDefault();
        onMapClickRight(e);
    });
      

    var baseLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: ZoomMax, // Max zoom level for the map
        maxNativeZoom: NativeMaxZoom, // Maximum zoom level for which tiles are available
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    var wmsLayer = L.tileLayer.wms('https://fbinter.stadt-berlin.de/fb/wms/senstadt/k_06_10_2veghoehe?', {
        layers: '3', // Internal name for the "Vegetationshöhen 2020 (Raster)" layer
        format: 'image/png',
        transparent: true,
        opacity: 0.5,
        attribution: '&copy; <a href="http://www.stadtentwicklung.berlin.de/geoinformation/fis-broker/">Senatsverwaltung für Stadtentwicklung, Bauen und Wohnen Berlin</a>',
        crs: L.CRS.EPSG4326, // Coordinate Reference System
        minZoom: ZoomVegeationLimit, // Adjust these zoom levels as needed
        maxZoom: ZoomMax, // Max zoom level for the map
        maxNativeZoom: NativeMaxZoom // Maximum zoom level for which WMS tiles are available
    }).addTo(map);

    var wmsBounds = L.latLngBounds(
        L.latLng(52.3284, 13.079), // SouthWest corner
        L.latLng(52.6877, 13.7701) // NorthEast corner
    );
    
    // Event listener for zoom levels
    map.on('zoomend', function() {
        var currentZoom = map.getZoom();
        var mapBounds = map.getBounds();
        
        if (currentZoom < ZoomVegeationLimit || currentZoom > ZoomMax || !wmsBounds.overlaps(mapBounds)) {
            map.removeLayer(wmsLayer); // Remove WMS layer when zoomed too far out or in
            if (!map.hasLayer(baseLayer)) {
                map.addLayer(baseLayer); // Ensure base layer is visible
            }
        } else {
            if (!map.hasLayer(wmsLayer)) {
                map.addLayer(wmsLayer); // Add WMS layer when within the zoom range
            }
        }
    });

}

async function clearAllLayers(LayerList) {
    LayerList.forEach(layer => {
        map.removeLayer(layer);
    });
    LayerList.length = 0; // Clear the array
}

/*
async function AddGeoJsonFeatureToMap_Source(geoJson){
    await RemoveLayer(SourceList)
    await AddGeoJsonToMapSourceValue(SourceList, geoJson, "#FF7200")
}
*/
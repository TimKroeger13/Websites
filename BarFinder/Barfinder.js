function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(PlotMap, null, options);
    }
}

var options = {
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 0
};

function PlotMap(position) {

    const PosLat = position.coords.latitude
    const PosLon = position.coords.longitude

    console.log(PosLat)
    console.log(PosLon)

    var map = L.map('map').setView([PosLat, PosLon], 16);

    map.attributionControl.addAttribution('Data from GEOFABRIK [Open Database License 1.0]');

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    L.marker([PosLat, PosLon]).addTo(map);

    var geojsonMarkerOptions = {
        radius: 8,
        fillColor: "#ff7800",
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 1
    };

    L.geoJSON(bar, {
        pointToLayer: function (feature, latlng) {
            return L.circleMarker(latlng, geojsonMarkerOptions);
        }
    }).addTo(map);

    //L.geoJSON(geojsonFeature).addTo(map);



}
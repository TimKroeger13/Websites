BHEfieldLayerList = [];
BHEfieldGeoJsonList = [];
BufferLayer = [];
var CurrentBuffer;

async function createPoint(lng,log){
    var point = turf.point([lng, log]);;
    await AddBHEToMap(BHEfieldLayerList, BHEfieldGeoJsonList, point);
    var b = 3;
}

async function AddBHEToMap(LayerList, GeoJsonList, geoJson){

    const customIcon = L.icon({
        iconUrl: "PointSymbol/BHE.png",
        iconSize: [14, 14], // size of the icon
        iconAnchor: [7, 7], // point of the icon which will correspond to marker's location
        popupAnchor: [0, 0], // point from which the popup should open relative to the iconAnchor
        shadowSize: [0, 0]  // size of the shadow
    });

    let geoJsonLayer = L.geoJSON(geoJson, {
        pointToLayer: function (feature, latlng) {
            if (feature.geometry.type === 'Point') {
                return L.marker(latlng, { icon: customIcon });
            }
            return L.marker(latlng); // Fallback for other types (could be empty or different logic)
        }
    }).addTo(map);

    LayerList.push(geoJsonLayer);
    GeoJsonList.push(geoJson);

}

async function ReDrawBuffer(){

    clearAllLayers(BufferLayer);

    const pointsFeatureCollection = turf.featureCollection(BHEfieldGeoJsonList);

    const sliderState = document.getElementById('numberSlider');
    const buffered = turf.buffer(pointsFeatureCollection, (sliderState.value), { units: 'meters', steps: 30 });

    let mergedBuffer = buffered.features[0];

    for (let i = 1; i < buffered.features.length; i++) {
        mergedBuffer = turf.union(mergedBuffer, buffered.features[i]);
    }

    AddBufferToMap(BufferLayer, buffered);

    CurrentBuffer = mergedBuffer;

}

async function RemoveNearestBHE(clickCoordinates){

    nearestPoint = await FindPointWithSamlestDistance(clickCoordinates);
    
    BHEfieldGeoJsonList.splice(nearestPoint,1);

    await RePlotAllBHE();

    await ReDrawBuffer();
}

async function FindPointWithSamlestDistance(clickCoordinates){

    let rightClickPoint = turf.point([clickCoordinates.lng,clickCoordinates.lat]);
    let distance = Infinity;
    let Minimaldistance = Infinity;
    let marker = Infinity;

    for (let i = 0; i < BHEfieldGeoJsonList.length; i++) {
        let entry = BHEfieldGeoJsonList[i];

        distance = turf.distance(rightClickPoint, entry);
        
        if(distance < Minimaldistance){
            Minimaldistance = distance;
            marker = i;
        }
    }

    return marker;

}

async function FindNearestPointOnBuffer(clickCoordinates){

    let ClickPoint = turf.point([clickCoordinates.lng,clickCoordinates.lat]);
    let distance = Infinity;
    let Minimaldistance = Infinity;
    let marker = Infinity;
    

    const SearchRadius = turf.buffer(ClickPoint, 1, { units: 'meters', steps: 30 });

    const intersections = [];

    if(CurrentBuffer == undefined){
        return false;
    }

    if (CurrentBuffer.type === 'Feature') {
        CurrentBuffer = CurrentBuffer.geometry;
    }
    if (CurrentBuffer.type === 'MultiPolygon') {
        CurrentBuffer.coordinates.forEach(polygon => {
            const singlePolygon = {
                type: 'Polygon',
                coordinates: polygon
            };
            const intersection = turf.intersect(SearchRadius, singlePolygon);
            if (intersection) {
                intersections.push(intersection);
            }
        });
        
    } else if (CurrentBuffer.type === 'Polygon') {
        const intersection = turf.intersect(SearchRadius, CurrentBuffer);
        if (intersection) {
            intersections.push(intersection);
        }
    }

    if(intersections == 0){
        console.log("false");
        return false;
    }

    //union Intersections

    let unionIntersections = intersections[0].geometry;

    for (let i = 1; i < intersections.length; i++) {
        unionIntersections = turf.union(unionIntersections, intersections[i].geometry);
    }

    let PotentialNearestBufferPoints = [];

    if (unionIntersections.type === 'Feature') {
        unionIntersections = unionIntersections.geometry;
    }

    if (unionIntersections.type === 'MultiPolygon') {
        unionIntersections.coordinates.forEach(polygon => {
            polygon.forEach(ring => {
                ring.forEach(coord => {
                    PotentialNearestBufferPoints.push(coord);
                });
            });
        });
    } else if (unionIntersections.type === 'Polygon') {
        unionIntersections.coordinates.forEach(ring => {
            ring.forEach(coord => {
                PotentialNearestBufferPoints.push(coord);
            });
        });
    } else {
        console.error('Unsupported geometry type:', unionIntersections.type);
    }

    for (let i = 0; i < PotentialNearestBufferPoints.length; i++) {
        let entry = PotentialNearestBufferPoints[i];

        let potentialPoint = turf.point([entry[0], entry[1]]);;

        distance = turf.distance(potentialPoint, ClickPoint);
        
        if(distance < Minimaldistance){
            Minimaldistance = distance;
            marker = i;
        }
    }

    return(PotentialNearestBufferPoints[marker]);
}

async function RePlotAllBHE(){

    clearAllLayers(BHEfieldLayerList);

    BHEfieldLayerList = [];

    TempGeoJsonList = structuredClone(BHEfieldGeoJsonList) 
    BHEfieldGeoJsonList = [];

    for (let i = 0; i < TempGeoJsonList.length; i++) {
        await AddBHEToMap(BHEfieldLayerList,BHEfieldGeoJsonList,TempGeoJsonList[i]);
        
    }
}







function combineToMultiPoint(features) {
    const multiPointCoordinates = [];

    for (let i = 0; i < features.length; i++) {
        multiPointCoordinates.push(features[i].geometry.coordinates);
    }

    const multiPointFeature = turf.multiPoint(multiPointCoordinates);

    const featureCollection = turf.featureCollection([multiPointFeature]);

    return featureCollection;
}


function downloadGeoJSON(data, filename = 'BHEfield.geojson') {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function exportBHE() {
    const combinedFeature = combineToMultiPoint(BHEfieldGeoJsonList);
    downloadGeoJSON(combinedFeature);
}


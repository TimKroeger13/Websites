async function onMapClick(e, callback) {

    var clickCoordinates = e.latlng;
    const checkbox = document.getElementById('Snapping');

    if (checkbox.checked) {
        var NearstBufferPoint = await FindNearestPointOnBuffer(clickCoordinates);
        if(NearstBufferPoint != false){
            clickCoordinates.lng = NearstBufferPoint[0];
            clickCoordinates.lat = NearstBufferPoint[1];
        }
    }


    await createPoint(clickCoordinates.lng, clickCoordinates.lat);

    await ReDrawBuffer();

}

async function onMapClickRight(e, callback) {

    var clickCoordinates = e.latlng;

    await RemoveNearestBHE(clickCoordinates);

}
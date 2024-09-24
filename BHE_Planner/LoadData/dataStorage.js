let BackroundList = [];


async function loadBackroundGeometry(){

    geoJson = await loadData();

    await AddGeoJsonToMap(BackroundList, geoJson, "#FF7200", true)
}


async function AddGeoJsonToMap(LayerList, geoJson, color, zoom) {
    // Check if the geoJson contains point features
    if (geoJson.features && geoJson.features.some(f => f.geometry.type === 'Point')) {
        handlePointFeatures(LayerList, geoJson); // Handle point features separately
        return;
    }

    if (geoJson.features && geoJson.features.some(f => f.geometry.type === 'Polygon')) {

    }

    if (geoJson.features && geoJson.features.some(f => f.geometry.type === 'LineString ')) {
        
    }

    if (geoJson.features && geoJson.features.some(f => f.geometry.type === 'MultiPolygon')) {
        handleMultiPolygonFeatures(LayerList, geoJson);
        return;
    }

   
    // Standard handling for GeoJSON layer (for lines, polygons later)
    let geoJsonLayer = L.geoJSON(geoJson, {
        style: function (feature) {
            return {
                color: color,
            };
        },
    }).addTo(map);


    if (zoom) {
        map.fitBounds(geoJsonLayer.getBounds());
    }

    LayerList.push(geoJsonLayer);
    
}

function AddBufferToMap(LayerList, geoJson){

    const style = {
        color: 'blue',              // Outline color
        weight: 2,                  // Outline thickness
        opacity: 1,                 // Outline opacity
        dashArray: '5, 5',          // Dotted line (5px dash, 5px gap)
        fillColor: 'transparent',   // Fill color (transparent for no fill)
        fillOpacity: 0              // Fill opacity (0 means no fill)
    };
    
    geoJsonLayer = L.geoJSON(geoJson, {
        style: style
    }).addTo(map);

    LayerList.push(geoJsonLayer);
}


function handleMultiPolygonFeatures(LayerList, geoJson) {
    // List of available hex colors

    // Prompt user to select a color
    const selectedColor = prompt("Select a color for the multipolygons (e.g., #ADD8E6 for LightBlue):\nFor boundary: b");

    let geoJsonLayer;

    // Validate selected color
    if(selectedColor == "b"){
        geoJsonLayer = L.geoJSON(geoJson, {
            style: function (feature) {
                return {
                    color: "#000000",
                    weight: 1, // Line weight
                    fillOpacity: 0 // Fill opacity
                };
            },
        }).addTo(map);
    }else{

        // Create a GeoJSON layer with the selected color
        geoJsonLayer = L.geoJSON(geoJson, {
            style: function (feature) {
                return {
                    color: selectedColor,
                    weight: 0, // Line weight
                    fillOpacity: 0.4 // Fill opacity
                };
            },
        }).addTo(map);

    }

    // Optionally, fit the map to the bounds of the geoJsonLayer
    if (geoJsonLayer.getBounds().isValid()) {
        map.fitBounds(geoJsonLayer.getBounds());
    }

    // Add the layer to LayerList
    LayerList.push(geoJsonLayer);
}



function handlePointFeatures(LayerList, geoJson) {
    // Collect all properties from point features
    const propertiesList = geoJson.features
        .filter(f => f.geometry.type === 'Point')
        .map(f => f.properties);

    // Assuming all point features have the same structure
    const exampleProperties = propertiesList[0];
    const propertyNames = Object.keys(exampleProperties);

    // Display a popup to select the property to use for types
    const selectedProperty = prompt("Select a property to categorize points: " + propertyNames.join(", "));

    if (!selectedProperty || !propertyNames.includes(selectedProperty)) {
        alert("Invalid property selected.");
        return;
    }

    // Get all distinct types based on selected property
    const types = [...new Set(propertiesList.map(p => p[selectedProperty]))];

    // List of available colors
    const availableColors = ["PointBlue", "PointGreen", "PointLila", "PointOrange", "PointRed", "PointYellow","SquareBlue","SquareGreen","SquareLila","SquareOrange","SquareRed","SquareYellow"];
    
    // Generate dropdown HTML for each type
    let dropdownHtml = `<form id="colorSelectionForm">`;
    types.forEach(type => {
        dropdownHtml += `<label for="${type}">Select color for type "${type}": </label>
            <select id="${type}" name="${type}">
                ${availableColors.map(color => `<option value="${color}">${color}</option>`).join('')}
            </select><br>`;
    });
    dropdownHtml += `<button type="submit">Apply</button></form>`;


    const modalDiv = document.getElementById('modalId'); // Get the existing modal div by its ID
    modalDiv.innerHTML = dropdownHtml; // Populate it with the dropdown HTML
    modalDiv.style.display = 'block'; // Show the modal by setting its display style

    // Handle form submission
    document.getElementById("colorSelectionForm").addEventListener("submit", function(event) {
        event.preventDefault();
        const colorMapping = {};
        types.forEach(type => {
            const selectedColor = document.getElementById(type).value;
            colorMapping[type] = selectedColor;
        });

        // Cleanup the form/modal
        document.body.removeChild(modalDiv);

        // Add points with selected colors to the map
        geoJson.features.forEach(feature => {
            if (feature.geometry.type === 'Point') {
                const type = feature.properties[selectedProperty];
                const color = colorMapping[type];
                const iconUrl = `PointSymbol/${color}.png`; // Construct icon path

                const icon = L.icon({
                    iconUrl: iconUrl,
                    iconSize: [10, 10], // size of the icon
                    iconAnchor: [5, 5], // point of the icon which will correspond to marker's location
                    popupAnchor: [0, 0], // point from which the popup should open relative to the iconAnchor
                    shadowSize: [0, 0]  // size of the shadow
                });

                const marker = L.marker([feature.geometry.coordinates[1], feature.geometry.coordinates[0]], { icon: icon })
                    .addTo(map)
                    .bindPopup(`Type: ${type}<br>Properties: ${JSON.stringify(feature.properties)}`);

                // Store marker in LayerList
                LayerList.push(marker);
            }
        });
    });
}



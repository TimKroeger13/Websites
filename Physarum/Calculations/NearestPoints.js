async function getNearestPointsOfFeatureCollectionAndLine(SourceGeometry, NetworkGeometry, UserGeometry){
    let pointFeatures = [];
    
    let OrginalUserPoints = UserGeometry;
    //add Source point to list
    OrginalUserPoints.features.push(SourceGeometry.features[0]);
    
    for (let i = 0; i < OrginalUserPoints.features.length; i++){
    
        let PointDistances = [];
    
        for (let k = 0; k < NetworkGeometry.features.length; k++){
    
            let currentPoint = turf.nearestPointOnLine(NetworkGeometry.features[k], OrginalUserPoints.features[i]);
    
            PointDistances.push(currentPoint.properties.dist);
        }
    
        let nereastIndex = PointDistances.indexOf(Math.min.apply(null,PointDistances));
    
        PointDistances = [];
    
        let neastPoint = turf.nearestPointOnLine(NetworkGeometry.features[nereastIndex], OrginalUserPoints.features[i]);
    
        pointFeatures.push(neastPoint);
    }

    return pointFeatures;
}
    
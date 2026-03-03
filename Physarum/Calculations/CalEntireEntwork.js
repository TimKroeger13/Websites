async function calculateTheEntireNetwork(CompleteNetwork, SourceGeometry, UserGeometry) {

    var UserGeometryList = [];
    var CompleteNetworkList = [];
    var CompleteNetworkList_weighted = [];
    var CurrentNetworkList = [];
    var CurrentNetworkList_weighted = [];
    var CurrentNetworkPossabilityList = [];
    var CurrentSourceGeometry = [];

    var EntireNetwork = [];
    var EntireUsage = [];
    var RunningUsage = 0;
    var RunningLength = 0;
    var RunningOrder = 0;
    var FoundUsage;

    var heatCutoff = 1;
    
    // Initialize EntireNetwork with the source network (if it's a network of lines)
    // This treats the source as already-built infrastructure
    // For single points, use the original behavior
    let sourceIsNetwork = SourceGeometry.features.some(f => 
        f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString'
    );

    if (sourceIsNetwork) {
        // Source is a network - initialize EntireNetwork with it
        for (let i = 0; i < SourceGeometry.features.length; i++) {
            let sourceFeature = SourceGeometry.features[i];
            
            if (sourceFeature.geometry.type === 'LineString' || 
                sourceFeature.geometry.type === 'MultiLineString') {
                
                let featureLength = turf.length(sourceFeature, { units: 'kilometers' }) * 1000;
                
                EntireNetwork.push({
                    id: -1 - i,
                    data: sourceFeature,
                    value: 0,
                    length: featureLength,
                    PathLength: RunningLength,
                    PathValue: 0,
                    Order: RunningOrder,
                    PathTotalProfit: 0
                });
                
                RunningLength += featureLength;
                RunningOrder++;
            }
        }
        
        CurrentSourceGeometry = JSON.parse(JSON.stringify(EntireNetwork));
    } else {
        // Source is a point - use original behavior
        for (let i = 0; i < SourceGeometry.features.length; i++) {
            CurrentSourceGeometry.push({
                id: i,
                data: SourceGeometry.features[i],
                value: 0,
                length: 0
            });
        }
    }

    // If we have a network (EntireNetwork is populated), use it as CurrentSourceGeometry
    // Otherwise, CurrentSourceGeometry already has the point(s)
    if (EntireNetwork.length > 0) {
        CurrentSourceGeometry = JSON.parse(JSON.stringify(EntireNetwork));
    }

    const tolerance = 0.1;

    for (let i = 0; i < CompleteNetwork.features.length; i++) {
        CompleteNetworkList.push({
            id: i,
            data: CompleteNetwork.features[i],
            value: 0,
            length: 0
        });
    }

    for (let i = 0; i < UserGeometry.features.length; i++) {
        UserGeometryList.push({
            id: i,
            data: UserGeometry.features[i],
            value: UserGeometry.features[i].properties.value,
            length: 0
        });
    }

    // Remove source entry only if source is a Point (not a network)
    // When source is a Point, NearestPoints.js adds it to user points temporarily
    // When source is a network, it doesn't add anything to user points
    let sourceIsPoint = SourceGeometry.features.some(f => f.geometry.type === 'Point');
    if (sourceIsPoint) {
        UserGeometryList.pop(); // Remove the source point that was added
    }
    //remove source entry

    var calculationTotalLength = UserGeometryList.length;
    var calculationCounter = 0;

    while (UserGeometryList.length > 0){
        calculationCounter++;

        CompleteNetworkList_weighted = JSON.parse(JSON.stringify(CompleteNetworkList)); //is it reight here?

        for (let i = 0; i <UserGeometryList.length; i++){
            CurrentNetworkList_weighted = [];
            CurrentNetworkPossabilityList = [];

            CurrentNetworkList = JSON.parse(JSON.stringify(CompleteNetworkList));

            let CurrentPoint = UserGeometryList[i];
            let CurrentPointFixValue = UserGeometryList[i].value;

            //var NetworkInSearch = true;
            //

            lineId = 0;

            var LinesInSearch = true; 

            while (LinesInSearch){

                if(CurrentNetworkList.length > 0){

                    let Intersecs =  checkIntersectionWithTolerance(CurrentNetworkList[lineId].data, CurrentPoint.data, 0.00000001); //0.00000001

                    if(Intersecs){

                        let CurrentLength = CurrentPoint.length + turf.length(CurrentNetworkList[lineId].data, { units: 'kilometers' }) * 1000;

                        let propagatedValue = CurrentPointFixValue / CurrentLength;

                        if (propagatedValue < heatCutoff) {  // <-- cutoff check
                            lineId++;
                        } else {
                            CurrentNetworkList[lineId].value = propagatedValue;
                            CurrentNetworkList[lineId].length = CurrentLength;
                            CurrentNetworkPossabilityList.push(CurrentNetworkList[lineId]);
                            CurrentNetworkList.splice(lineId, 1);
                        }

                    }else{
                        lineId++;
                    }
                }

                if(lineId == CurrentNetworkList.length){

                    if(CurrentNetworkPossabilityList.length > 0){

                        let maxValue = Math.max(...CurrentNetworkPossabilityList.map(item => item.value));
                        let foundMinValue = false;

                        let elementWithMinValue = CurrentNetworkPossabilityList.find(item => {
                            if (item.value === maxValue && !foundMinValue) {
                                foundMinValue = true;
                                return true;
                            }
                            return false;
                        });

                        CurrentNetworkList_weighted.push(elementWithMinValue);

                        let Spliceindex = CurrentNetworkPossabilityList.indexOf(elementWithMinValue);

                        CurrentNetworkPossabilityList.splice(Spliceindex,1);

                        CurrentPoint = elementWithMinValue;

                        lineId = 0;

                    } else {
                        // If cutoff pruned everything, retry without cutoff using highest demand path
                        if (CurrentNetworkPossabilityList.length === 0 && CurrentNetworkList_weighted.length === 0) {
                            let fallbackValue = 0;
                            let fallbackEntry = null;

                            for (let f = 0; f < CompleteNetworkList_weighted.length; f++) {
                                if (CompleteNetworkList_weighted[f].value > fallbackValue) {
                                    fallbackValue = CompleteNetworkList_weighted[f].value;
                                    fallbackEntry = CompleteNetworkList_weighted[f];
                                }
                            }

                            if (fallbackEntry) {
                                CurrentNetworkList_weighted.push(fallbackEntry);
                            }
                        }
                        LinesInSearch = false;
                    }
                }
            }

            for (let entry = 0; entry <CurrentNetworkList_weighted.length; entry++){

                let spliceId = CurrentNetworkList_weighted[entry].id;
                let foundIdValue = false;

                let elementWithSpliceId = CompleteNetworkList_weighted.find(item => {
                    if (item.id === spliceId) {
                        foundIdValue = true;
                        return true;
                    }
                    return false;
                });

                let SpliceindexComNet = CompleteNetworkList_weighted.indexOf(elementWithSpliceId);

                let currentNetworkWeights = CurrentNetworkList_weighted[entry].value;

                CompleteNetworkList_weighted[SpliceindexComNet].value = CompleteNetworkList_weighted[SpliceindexComNet].value + currentNetworkWeights;

            }
        }

        //Traverse Network

        let Traversing = true;
        let CompletePath = [];
        
        while(Traversing){

            let BestPath;
            let BestValue = 0;

            //Best Path

            if(typeof CurrentSourceGeometryBestPath !== 'undefined'){
                if(CurrentSourceGeometryBestPath.length != 0){

                for (let CNL = 0; CNL < CompleteNetworkList_weighted.length; CNL++){
                    for(let SG = 0; SG < CurrentSourceGeometryBestPath.length; SG++){

                            let Intersecs =  checkIntersectionWithTolerance(CompleteNetworkList_weighted[CNL].data, CurrentSourceGeometryBestPath[SG].data, 0.00000001);

                            if(!Intersecs){
                                continue;
                            }

                            if(CompleteNetworkList_weighted[CNL].value > BestValue){
                                BestPath = CompleteNetworkList_weighted[CNL];
                                BestValue = CompleteNetworkList_weighted[CNL].value;
                            }
                        }
                    }
                }
            }

            if(BestValue == 0){

                //Complete geometry
                for (let CNL = 0; CNL < CompleteNetworkList_weighted.length; CNL++){
                    for(let SG = 0; SG < CurrentSourceGeometry.length; SG++){

                        let Intersecs =  checkIntersectionWithTolerance(CompleteNetworkList_weighted[CNL].data, CurrentSourceGeometry[SG].data, 0.00000001);

                        if(!Intersecs){
                            continue;
                        }

                        if(CompleteNetworkList_weighted[CNL].value > BestValue){
                            BestPath = CompleteNetworkList_weighted[CNL];
                            BestValue = CompleteNetworkList_weighted[CNL].value;
                        }
                    }
                }

            }

            /*
            //plot
            var TestOutput = []


            TestOutput.push(BestPath.data);

        
            TestOutputFeature = turf.featureCollection(TestOutput)
            await AddGeoJsonFeatureToMap_EntireNetwork(TestOutputFeature);
            */

            if (!BestPath || BestValue === 0) {
                if (CompleteNetworkList_weighted.length > 0) {
                    BestPath = CompleteNetworkList_weighted[0];
                } else {
                    Traversing = false;
                    break;
                }
            }

            RunningLength = RunningLength + turf.length(BestPath.data, { units: 'kilometers' }) * 1000;

            CompletePath.push({
                id: BestPath.id,
                data: BestPath.data,
                value: BestPath.value,
                length: BestPath.length,
                PathLength: RunningLength,
                PathValue: RunningUsage,
                Order: RunningOrder,
                PathTotalProfit: (RunningUsage / RunningLength)
            });

            RunningOrder++;

            //check intersection with points

            Pointfound = false;

            for(let point = 0; point < UserGeometryList.length; point++){
                Pointfound = checkIntersectionWithTolerance(BestPath.data, UserGeometryList[point].data, 0.00000001);
                if(Pointfound){
                    FoundUsage = UserGeometryList[point];
                    break;
                }
            }

            let spliceId = BestPath.id; //here!!!
            let foundIdValue = false;

            let elementWithSpliceId = CompleteNetworkList.find(item => {
                if (item.id === spliceId) {
                    foundIdValue = true;
                    return true;
                }
                return false;
            });

            let SpliceindexComNet = CompleteNetworkList.indexOf(elementWithSpliceId);
            CompleteNetworkList.splice(SpliceindexComNet,1);

            let SpliceindexWeight = CompleteNetworkList_weighted.indexOf(BestPath);
            CompleteNetworkList_weighted.splice(SpliceindexWeight,1);

            CurrentSourceGeometry = CompletePath;

            let BestPathList = [];
            BestPathList.push(BestPath);

            CurrentSourceGeometryBestPath = BestPathList;

            if(Pointfound){
                break;
            }
        }

        //Add usage to runningusage
        RunningUsage = RunningUsage + FoundUsage.value;

        EntireUsage.push({
            data: FoundUsage.data,
            id: FoundUsage.id,
            length: FoundUsage.length,
            value: FoundUsage.value,
            occurence: RunningOrder
        })

        let SpliceindexUsage = UserGeometryList.indexOf(FoundUsage);
        UserGeometryList.splice(SpliceindexUsage,1);

        //Late update

        CompletePath[CompletePath.length-1].PathValue = RunningUsage;
        CompletePath[CompletePath.length-1].PathTotalProfit = (RunningUsage / RunningLength);

        for (let i = 0; i < CompletePath.length; i++) {
            EntireNetwork.push(CompletePath[i]);
        }

        CurrentSourceGeometry = EntireNetwork;
        CurrentSourceGeometryBestPath = [];

        
        var IntermidateOutput = []

        for (let i = 0; i < EntireNetwork.length; i++) {
            IntermidateOutput.push(EntireNetwork[i].data);
        }
    
        TestOutputFeature = turf.featureCollection(IntermidateOutput)
        await AddGeoJsonFeatureToMap_EntireNetwork(TestOutputFeature);
        
        updateLoadingStatus(calculationCounter, calculationTotalLength) 
        await new Promise(resolve => setTimeout(resolve, 0));

    }

    return [EntireNetwork, EntireUsage];
}

function checkIntersectionWithTolerance(geom1, geom2, tolerance) {
    let coords1 = geom1.geometry.type === 'Point' ? [geom1.geometry.coordinates] : geom1.geometry.coordinates;
    let coords2 = geom2.geometry.type === 'Point' ? [geom2.geometry.coordinates] : geom2.geometry.coordinates;

    for (let i = 0; i < coords1.length; i++) {
        for (let j = 0; j < coords2.length; j++) {
            let distance = turf.distance(turf.point(coords1[i]), turf.point(coords2[j]), { units: 'kilometers' }) * 1000;

            if (distance <= tolerance) {
                return true;
            }
        }
    }

    return false;
}

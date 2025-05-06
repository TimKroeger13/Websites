const rl_Mapping = {
    '0': 'M0RL',
    '-3': 'M3RL',
    '-5': 'M5RL'
};

const w_Mapping = {
    '1': 'w1',
    '2': 'w2',
    '3': 'w3',
    '4': 'w4',
    '5': 'w5',
};


async function GetSpecificHeatExtractionValue(n,w,rl){

    var CollectedDataToBoreholeNumber = await collectHeatExtracion(n)

    //////////////////// interpolate ///////////////////////

    //// RL value keys and weight ////
    var rl_nearestBounds = findNearestBounds(rl, [0, -3, -5]);
    const rl_key_lower = rl_Mapping[rl_nearestBounds.lower];
    const rl_key_upper = rl_Mapping[rl_nearestBounds.upper];

    if(rl_key_lower == rl_key_upper){
        rl_weitgh_upper = 1;
        rl_weigth_lower = 0;
    }else{
        //Weights
        var ValueRange_rl = Math.abs(rl_nearestBounds.lower - rl_nearestBounds.upper);
        var rl_weitgh_upper = Math.abs(rl - rl_nearestBounds.lower) / ValueRange_rl
        var rl_weigth_lower = 1 - rl_weitgh_upper;
    }

    //check: rl_weitgh_upper * rl_nearestBounds.upper + rl_weigth_lower * rl_nearestBounds.lower

    //// W value keys and weight ////
    var w_nearestBounds = findNearestBounds(w, [1, 2, 3, 4, 5]);
    const w_key_lower = w_Mapping[w_nearestBounds.lower];
    const w_key_upper = w_Mapping[w_nearestBounds.upper];

    if(w_key_lower == w_key_upper){
        w_weitgh_upper = 1;
        w_weigth_lower = 0;
    }else{
        //Weights
        var ValueRange_w = Math.abs(w_nearestBounds.lower - w_nearestBounds.upper);
        var w_weitgh_upper = Math.abs(w - w_nearestBounds.lower) / ValueRange_w
        var w_weigth_lower = 1 - w_weitgh_upper;
    }

    //check: w_weitgh_upper * w_nearestBounds.upper + w_weigth_lower * w_nearestBounds.lower

    
    



    //lower RL calculation
    var Low_Rl_Lower_W = CollectedDataToBoreholeNumber[rl_key_lower][w_key_lower];
    var Low_Rl_Upper_W = CollectedDataToBoreholeNumber[rl_key_lower][w_key_upper];

    var Low_Rl_total_W =  w_weigth_lower*Low_Rl_Lower_W + w_weitgh_upper*Low_Rl_Upper_W

    //Upper RL calculation
    var Upper_Rl_Lower_W = CollectedDataToBoreholeNumber[rl_key_upper][w_key_lower];
    var Upper_Rl_Upper_W = CollectedDataToBoreholeNumber[rl_key_upper][w_key_upper];

    var Upper_Rl_total_W =  w_weigth_lower*Upper_Rl_Lower_W + w_weitgh_upper*Upper_Rl_Upper_W

    //check: rl_weigth_lower * Low_Rl_total_W+ rl_weitgh_upper * Upper_Rl_total_W

    var total_r = rl_weigth_lower * Low_Rl_total_W+ rl_weitgh_upper * Upper_Rl_total_W;

    return total_r;

}


function findNearestBounds(value, list) {
    let lower = null;
    let upper = null;
  
    for (const num of list) {
      if (num <= value && (lower === null || num > lower)) {
        lower = num;
      }
      if (num >= value && (upper === null || num < upper)) {
        upper = num;
      }
    }
  
    return { lower, upper };
  }


async function collectHeatExtracion(n){

    if(n<=5){
        return {
            M0RL: All_VDIValues_For_M0RL_2400(n),
            M3RL: All_VDIValues_For_M3RL_2400(n),
            M5RL: All_VDIValues_For_M5RL_2400(n)
          };

    }else{
        return {
            M0RL: All_VDIFunctions_For_M0RL_2400(n),
            M3RL: All_VDIFunctions_For_M3RL_2400(n),
            M5RL: All_VDIFunctions_For_M5RL_2400(n)
          };
    }

}


///////////////////////////////////////////////////////////////////////////
/////////////////////////// -0 RL BLOCK ///////////////////////////////////
///////////////////////////////////////////////////////////////////////////

function All_VDIValues_For_M0RL_2400(n){
    return {
        w1: VDIVALUE_2400ha_M0RL_1WM(n),
        w2: VDIVALUE_2400ha_M0RL_2WM(n),
        w3: VDIVALUE_2400ha_M0RL_3WM(n),
        w4: VDIVALUE_2400ha_M0RL_4WM(n)
      };
}

function All_VDIFunctions_For_M0RL_2400(n){
    return {
        w1: VDIVALUE_2400ha_M0RL_1WM_function(n),
        w2: VDIVALUE_2400ha_M0RL_2WM_function(n),
        w3: VDIVALUE_2400ha_M0RL_3WM_function(n),
        w4: VDIVALUE_2400ha_M0RL_4WM_function(n)
      };
}

//-3 RL Values

function VDIVALUE_2400ha_M0RL_1WM(n) {

    if(n == 1){return(15.9);}
    if(n == 2){return(13.9);}
    if(n == 3){return(12.3);}
    if(n == 4){return(11.4);}
    if(n == 5){return(10.9);}

    return -999;
}
function VDIVALUE_2400ha_M0RL_1WM_function(n) {
    return (-3.1994 * Math.log(n) + 15.9434)
}

function VDIVALUE_2400ha_M0RL_2WM(n) {

    if(n == 1){return(24.7);}
    if(n == 2){return(22.1);}
    if(n == 3){return(19.9);}
    if(n == 4){return(18.9);}
    if(n == 5){return(18.2);}

    return -999;
}
function VDIVALUE_2400ha_M0RL_2WM_function(n) {
    return (-4.1564 * Math.log(n) + 24.7398)
}

function VDIVALUE_2400ha_M0RL_3WM(n) {

    if(n == 1){return(31.1);}
    if(n == 2){return(28.1);}
    if(n == 3){return(25.8);}
    if(n == 4){return(24.5);}
    if(n == 5){return(23.7);}

    return -999;
}
function VDIVALUE_2400ha_M0RL_3WM_function(n) {
    return (-4.7102 * Math.log(n) + 31.1500)
}

function VDIVALUE_2400ha_M0RL_4WM(n) {

    if(n == 1){return(36.0);}
    if(n == 2){return(33.0);}
    if(n == 3){return(30.6);}
    if(n == 4){return(29.2);}
    if(n == 5){return(28.3);}

    return -999;
}
function VDIVALUE_2400ha_M0RL_4WM_function(n) {
    return (-4.8931 * Math.log(n) + 36.1051)
}


///////////////////////////////////////////////////////////////////////////
/////////////////////////// -3 RL BLOCK ///////////////////////////////////
///////////////////////////////////////////////////////////////////////////

function All_VDIValues_For_M3RL_2400(n){
    return {
        w1: VDIVALUE_2400ha_M3RL_1WM(n),
        w2: VDIVALUE_2400ha_M3RL_2WM(n),
        w3: VDIVALUE_2400ha_M3RL_3WM(n),
        w4: VDIVALUE_2400ha_M3RL_4WM(n)
      };
}

function All_VDIFunctions_For_M3RL_2400(n){
    return {
        w1: VDIVALUE_2400ha_M3RL_1WM_function(n),
        w2: VDIVALUE_2400ha_M3RL_2WM_function(n),
        w3: VDIVALUE_2400ha_M3RL_3WM_function(n),
        w4: VDIVALUE_2400ha_M3RL_4WM_function(n)
      };
}

//-3 RL Values

function VDIVALUE_2400ha_M3RL_1WM(n) {

    if(n == 1){return(21.0);}
    if(n == 2){return(18.5);}
    if(n == 3){return(16.9);}
    if(n == 4){return(15.8);}
    if(n == 5){return(15.1);}

    return -999;
}
function VDIVALUE_2400ha_M3RL_1WM_function(n) {
    return (-3.7103 * Math.log(n) + 21.0126)
}

function VDIVALUE_2400ha_M3RL_2WM(n) {

    if(n == 1){return(32.8);}
    if(n == 2){return(29.4);}
    if(n == 3){return(27.2);}
    if(n == 4){return(25.5);}
    if(n == 5){return(24.5);}

    return -999;
}
function VDIVALUE_2400ha_M3RL_2WM_function(n) {
    return (-5.22 * Math.log(n) + 32.878)
}

function VDIVALUE_2400ha_M3RL_3WM(n) {

    if(n == 1){return(41.3);}
    if(n == 2){return(37.7);}
    if(n == 3){return(35.2);}
    if(n == 4){return(33.3);}
    if(n == 5){return(32.1);}

    return -999;
}
function VDIVALUE_2400ha_M3RL_3WM_function(n) {
    return (-5.78 * Math.log(n) + 41.454)
}

function VDIVALUE_2400ha_M3RL_4WM(n) {

    if(n == 1){return(47.9);}
    if(n == 2){return(44.2);}
    if(n == 3){return(41.6);}
    if(n == 4){return(39.6);}
    if(n == 5){return(38.5);}

    return -999;
}
function VDIVALUE_2400ha_M3RL_4WM_function(n) {
    return (-5.941 * Math.log(n) + 48.049)
}


///////////////////////////////////////////////////////////////////////////
/////////////////////////// -5 RL BLOCK ///////////////////////////////////
///////////////////////////////////////////////////////////////////////////

function All_VDIValues_For_M5RL_2400(n){
    return {
        w1: VDIVALUE_2400ha_M5RL_1WM(n),
        w2: VDIVALUE_2400ha_M5RL_2WM(n),
        w3: VDIVALUE_2400ha_M5RL_3WM(n),
        w4: VDIVALUE_2400ha_M5RL_4WM(n)
      };
}

function All_VDIFunctions_For_M5RL_2400(n){
    return {
        w1: VDIVALUE_2400ha_M5RL_1WM_function(n),
        w2: VDIVALUE_2400ha_M5RL_2WM_function(n),
        w3: VDIVALUE_2400ha_M5RL_3WM_function(n),
        w4: VDIVALUE_2400ha_M5RL_4WM_function(n)
      };
}

//-3 RL Values

function VDIVALUE_2400ha_M5RL_1WM(n) {

    if(n == 1){return(24.4);}
    if(n == 2){return(21.6);}
    if(n == 3){return(19.8);}
    if(n == 4){return(18.4);}
    if(n == 5){return(17.7);}

    return -999;
}
function VDIVALUE_2400ha_M5RL_1WM_function(n) {
    return (-4.2400 * Math.log(n) + 24.4398)
}

function VDIVALUE_2400ha_M5RL_2WM(n) {

    if(n == 1){return(38.2);}
    if(n == 2){return(34.4);}
    if(n == 3){return(31.9);}
    if(n == 4){return(30.0);}
    if(n == 5){return(28.9);}

    return -999;
}
function VDIVALUE_2400ha_M5RL_2WM_function(n) {
    return (-5.8581 * Math.log(n) + 38.2891)
}

function VDIVALUE_2400ha_M5RL_3WM(n) {

    if(n == 1){return(48.3);}
    if(n == 2){return(44.1);}
    if(n == 3){return(41.30);}
    if(n == 4){return(39.2);}
    if(n == 5){return(38.0);}

    return -999;
}
function VDIVALUE_2400ha_M5RL_3WM_function(n) {
    return (-6.4962 * Math.log(n) + 48.4001)
}

function VDIVALUE_2400ha_M5RL_4WM(n) {

    if(n == 1){return(55.9);}
    if(n == 2){return(51.2);}
    if(n == 3){return(48.9);}
    if(n == 4){return(46.8);}
    if(n == 5){return(45.5);}

    return -999;
}
function VDIVALUE_2400ha_M5RL_4WM_function(n) {
    return (-6.4547 * Math.log(n) + 55.8404)
}

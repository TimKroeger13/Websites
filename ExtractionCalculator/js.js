
async function calculateExtraction() {

    const RLInput = document.getElementById("RLInput");
    const ConductivityInput = document.getElementById("ConductivityInput");
    //const GroudWaterTempInput = document.getElementById("GroudWaterTempInput");
    const EWSAmountInput = document.getElementById("EWSAmountInput");

    var RL_value = -3;
    var Conductivity_value = ConductivityInput.value;
    //var GroudWaterTemp_value = GroudWaterTempInput.value;
    var EWSAmount_value = EWSAmountInput.value;

    var pecificHeatExtractionValue = await GetSpecificHeatExtractionValue(n = EWSAmount_value, w = Conductivity_value, rl = RL_value)

    animateResult(pecificHeatExtractionValue);
}



function animateResult(targetValue) {
    const element = document.getElementById("OutputResultID");
    const duration = 500; // animation duration in ms
    const frameRate = 30;  // frames per second
    const totalFrames = Math.round(duration / (1000 / frameRate));
    const startValue = parseFloat(element.innerHTML) || 0;
    const difference = targetValue - startValue;
  
    let frame = 0;
  
    const interval = setInterval(() => {
      frame++;
      const progress = frame / totalFrames;
      const current = startValue + difference * easeOutQuad(progress);
      element.innerHTML = current.toFixed(2); // no decimals
      if (frame >= totalFrames) clearInterval(interval);
    }, 1000 / frameRate);
  
    // optional easing for smooth effect
    function easeOutQuad(t) {
      return t * (2 - t);
    }
  }
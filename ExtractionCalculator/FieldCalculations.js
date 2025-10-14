async function CalculateFieldHeatSupply(wm){
    const EWSAmountInput = document.getElementById("EWSAmountInput");
    const JAZInput = document.getElementById("JAZInput");
    const DepthInput = document.getElementById("DepthInput");

    var HeatBase = ((wm * EWSAmountInput.value * DepthInput.value) / 1000);
    var HeatElectric = HeatBase / (JAZInput.value-1);

    return (HeatBase + HeatElectric);

}
var setTimer = Number(40);
let countdownInterval;
let isRunning = false;
var TimerID = 1;
var stagger = true;
var staggertime = 0; //sec
var Sec2Audio = new Audio('Sound/2secondsRemain.mp3');
var Sec10Audio = new Audio('Sound/10secondsRemain.mp3');
var TurnEndAudio = new Audio('Sound/TurnEnd.mp3');
var TimerEndAudio = new Audio('Sound/TimerEnd.mp3');
var StartSound = new Audio('Sound/StartSound.mp3');
var UseStartSound = true;

window.onload = function loadVariables()
{
    document.getElementById("resetButton").disabled = true;
    updateDisplays();

    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);

    //Load Audio
    Sec2Audio.load();
    Sec10Audio.load();
    TurnEndAudio.load();
    TimerEndAudio.load();
    StartSound.load();

}

window.addEventListener('resize', () => {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  });

function updateDisplays(){
    document.getElementById("activeTimerlable").innerHTML = setTimer;

    if (stagger){
        document.getElementById("clock1text").innerHTML = setTimer+staggertime*0;
        document.getElementById("clock2text").innerHTML = setTimer+staggertime*1;
        document.getElementById("clock3text").innerHTML = setTimer+staggertime*2;
        document.getElementById("clock4text").innerHTML = setTimer+staggertime*3;
    }else{
    document.getElementById("clock1text").innerHTML = setTimer;
    document.getElementById("clock2text").innerHTML = setTimer;
    document.getElementById("clock3text").innerHTML = setTimer;
    document.getElementById("clock4text").innerHTML = setTimer;
    }

    document.getElementById("staggerButton").innerHTML = staggertime;
    totalSeconds = setTimer;
}

function substact10Seconds(){
    if (setTimer>10) {
        setTimer = setTimer-10
        updateDisplays();
    };
}

function add10Seconds(){
    if (setTimer<120) {
        setTimer = setTimer+10
        updateDisplays();
    };
    
}

function rest(){

    var minusButton = document.getElementById("minusButton");
    var plusButton = document.getElementById("plusButton");
    minusButton.disabled = false;
    plusButton.disabled = false;
    minusButton.style.opacity = "1";
    plusButton.style.opacity = "1";
    totalSeconds = setTimer;
    isRunning = false;
    updateDisplays()
    TimerID = 1;

    var resetButton = document.getElementById("resetButton");
    resetButton.style.opacity = "0";
    resetButton.disabled = true;

    document.getElementById("clock1").style.backgroundColor = "#FFDA14";
    document.getElementById("clock2").style.backgroundColor = "#FFDA14";
    document.getElementById("clock3").style.backgroundColor = "#FFDA14";
    document.getElementById("clock4").style.backgroundColor = "#FFDA14";

    var staggerButton = document.getElementById("staggerButton");
    staggerButton.style.opacity = "1";
    staggerButton.disabled = false;
    UseStartSound = true;
    
}

function staggerfunc() {

    staggertime = staggertime+5
    if (staggertime == 15){staggertime = 0}
    updateDisplays();

}

function startStop(){

    var minusButton = document.getElementById("minusButton");
    var plusButton = document.getElementById("plusButton");
    minusButton.disabled = true;
    plusButton.disabled = true;
    minusButton.style.opacity = "0.5";
    plusButton.style.opacity = "0.5";

    if (isRunning){

        clearInterval(countdownInterval);
        isRunning = false;
        
        var resetButton = document.getElementById("resetButton");
        resetButton.style.opacity = "1";
        resetButton.disabled = false;

        //Audio
        Sec2Audio.pause();
        Sec2Audio.currentTime = 0;
        Sec10Audio.pause();
        Sec10Audio.currentTime = 0;
        TurnEndAudio.pause();
        TurnEndAudio.currentTime = 0;
        TimerEndAudio.pause();
        TimerEndAudio.currentTime = 0;
        StartSound.pause();
        StartSound.currentTime = 0;

    }else{

        isRunning = true;

        var resetButton = document.getElementById("resetButton");
        resetButton.style.opacity = "0";
        resetButton.disabled = true;

        var staggerButton = document.getElementById("staggerButton");
        staggerButton.style.opacity = "0.5";
        staggerButton.disabled = true;

        var startStopButton = document.getElementById("StartStopButton");

        if(UseStartSound){
            StartSound.play();
            UseStartSound = false;
            startStopButton.disabled = true;

            setTimeout(() => {
                startCountdown()
                startStopButton.disabled = false;
              }, "2200"); //3300
        }else{
            startCountdown()
        }


    }
}

function updateClockDisplay(TimerID) {
    document.getElementById("clock"+TimerID+"text").innerHTML = totalSeconds
}

function startCountdown() {
    countdownInterval = setInterval(function() {

        if (totalSeconds == 10){
            //Timer Sound 10 second tick
            Sec10Audio.play();
        }

        if (totalSeconds == 4){
            //2 seconds remaining sound
            Sec2Audio.play();
        } 

        if (totalSeconds == 2){
            TurnEndAudio.play();
        } 

        totalSeconds--;
        updateClockDisplay(TimerID);

        if (totalSeconds <= 0) {

            document.getElementById("clock"+TimerID+"text").innerHTML = "-";

            if (TimerID<4){

                //Turn over sound
                //TurnEndAudio.play();

                document.getElementById("clock"+TimerID).style.backgroundColor = "red";
                TimerID++;

                if (stagger){
                    totalSeconds = (setTimer+staggertime*(TimerID-1));
                }else{
                    totalSeconds = setTimer;                    
                }

            }else{

                //Round over sound
                //TimerEndAudio.play();

                document.getElementById("clock"+TimerID).style.backgroundColor = "red";
                clearInterval(countdownInterval);

                var startStopButton = document.getElementById("StartStopButton");
                startStopButton.disabled = true;

                setTimeout(function() {
                    var minusButton = document.getElementById("minusButton");
                    var plusButton = document.getElementById("plusButton");
                    minusButton.disabled = false;
                    plusButton.disabled = false;
                    minusButton.style.opacity = "1";
                    plusButton.style.opacity = "1";
                    totalSeconds = setTimer;
                    isRunning = false;
                    updateDisplays()
                    TimerID = 1;

                    document.getElementById("clock1").style.backgroundColor = "#FFDA14";
                    document.getElementById("clock2").style.backgroundColor = "#FFDA14";
                    document.getElementById("clock3").style.backgroundColor = "#FFDA14";
                    document.getElementById("clock4").style.backgroundColor = "#FFDA14";

                    var staggerButton = document.getElementById("staggerButton");
                    staggerButton.style.opacity = "1";
                    staggerButton.disabled = false;

                    startStopButton.disabled = false;
                    UseStartSound = true;
                }, 5000);

            }
        }
    }, 1000);
}





/*
    timerBanner = document.getElementById("activeTimerlable").innerText;

    document.getElementById("activeTimerlable").innerHTML = "23"+"test";







document.addEventListener("DOMContentLoaded", function() {
    const clockDisplay = document.getElementById("clock");
    const startButton = document.getElementById("startButton");
    const resetButton = document.getElementById("resetButton");
    const minus20Button = document.getElementById("minus20Button");
    const minus10Button = document.getElementById("minus10Button");
    const plus20Button = document.getElementById("plus20Button");
    const plus10Button = document.getElementById("plus10Button");
    let countdownInterval;
    let totalSeconds = 6000;
    let isRunning = false;
    var audio = new Audio('alarm.mp3');

    function updateClockDisplay() {
        const minutes = Math.floor(totalSeconds / 6000).toString().padStart(2, "0");
        const seconds = Math.floor((totalSeconds % 6000) / 100).toString().padStart(2, "0");
        const milliseconds = (totalSeconds % 100).toString().padStart(2, "0");
        clockDisplay.textContent = `${minutes}:${seconds}:${milliseconds}`;
    }

    function startCountdown() {
        isRunning = true;
        startButton.disabled = true;
        resetButton.disabled = false;
        countdownInterval = setInterval(function() {
            totalSeconds--;
            updateClockDisplay();

            if (totalSeconds <= 3000) {
                clockDisplay.classList.add("red");
                if (totalSeconds <= 2000) {
                    minus20Button.disabled = true;
                    if (totalSeconds <= 1000) {
                        minus10Button.disabled = true;
                    }
                }
            }

            if (totalSeconds <= 0) {
                clearInterval(countdownInterval);
                isRunning = false;
                clockDisplay.textContent = "00:00:00";
                clockDisplay.classList.remove("red");
                resetButton.disabled = false;
                plus20Button.disabled = true;
                plus10Button.disabled = true;
                audio.play()
            }
        }, 10);
    }

    function resetCountdown() {
        clearInterval(countdownInterval);
        totalSeconds = 6000;
        updateClockDisplay();
        clockDisplay.classList.remove("red");
        startButton.disabled = false;
        resetButton.disabled = true;
        minus20Button.disabled = false;
        minus10Button.disabled = false;
        plus20Button.disabled = false;
        plus10Button.disabled = false;
        isRunning = false;
    }

    function minus20Seconds() {
        if (totalSeconds > 2000) {
            totalSeconds -= 2000;
            updateClockDisplay();
        }
    }

    function minus10Seconds() {
        if (totalSeconds > 1000) {
        totalSeconds -= 1000;
        updateClockDisplay();
        }
    }

    function plus20Seconds() {
        totalSeconds += 2000;
        updateClockDisplay();
        if (totalSeconds > 3000) {
            clockDisplay.classList.remove("red");
        }
        if (totalSeconds > 2000) {
            minus20Button.disabled = false;
        }
        if (totalSeconds > 1000) {
            minus10Button.disabled = false;
        }
    }

    function plus10Seconds() {
        totalSeconds += 1000;
        updateClockDisplay();
        if (totalSeconds > 3000) {
            clockDisplay.classList.remove("red");
        }
        if (totalSeconds > 2000) {
            minus20Button.disabled = false;
        }
        if (totalSeconds > 1000) {
            minus10Button.disabled = false;
        }
    }

    startButton.addEventListener("click", startCountdown);
    resetButton.addEventListener("click", resetCountdown);
    minus20Button.addEventListener("click", minus20Seconds);
    minus10Button.addEventListener("click", minus10Seconds);
    plus20Button.addEventListener("click", plus20Seconds);
    plus10Button.addEventListener("click", plus10Seconds);

});
*/

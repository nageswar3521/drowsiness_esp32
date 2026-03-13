import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

const { FaceLandmarker, FilesetResolver, DrawingUtils } = vision;

let faceLandmarker;
let runningMode = "IMAGE";
let webcamRunning = false;

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");

const statusText = document.getElementById("status");
const webcamButton = document.getElementById("webcamButton");

const videoWidth = 480;

/* drowsiness variables */

let drowsyFrames = 0;
const DROWSY_THRESHOLD = 0.23;
const FRAME_LIMIT = 15;

/* ESP32 IP */

const ESP32_IP = "http://192.168.1.50";

/* create model */

async function createFaceLandmarker(){

const filesetResolver =
await FilesetResolver.forVisionTasks(
"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
);

faceLandmarker =
await FaceLandmarker.createFromOptions(filesetResolver,{

baseOptions:{
modelAssetPath:
"https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
delegate:"GPU"
},

runningMode,
numFaces:1

});

}

createFaceLandmarker();

/* distance */

function distance(a,b){

return Math.sqrt(
Math.pow(a.x-b.x,2)+
Math.pow(a.y-b.y,2)
);

}

/* EAR */

function calculateEAR(eye){

const A = distance(eye[1],eye[5]);
const B = distance(eye[2],eye[4]);
const C = distance(eye[0],eye[3]);

return (A+B)/(2.0*C);

}

/* webcam */

webcamButton.addEventListener("click", enableCam);

function enableCam(){

if(webcamRunning){

webcamRunning=false;
webcamButton.innerText="Enable Camera";

}else{

webcamRunning=true;
webcamButton.innerText="Disable Camera";

navigator.mediaDevices.getUserMedia({video:true})
.then(function(stream){

video.srcObject=stream;
video.addEventListener("loadeddata", predictWebcam);

});

}

}

/* send command to ESP32 */

function sendESP32(status){

fetch(`${ESP32_IP}/${status}`)
.catch(err=>console.log(err));

}

/* prediction */

let lastVideoTime = -1;

const drawingUtils = new DrawingUtils(canvasCtx);

async function predictWebcam(){

const ratio = video.videoHeight/video.videoWidth;

video.style.width = videoWidth+"px";
video.style.height = videoWidth*ratio+"px";

canvasElement.width = video.videoWidth;
canvasElement.height = video.videoHeight;

if(runningMode==="IMAGE"){

runningMode="VIDEO";
await faceLandmarker.setOptions({runningMode:"VIDEO"});

}

let startTimeMs = performance.now();

if(lastVideoTime!==video.currentTime){

lastVideoTime=video.currentTime;

const results =
faceLandmarker.detectForVideo(video,startTimeMs);

canvasCtx.clearRect(0,0,canvasElement.width,canvasElement.height);

if(results.faceLandmarks){

const landmarks = results.faceLandmarks[0];

/* draw mesh */

drawingUtils.drawConnectors(
landmarks,
FaceLandmarker.FACE_LANDMARKS_TESSELATION,
{color:"#C0C0C070",lineWidth:1}
);

/* eye landmarks */

const leftEye=[

landmarks[33],
landmarks[160],
landmarks[158],
landmarks[133],
landmarks[153],
landmarks[144]

];

const rightEye=[

landmarks[362],
landmarks[385],
landmarks[387],
landmarks[263],
landmarks[373],
landmarks[380]

];

/* EAR */

const leftEAR = calculateEAR(leftEye);
const rightEAR = calculateEAR(rightEye);

const ear = (leftEAR+rightEAR)/2;

console.log("EAR:",ear);

/* drowsiness logic */

if(ear < DROWSY_THRESHOLD){

drowsyFrames++;

if(drowsyFrames > FRAME_LIMIT){

statusText.innerText="STATUS : DROWSY";
statusText.style.color="red";

sendESP32("drowsy");

}

}else{

drowsyFrames=0;

statusText.innerText="STATUS : ALERT";
statusText.style.color="lime";

sendESP32("alert");

}

}

}

if(webcamRunning){

window.requestAnimationFrame(predictWebcam);

}

}
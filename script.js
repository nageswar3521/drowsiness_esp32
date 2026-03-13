import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

const { FaceLandmarker, FilesetResolver, DrawingUtils } = vision;

let faceLandmarker;
let runningMode = "VIDEO";
let webcamRunning = false;

const video = document.getElementById("webcam");
const canvas = document.getElementById("output_canvas");
const ctx = canvas.getContext("2d");

const statusText = document.getElementById("status");
const button = document.getElementById("webcamButton");

const ESP32_IP = "http://192.168.29.119";

let drowsyFrames = 0;
const EAR_THRESHOLD = 0.23;
const FRAME_LIMIT = 15;

/* Load Mediapipe model */

async function initModel(){

const resolver = await FilesetResolver.forVisionTasks(
"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
);

faceLandmarker = await FaceLandmarker.createFromOptions(resolver,{
baseOptions:{
modelAssetPath:
"https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
},
runningMode:"VIDEO",
numFaces:1
});

}

initModel();

/* Distance */

function dist(a,b){
return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);
}

/* Eye Aspect Ratio */

function EAR(eye){
const A = dist(eye[1],eye[5]);
const B = dist(eye[2],eye[4]);
const C = dist(eye[0],eye[3]);
return (A+B)/(2*C);
}

/* Enable camera */

button.onclick = async function(){

if(webcamRunning){
webcamRunning=false;
button.innerText="Enable Camera";
return;
}

const stream = await navigator.mediaDevices.getUserMedia({video:true});
video.srcObject = stream;

webcamRunning=true;
button.innerText="Disable Camera";

video.onloadeddata = detect;

};

/* Send command to ESP32 */

function sendESP32(state){
fetch(`${ESP32_IP}/${state}`).catch(()=>{});
}

/* Detection loop */

const draw = new DrawingUtils(ctx);

async function detect(){

if(!webcamRunning) return;

canvas.width = video.videoWidth;
canvas.height = video.videoHeight;

const results = faceLandmarker.detectForVideo(video, performance.now());

ctx.clearRect(0,0,canvas.width,canvas.height);

if(results.faceLandmarks.length){

const landmarks = results.faceLandmarks[0];

/* mirror drawing */

ctx.save();
ctx.scale(-1,1);
ctx.translate(-canvas.width,0);

draw.drawConnectors(
landmarks,
FaceLandmarker.FACE_LANDMARKS_TESSELATION,
{color:"#C0C0C070",lineWidth:1}
);

ctx.restore();

/* eye points */

const leftEye = [
landmarks[33],landmarks[160],landmarks[158],
landmarks[133],landmarks[153],landmarks[144]
];

const rightEye = [
landmarks[362],landmarks[385],landmarks[387],
landmarks[263],landmarks[373],landmarks[380]
];

const ear = (EAR(leftEye)+EAR(rightEye))/2;

if(ear < EAR_THRESHOLD){

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

requestAnimationFrame(detect);

}

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const scaleCanvas = document.getElementById('scaleCanvas');
const scaleCtx = scaleCanvas.getContext('2d');
const backend = document.getElementById('backend');
const wasm = document.getElementById('wasm');
const webgl = document.getElementById('webgl');
const webml = document.getElementById('webml');
let currentBackend = '';

guiState.scoreThreshold = 0.15;

const util = new Utils();
const videoWidth = 500;
const videoHeight = 500;
const inputSize = [1, videoWidth, videoHeight, 3];
const algorithm = gui.add(guiState, 'algorithm', ['single-pose', 'multi-pose']);
let isMultiple = guiState.algorithm;
let streaming  = false;	
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
  throw new Error(
    'Browser API navigator.mediaDevices.getUserMedia not available');
}
let stats = new Stats();
stats.dom.style.cssText = 'position:fixed;top:100px;left:10px;cursor:pointer;opacity:0.9;z-index:999';
stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild(stats.dom);
const mobile = isMobile();

algorithm.onChange((algorithm) => {
  guiState.algorithm = algorithm;
});
scoreThreshold.onChange((scoreThreshold) => {
  guiState.scoreThreshold = scoreThreshold;
  util._minScore = guiState.scoreThreshold;
});
nmsRadius.onChange((nmsRadius) => {
  guiState.multiPoseDetection.nmsRadius = nmsRadius;
  util._nmsRadius = guiState.multiPoseDetection.nmsRadius;
});
maxDetections.onChange((maxDetections) => {
  guiState.multiPoseDetection.maxDetections = maxDetections;
  util._maxDetection = guiState.multiPoseDetection.maxDetections;
});
model.onChange((model) => {
  guiState.model = model;
  util._version = guiState.model;
  detectPoseInRealTime(video);
});
outputStride.onChange((outputStride) => {
  guiState.outputStride = outputStride;
  util._outputStride = guiState.outputStride;
  detectPoseInRealTime(video);
});
scaleFactor.onChange((scaleFactor) => {
  guiState.scaleFactor = scaleFactor;
  util._scaleFactor = guiState.scaleFactor;
  detectPoseInRealTime(video);
});
showPose.onChange((showPose) => {
  guiState.showPose = showPose;
});
showBoundingBox.onChange((showBoundingBox) => {
  guiState.showBoundingBox = showBoundingBox;
});

function updateBackend() {
  currentBackend = util.model._backend;
  if (getUrlParams('api_info') === 'true') {
    backend.innerHTML = currentBackend === 'WebML' ? currentBackend + '/' + getNativeAPI() : currentBackend;
  } else {
    backend.innerHTML = currentBackend;
  }
}

function changeBackend(newBackend) {
  if (currentBackend === newBackend) {
    return;
  }
  backend.innerHTML = 'Setting...';
  setTimeout(() => {
    util.init(newBackend, inputSize).then(() => {
      updateBackend();
    });
  }, 10);
}

async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    'audio': false,
    'video': {facingMode: 'user'},
  });
  video.srcObject = stream;
  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      resolve(video);
    }
  });
}

async function loadVideo() {
  const videoElement = await setupCamera();
  videoElement.play();
  return videoElement;
}

async function detectPoseInRealTime(video) {
  if (nnNative) {
    webml.setAttribute('class', 'dropdown-item');
    webml.onclick = function (e) {
      removeAlertElement();
      checkPreferParam();
      changeBackend('WebML');
    }
  }

  if (nnPolyfill.supportWebGL2) {
    webgl.setAttribute('class', 'dropdown-item');
    webgl.onclick = function(e) {
      removeAlertElement();
      changeBackend('WebGL2');
    }
  }

  if (nnPolyfill.supportWasm) {
    wasm.setAttribute('class', 'dropdown-item');
    wasm.onclick = function(e) {
      removeAlertElement();
      changeBackend('WASM');
    }
  }

  if (currentBackend == '') {
    util.init(undefined, inputSize).then(() => {
      updateBackend();
      poseDetectionFrame();
    }).catch((e) => {
      console.warn(`Failed to init ${util.model._backend}, try to use WASM`);
      console.error(e);
      showAlert(util.model._backend);
      changeBackend('WASM');
    });
  } else {
    util.init(currentBackend, inputSize).then(() => {
      updateBackend();
    }).catch((e) => {
      console.warn(`Failed to init ${util.model._backend}, try to use WASM`);
      console.error(e);
      showAlert(util.model._backend);
      changeBackend('WASM');
    });
  }
}

function checkPreferParam() {
  if (getOS() === 'Mac OS') {
    let preferValue = getPreferParam();
    if (preferValue === 'invalid') {
      console.log("Invalid prefer, prefer should be 'fast' or 'sustained', try to use WASM.");
      showPreferAlert();
    }
  }
}

function showAlert(backend) {
  let div = document.createElement('div');
  div.setAttribute('id', 'backendAlert');
  div.setAttribute('class', 'alert alert-warning alert-dismissible fade show');
  div.setAttribute('role', 'alert');
  div.innerHTML = `<strong>Failed to setup ${backend} backend.</strong>`;
  div.innerHTML += `<button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>`;
  let container = document.getElementById('container');
  container.insertBefore(div, container.firstElementChild);
}

function showPreferAlert() {
  let div = document.createElement('div');
  div.setAttribute('id', 'preferAlert');
  div.setAttribute('class', 'alert alert-danger alert-dismissible fade show');
  div.setAttribute('role', 'alert');
  div.innerHTML = `<strong>Invalid prefer, prefer should be 'fast' or 'sustained'.</strong>`;
  div.innerHTML += `<button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>`;
  let container = document.getElementById('container');
  container.insertBefore(div, container.firstElementChild);
}

function removeAlertElement() {
  let backendAlertElem =  document.getElementById('backendAlert');
  if (backendAlertElem !== null) {
    backendAlertElem.remove();
  }
  let preferAlertElem =  document.getElementById('preferAlert');
  if (preferAlertElem !== null) {
    preferAlertElem.remove();
  }
}

async function main() {
  checkPreferParam();
  let videoSource = await loadVideo();
  detectPoseInRealTime(videoSource);
}
  
function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

function isiOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isMobile() {
  return isAndroid() || isiOS();
}

function drawVideo(video, canvas, w, h) {
  const ctx = canvas.getContext('2d');
  canvas.width = w;
  canvas.height = h;
  canvas.setAttribute("width", w);
  canvas.setAttribute("height", h);
  ctx.save();
  ctx.scale(-1, 1);
  ctx.translate(-w, 0);
  ctx.drawImage(video, 0, 0, w, h);
  ctx.restore();
}

async function poseDetectionFrame() {
  await predict(video);
  setTimeout(poseDetectionFrame, 0);
}

async function predict(video) {
  isMultiple = guiState.algorithm;
  stats.begin();
  let type = isMultiple == 'multi-pose' ? 'multi' : 'single';
  drawVideo(video, scaleCanvas, util.scaleWidth, util.scaleHeight);
  let poses = await util.predict(scaleCanvas, type);
  stats.end();
  drawVideo(video, canvas, video.videoWidth, video.videoHeight);
  util.drawPoses(canvas, poses);
}

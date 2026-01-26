const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const loadingOverlay = document.getElementById('loading-overlay');
const fpsDisplay = document.getElementById('fps');
const objCountDisplay = document.getElementById('obj-count');

let model = null;
let isModelLoaded = false;
let lastFrameTime = 0;

// 1. Camera Setup
async function setupCamera() {
    const constraints = {
        audio: false,
        video: {
            facingMode: 'environment', // Use back camera on mobile
            width: { ideal: 640 },
            height: { ideal: 480 }
        }
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;

        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                resolve(video);
            };
        });
    } catch (err) {
        console.error('Error accessing camera:', err);
        alert('Camera access denied or not available.');
    }
}

// 2. Model Loading
async function loadModel() {
    try {
        // Load the COCO-SSD model. 
        // In a real app, you would swap this with:
        // model = await tf.loadGraphModel('path/to/your/custom/model.json');
        model = await cocoSsd.load();
        isModelLoaded = true;
        loadingOverlay.style.display = 'none';
        console.log('Model loaded successfully');
    } catch (err) {
        console.error('Failed to load model:', err);
        alert('Failed to load model.');
    }
}

// 3. Inference Loop
async function detectFrame() {
    if (!isModelLoaded) return;

    // Wait for video to be ready
    if (video.readyState < 2) {
        requestAnimationFrame(detectFrame);
        return;
    }

    // Calculate FPS
    const now = performance.now();
    const fps = 1000 / (now - lastFrameTime);
    lastFrameTime = now;
    fpsDisplay.innerText = fps.toFixed(1);

    // Run detection
    // The model returns an array of objects: { class, score, bbox: [x, y, width, height] }
    const predictions = await model.detect(video);

    objCountDisplay.innerText = predictions.length;

    // Draw
    renderPredictions(predictions);

    // Loop
    requestAnimationFrame(detectFrame);
}

// 4. Drawing Logic
function renderPredictions(predictions) {
    // Check if canvas size needs update
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.font = '16px sans-serif';
        ctx.textBaseline = 'top';
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    predictions.forEach(prediction => {
        const [x, y, width, height] = prediction.bbox;
        const score = Math.round(prediction.score * 100);
        const label = `${prediction.class} (${score}%)`;

        // Draw Bounding Box
        ctx.strokeStyle = '#00FFFF';
        ctx.lineWidth = 4;
        ctx.strokeRect(x, y, width, height);

        // Draw Label Background
        const textWidth = ctx.measureText(label).width;
        const textHeight = 16;
        ctx.fillStyle = '#00FFFF';
        ctx.fillRect(x, y, textWidth + 4, textHeight + 4);

        // Draw Label Text
        ctx.fillStyle = '#000000';
        ctx.fillText(label, x + 2, y + 2);
    });
}

// 5. Initialization
async function init() {
    await setupCamera();
    video.play();
    await loadModel();
    detectFrame();
}

init();

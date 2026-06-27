const MODEL_URLS = [
  './models',
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model',
];

const emojiMap = {
  happy: { emoji: '😄', label: 'Happy', hint: 'Smile naturally.' },
  laughing: { emoji: '😂', label: 'Laughing', hint: 'Try a wide, open smile.' },
  surprised: { emoji: '😮', label: 'Surprised', hint: 'Open your mouth or raise your brows.' },
  shocked: { emoji: '😱', label: 'Shocked', hint: 'Make a bigger surprised face.' },
  sad: { emoji: '😢', label: 'Sad', hint: 'Frown slightly.' },
  angry: { emoji: '😠', label: 'Angry', hint: 'Furrow your eyebrows.' },
  neutral: { emoji: '😐', label: 'Neutral', hint: 'Relax your face.' },
  thinking: { emoji: '🤔', label: 'Thinking', hint: 'Try a puzzled or skeptical face.' },
  sleepy: { emoji: '😴', label: 'Sleepy', hint: 'Try lowered eyelids or a tired face.' },
  cool: { emoji: '😎', label: 'Cool', hint: 'Use the button for a confident pose.' },
};

const video = document.querySelector('#video');
const stage = document.querySelector('#stage');
const overlayLayer = document.querySelector('#overlayLayer');
const statusText = document.querySelector('#status');
const cameraPlaceholder = document.querySelector('#cameraPlaceholder');
const startButton = document.querySelector('#startButton');
const stopButton = document.querySelector('#stopButton');
const captureButton = document.querySelector('#captureButton');
const snapshotCanvas = document.querySelector('#snapshotCanvas');
const currentEmoji = document.querySelector('#currentEmoji');
const currentLabel = document.querySelector('#currentLabel');
const currentHint = document.querySelector('#currentHint');
const historyList = document.querySelector('#historyList');
const clearHistoryButton = document.querySelector('#clearHistoryButton');
const guideList = document.querySelector('#guideList');
const messagePreview = document.querySelector('#messagePreview');
const addCurrentButton = document.querySelector('#addCurrentButton');
const copyMessageButton = document.querySelector('#copyMessageButton');
const clearMessageButton = document.querySelector('#clearMessageButton');
const backspaceMessageButton = document.querySelector('#backspaceMessageButton');
const toast = document.querySelector('#toast');

let detectorReady = false;
let cameraReady = false;
let detectTimer = null;
let activeKey = 'neutral';
let lastRecordedKey = '';
let stableKey = 'neutral';
let stableCount = 0;
let stream = null;
let lastDetectedFaces = [];
const history = [];
const messageEmojis = [];

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 1600);
}

function setStatus(message, isWaiting = false) {
  statusText.textContent = message;
  overlayLayer.classList.toggle('is-hidden', isWaiting);
}

function setActiveEmoji(key, shouldRecord = true, shouldAddToMessage = false) {
  const data = emojiMap[key] || emojiMap.neutral;
  activeKey = key in emojiMap ? key : 'neutral';
  currentEmoji.textContent = data.emoji;
  currentLabel.textContent = data.label;
  currentHint.textContent = data.hint;

  if (shouldRecord && activeKey !== lastRecordedKey) {
    addHistory(activeKey);
    lastRecordedKey = activeKey;
  }

  if (shouldAddToMessage) {
    addToMessage(activeKey);
  }

  renderHistory();
}

function addHistory(key) {
  history.unshift({
    key,
    time: new Date(),
  });

  if (history.length > 18) {
    history.pop();
  }
}

function renderHistory() {
  if (!history.length) {
    historyList.innerHTML = '<p class="empty">No emojis recognized yet.</p>';
    return;
  }

  historyList.innerHTML = history.map((entry, index) => {
    const data = emojiMap[entry.key];
    const active = entry.key === activeKey ? ' active' : '';
    return `
      <div class="history-item${active}">
        <div class="item-emoji">${data.emoji}</div>
        <div>
          <div class="item-title">${data.label}</div>
          <div class="item-subtitle">${entry.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
        </div>
        <button class="item-copy" data-copy-index="${index}" aria-label="Copy ${data.label} emoji">Copy</button>
      </div>
    `;
  }).join('');
}

function renderGuide() {
  guideList.innerHTML = Object.values(emojiMap).map((item) => `
    <div class="guide-item">
      <div class="item-emoji">${item.emoji}</div>
      <div>
        <div class="item-title">${item.label}</div>
        <div class="item-subtitle">${item.hint}</div>
      </div>
    </div>
  `).join('');
}

function renderMessage() {
  if (!messageEmojis.length) {
    messagePreview.textContent = 'Build your emoji message here.';
    messagePreview.classList.remove('has-content');
    return;
  }

  messagePreview.textContent = messageEmojis.join('');
  messagePreview.classList.add('has-content');
}

function addToMessage(key) {
  const data = emojiMap[key] || emojiMap.neutral;
  messageEmojis.push(data.emoji);
  renderMessage();
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`Copied ${text}`);
  } catch {
    showToast('Copy was blocked by the browser.');
  }
}

async function loadDetector() {
  if (detectorReady) return true;
  if (!window.faceapi) {
    throw new Error('Face detector script did not load. Check the local vendor files.');
  }

  setStatus('Loading face detector...', true);
  let lastError = null;
  for (const modelUrl of MODEL_URLS) {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl),
        faceapi.nets.faceExpressionNet.loadFromUri(modelUrl),
      ]);
      detectorReady = true;
      return true;
    } catch (error) {
      lastError = error;
      console.warn(`Could not load face detector models from ${modelUrl}`, error);
    }
  }
  throw lastError || new Error('Face detector models did not load.');
}

async function startCamera() {
  startButton.disabled = true;
  setStatus('Loading face detector...', true);

  try {
    await loadDetector();
  } catch (error) {
    console.error(error);
    detectorReady = false;
    setStatus('Face detector files could not load. Check your connection or local model files; manual buttons still work.', true);
  }

  try {
    setStatus('Requesting camera...', true);

    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });

    video.srcObject = stream;
    await video.play();
    cameraReady = true;
    video.classList.add('is-on');
    cameraPlaceholder.classList.add('is-hidden');
    stopButton.disabled = false;
    captureButton.disabled = false;
    startButton.textContent = 'Camera on';
    setStatus(detectorReady ? 'Looking for a face...' : 'Manual mode ready.', !detectorReady);

    if (detectorReady) {
      startDetectionLoop();
    }
  } catch (error) {
    console.error(error);
    startButton.disabled = false;
    setStatus('Camera blocked or unavailable. Use the emoji buttons below.', true);
  }
}

function stopCamera() {
  window.clearInterval(detectTimer);
  detectTimer = null;
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
  stream = null;
  video.srcObject = null;
  video.classList.remove('is-on');
  cameraPlaceholder.classList.remove('is-hidden');
  renderFaceOverlays([]);
  lastDetectedFaces = [];
  cameraReady = false;
  startButton.disabled = false;
  stopButton.disabled = true;
  captureButton.disabled = true;
  startButton.textContent = 'Start';
  setStatus('Camera is off.', true);
}

function videoCoverMetrics(targetWidth = video.clientWidth, targetHeight = video.clientHeight) {
  const sourceWidth = video.videoWidth || targetWidth || 1;
  const sourceHeight = video.videoHeight || targetHeight || 1;
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  let renderedWidth = targetWidth;
  let renderedHeight = targetHeight;
  let offsetX = 0;
  let offsetY = 0;

  if (targetRatio > sourceRatio) {
    renderedHeight = targetWidth / sourceRatio;
    offsetY = (targetHeight - renderedHeight) / 2;
  } else {
    renderedWidth = targetHeight * sourceRatio;
    offsetX = (targetWidth - renderedWidth) / 2;
  }

  return {
    sourceWidth,
    sourceHeight,
    renderedWidth,
    renderedHeight,
    offsetX,
    offsetY,
    scaleX: renderedWidth / sourceWidth,
    scaleY: renderedHeight / sourceHeight,
  };
}

function videoSourceCrop(targetWidth, targetHeight) {
  const sourceWidth = video.videoWidth || 1;
  const sourceHeight = video.videoHeight || 1;
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  let sx = 0;
  let sy = 0;
  let sw = sourceWidth;
  let sh = sourceHeight;

  if (targetRatio > sourceRatio) {
    sh = sourceWidth / targetRatio;
    sy = (sourceHeight - sh) / 2;
  } else {
    sw = sourceHeight * targetRatio;
    sx = (sourceWidth - sw) / 2;
  }

  return { sx, sy, sw, sh };
}

function expressionToEmoji(expressions) {
  const sorted = Object.entries(expressions).sort((a, b) => b[1] - a[1]);
  const [top, score] = sorted[0] || ['neutral', 0];
  const happy = expressions.happy || 0;
  const surprised = expressions.surprised || 0;
  const sad = expressions.sad || 0;
  const angry = expressions.angry || 0;
  const fearful = expressions.fearful || 0;
  const disgusted = expressions.disgusted || 0;
  const neutral = expressions.neutral || 0;

  if (happy > 0.72) return 'laughing';
  if (happy > 0.38) return 'happy';
  if (surprised > 0.68 || fearful > 0.54) return 'shocked';
  if (surprised > 0.34) return 'surprised';
  if (angry > 0.32) return 'angry';
  if (sad > 0.28) return 'sad';
  if (disgusted > 0.25) return 'thinking';
  if (neutral > 0.74 && score < 0.86) return 'sleepy';
  if (score < 0.25 || top === 'neutral') return 'neutral';
  return emojiMap[top] ? top : 'neutral';
}

function stabilizeKey(nextKey) {
  if (nextKey === stableKey) {
    stableCount += 1;
  } else {
    stableKey = nextKey;
    stableCount = 1;
  }

  return stableCount >= 2 ? stableKey : activeKey;
}

function boxToStagePosition(box) {
  const videoRect = video.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  const metrics = videoCoverMetrics(videoRect.width, videoRect.height);
  const centerX = videoRect.left - stageRect.left + metrics.offsetX + metrics.renderedWidth - ((box.x + box.width / 2) * metrics.scaleX);
  const centerY = videoRect.top - stageRect.top + metrics.offsetY + ((box.y + box.height / 2) * metrics.scaleY);
  const size = Math.max(96, Math.min(260, Math.max(box.width * metrics.scaleX, box.height * metrics.scaleY) * 1.25));
  return { centerX, centerY, size };
}

function renderFaceOverlays(faces) {
  overlayLayer.innerHTML = faces.map(({ box, key }, index) => {
    const { centerX, centerY, size } = boxToStagePosition(box);
    const data = emojiMap[key] || emojiMap.neutral;
    return `
      <div class="emoji-overlay" style="left:${centerX}px;top:${centerY}px;width:${size}px;height:${size}px;font-size:${size * 0.72}px" aria-label="Face ${index + 1}: ${data.label}">
        ${data.emoji}
      </div>
    `;
  }).join('');
}

function startDetectionLoop() {
  window.clearInterval(detectTimer);
  detectTimer = window.setInterval(async () => {
    if (!cameraReady || video.paused || video.videoWidth === 0) return;

    const results = await faceapi
      .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 }))
      .withFaceExpressions();

    if (!results.length) {
      renderFaceOverlays([]);
      lastDetectedFaces = [];
      setStatus('Looking for a face...', true);
      return;
    }

    const faces = results
      .slice(0, 6)
      .map((result) => ({ box: result.detection.box, key: expressionToEmoji(result.expressions) }));
    const primaryKey = stabilizeKey(faces[0].key);
    faces[0].key = primaryKey;
    renderFaceOverlays(faces);
    lastDetectedFaces = faces;
    setActiveEmoji(primaryKey, true);
    setStatus(`${faces.length} ${faces.length === 1 ? 'face' : 'faces'} detected`, false);
  }, 220);
}

function captureImage() {
  if (!cameraReady || video.videoWidth === 0) {
    showToast('Start the camera first.');
    return;
  }

  const canvas = snapshotCanvas;
  const context = canvas.getContext('2d');
  const stageRect = stage.getBoundingClientRect();
  canvas.width = Math.round(stageRect.width || video.videoWidth);
  canvas.height = Math.round(stageRect.height || video.videoHeight);
  const crop = videoSourceCrop(canvas.width, canvas.height);

  context.save();
  context.translate(canvas.width, 0);
  context.scale(-1, 1);
  context.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);
  context.restore();

  context.textAlign = 'center';
  context.textBaseline = 'middle';
  const faces = lastDetectedFaces.length ? lastDetectedFaces : [{ box: null, key: activeKey }];
  faces.forEach(({ box, key }) => {
    const centerX = box ? ((box.x + box.width / 2 - crop.sx) / crop.sw) * canvas.width : canvas.width / 2;
    const centerY = box ? ((box.y + box.height / 2 - crop.sy) / crop.sh) * canvas.height : canvas.height / 2;
    const emojiSize = box
      ? Math.max(90, Math.min(260, Math.max((box.width / crop.sw) * canvas.width, (box.height / crop.sh) * canvas.height) * 0.9))
      : Math.max(90, Math.round(canvas.width * 0.18));
    context.font = `${emojiSize}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    context.fillText(emojiMap[key].emoji, canvas.width - centerX, centerY);
  });

  const link = document.createElement('a');
  link.download = `emoji-camera-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('Screenshot saved.');
}

startButton.addEventListener('click', startCamera);
stopButton.addEventListener('click', stopCamera);
captureButton.addEventListener('click', captureImage);

document.querySelectorAll('[data-manual]').forEach((button) => {
  button.addEventListener('click', () => {
    const key = button.dataset.manual;
    setActiveEmoji(key, true, true);
    setStatus(`${emojiMap[key].label} added`, false);
  });
});

historyList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-copy-index]');
  if (!button) return;
  const entry = history[Number(button.dataset.copyIndex)];
  if (entry) copyText(emojiMap[entry.key].emoji);
});

addCurrentButton.addEventListener('click', () => {
  addToMessage(activeKey);
  showToast(`Added ${emojiMap[activeKey].emoji}`);
});

copyMessageButton.addEventListener('click', () => {
  if (!messageEmojis.length) {
    showToast('Add emojis first.');
    return;
  }
  copyText(messageEmojis.join(''));
});

backspaceMessageButton.addEventListener('click', () => {
  messageEmojis.pop();
  renderMessage();
});

clearMessageButton.addEventListener('click', () => {
  messageEmojis.length = 0;
  renderMessage();
});

clearHistoryButton.addEventListener('click', () => {
  history.length = 0;
  lastRecordedKey = '';
  renderHistory();
  showToast('History cleared.');
});

window.addEventListener('beforeunload', stopCamera);

renderGuide();
renderHistory();
renderMessage();

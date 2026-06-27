const MODEL_URLS = [
  './models',
  'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model',
];
const LEARNING_KEY = 'emoji-camera.expression-learning.v1';
const EXPRESSION_KEYS = ['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'neutral'];
const LEARNABLE_KEYS = ['happy', 'laughing', 'surprised', 'shocked', 'sad', 'angry', 'neutral', 'thinking', 'sleepy', 'cool'];

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
const feedbackCard = document.querySelector('#feedbackCard');
const feedbackTitle = document.querySelector('#feedbackTitle');
const feedbackYesButton = document.querySelector('#feedbackYesButton');
const feedbackNoButton = document.querySelector('#feedbackNoButton');
const correctionForm = document.querySelector('#correctionForm');
const correctionSelect = document.querySelector('#correctionSelect');
const saveCorrectionButton = document.querySelector('#saveCorrectionButton');
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
let lastExpressionSignature = null;
let lastFeedbackKey = '';
let lastFeedbackTime = 0;
let lastFeedbackSignature = null;
let pendingFeedback = null;
let learnedSamples = loadLearning();
let motionCanvas = document.createElement('canvas');
let motionContext = motionCanvas.getContext('2d', { willReadFrequently: true });
let previousMotionFrame = null;
let lastHandKey = '';
let lastHandTime = 0;
const history = [];
const messageEmojis = [];

function loadLearning() {
  try {
    const samples = JSON.parse(localStorage.getItem(LEARNING_KEY) || '[]');
    return Array.isArray(samples) ? samples.filter((item) => item && item.key && Array.isArray(item.signature)).slice(-80) : [];
  } catch {
    return [];
  }
}

function saveLearning() {
  localStorage.setItem(LEARNING_KEY, JSON.stringify(learnedSamples.slice(-80)));
}

async function loadGlobalLearning() {
  try {
    const response = await fetch('/api/learning', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.samples)) return;
    const globalSamples = data.samples.filter((item) => item && item.key && Array.isArray(item.signature));
    learnedSamples = mergeLearningSamples([...learnedSamples, ...globalSamples]).slice(-200);
    saveLearning();
  } catch {
    // Local learning remains available if the global backend is offline.
  }
}

function mergeLearningSamples(samples) {
  const seen = new Set();
  return samples.filter((sample) => {
    const marker = `${sample.key}:${(sample.signature || []).join(',')}:${sample.confirmed ? 1 : 0}`;
    if (seen.has(marker)) return false;
    seen.add(marker);
    return true;
  });
}

async function saveGlobalLearning(sample) {
  try {
    await fetch('/api/learning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sample),
    });
  } catch {
    // The sample is already saved locally, so the app can still learn offline.
  }
}

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

function setDetectedEmoji(key, signature) {
  setActiveEmoji(key, true);
  showFeedback(key, signature, true);
}

function addHistory(key) {
  history.unshift({
    key,
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

function renderCorrectionOptions() {
  correctionSelect.innerHTML = LEARNABLE_KEYS.map((key) => {
    const data = emojiMap[key];
    return `<option value="${key}">${data.emoji} ${data.label}</option>`;
  }).join('');
}

function expressionSignature(expressions = {}) {
  return EXPRESSION_KEYS.map((key) => Math.round((expressions[key] || 0) * 1000) / 1000);
}

function signatureDistance(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return Number.POSITIVE_INFINITY;
  const total = a.reduce((sum, value, index) => {
    const diff = value - b[index];
    return sum + diff * diff;
  }, 0);
  return Math.sqrt(total);
}

function learnedEmojiFor(expressions, fallbackKey) {
  const signature = expressionSignature(expressions);
  let best = null;
  learnedSamples.forEach((sample) => {
    const distance = signatureDistance(signature, sample.signature);
    if (!best || distance < best.distance) best = { ...sample, distance };
  });

  if (best && best.distance < 0.34) {
    return best.key;
  }

  return fallbackKey;
}

function rememberExpression(signature, key, confirmed = false) {
  if (!signature || !emojiMap[key]) return;
  const sample = {
    key,
    signature,
    confirmed,
    time: Date.now(),
  };
  learnedSamples.push(sample);
  learnedSamples = learnedSamples.slice(-80);
  saveLearning();
  saveGlobalLearning(sample);
}

function showFeedback(key, signature, force = false) {
  if (!signature || !feedbackCard) return;
  const repeatedSoon = key === lastFeedbackKey
    && Date.now() - lastFeedbackTime < 9000
    && signatureDistance(signature, lastFeedbackSignature) < 0.18;
  if (!force && (repeatedSoon || pendingFeedback)) return;
  const data = emojiMap[key] || emojiMap.neutral;
  pendingFeedback = { key, signature };
  lastFeedbackKey = key;
  lastFeedbackTime = Date.now();
  lastFeedbackSignature = signature;
  correctionSelect.value = key;
  feedbackTitle.textContent = `Was ${data.emoji} ${data.label} right?`;
  correctionForm.classList.add('is-hidden');
  feedbackCard.classList.remove('is-hidden');
}

function hideFeedback() {
  pendingFeedback = null;
  correctionForm.classList.add('is-hidden');
  feedbackCard.classList.add('is-hidden');
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

function baseExpressionToEmoji(expressions) {
  const sorted = Object.entries(expressions).sort((a, b) => b[1] - a[1]);
  const [top, score] = sorted[0] || ['neutral', 0];
  const happy = expressions.happy || 0;
  const surprised = expressions.surprised || 0;
  const sad = expressions.sad || 0;
  const angry = expressions.angry || 0;
  const fearful = expressions.fearful || 0;
  const disgusted = expressions.disgusted || 0;
  const neutral = expressions.neutral || 0;

  const expressive = [
    ['happy', happy],
    ['surprised', surprised],
    ['angry', angry],
    ['sad', sad],
    ['fearful', fearful],
    ['disgusted', disgusted],
  ].sort((a, b) => b[1] - a[1]);
  const [bestExpression, bestScore] = expressive[0] || ['neutral', 0];
  const neutralLead = neutral - bestScore;
  const expressiveTotal = happy + surprised + sad + angry + fearful + disgusted;

  if (happy > 0.54) return 'laughing';
  if (happy > 0.11 && neutralLead < 0.82) return 'happy';
  if (surprised > 0.42 || fearful > 0.38) return 'shocked';
  if ((surprised > 0.09 || fearful > 0.14) && neutralLead < 0.84) return 'surprised';
  if (angry > 0.09 && neutralLead < 0.84) return 'angry';
  if (sad > 0.09 && neutralLead < 0.84) return 'sad';
  if (disgusted > 0.08 && neutralLead < 0.84) return 'thinking';
  if (bestScore > 0.14 && bestExpression !== 'neutral' && neutralLead < 0.88) {
    return bestExpression === 'fearful' ? 'shocked' : bestExpression === 'disgusted' ? 'thinking' : bestExpression;
  }
  if (neutral > 0.58 && neutral < 0.9 && expressiveTotal > 0.08 && bestScore < 0.13) return 'sleepy';
  if (score < 0.16 || top === 'neutral') return 'neutral';
  return emojiMap[top] ? top : 'neutral';
}

function expressionToEmoji(expressions) {
  const baseKey = baseExpressionToEmoji(expressions);
  return learnedEmojiFor(expressions, baseKey);
}

function detectHandMovement() {
  if (!cameraReady || !motionContext || video.videoWidth === 0) return null;
  const width = 96;
  const height = 54;
  if (motionCanvas.width !== width || motionCanvas.height !== height) {
    motionCanvas.width = width;
    motionCanvas.height = height;
    previousMotionFrame = null;
  }

  motionContext.save();
  motionContext.scale(-1, 1);
  motionContext.drawImage(video, -width, 0, width, height);
  motionContext.restore();
  const frame = motionContext.getImageData(0, 0, width, height).data;
  if (!previousMotionFrame) {
    previousMotionFrame = new Uint8ClampedArray(frame);
    return null;
  }

  let left = 0;
  let center = 0;
  let right = 0;
  let upper = 0;
  let lower = 0;
  let total = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const index = (y * width + x) * 4;
      const diff = Math.abs(frame[index] - previousMotionFrame[index])
        + Math.abs(frame[index + 1] - previousMotionFrame[index + 1])
        + Math.abs(frame[index + 2] - previousMotionFrame[index + 2]);
      if (diff < 58) continue;
      total += diff;
      if (x < width * 0.33) left += diff;
      else if (x > width * 0.67) right += diff;
      else center += diff;
      if (y < height * 0.45) upper += diff;
      else lower += diff;
    }
  }
  previousMotionFrame = new Uint8ClampedArray(frame);

  const movement = total / 1000;
  if (movement < 18 || Date.now() - lastHandTime < 2500) return null;
  let key = '';
  if (upper > lower * 1.45 && upper > center) key = 'cool';
  else if (Math.abs(left - right) < center * 0.9 && movement > 30) key = 'surprised';
  else if (left > right * 1.35 || right > left * 1.35) key = 'happy';
  if (!key || key === lastHandKey) return null;
  lastHandKey = key;
  lastHandTime = Date.now();
  return { key, signature: [0, 0, 0, 0, 0, 0, 0.5], movement };
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
      const hand = detectHandMovement();
      if (hand) {
        setDetectedEmoji(hand.key, hand.signature);
        setStatus(`Hand movement detected: ${emojiMap[hand.key].label}`, false);
        return;
      }
      setStatus('Looking for a face...', true);
      return;
    }

    const faces = results
      .slice(0, 6)
      .map((result) => ({
        box: result.detection.box,
        key: expressionToEmoji(result.expressions),
        signature: expressionSignature(result.expressions),
      }));
    const primaryKey = stabilizeKey(faces[0].key);
    faces[0].key = primaryKey;
    lastExpressionSignature = faces[0].signature;
    renderFaceOverlays(faces);
    lastDetectedFaces = faces;
    setDetectedEmoji(primaryKey, lastExpressionSignature);
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

feedbackYesButton.addEventListener('click', () => {
  if (!pendingFeedback) return;
  rememberExpression(pendingFeedback.signature, pendingFeedback.key, true);
  showToast(`Confirmed ${emojiMap[pendingFeedback.key].label}`);
  hideFeedback();
});

feedbackNoButton.addEventListener('click', () => {
  if (!pendingFeedback) return;
  correctionForm.classList.remove('is-hidden');
  correctionSelect.focus();
});

saveCorrectionButton.addEventListener('click', () => {
  if (!pendingFeedback) return;
  const intendedKey = correctionSelect.value;
  rememberExpression(pendingFeedback.signature, intendedKey, false);
  setActiveEmoji(intendedKey, true, false);
  showToast(`Saved ${emojiMap[intendedKey].label} globally`);
  hideFeedback();
});

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
renderCorrectionOptions();
loadGlobalLearning();

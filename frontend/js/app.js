/**
 * Main Frontend Application Script.
 * Coordinates UI, camera capture, offline IDB storage, i18n, and sync engine.
 */

import { TRANSLATIONS } from './i18n.js';
import { saveIncident, getAllIncidents, clearAllLocalIncidents } from './idb-store.js';
import { syncEngine } from './sync-engine.js';


let currentLang = 'en';
let currentCoords = { lat: 20.5937, lng: 78.9629 };
let isAcquiringLocation = false;

// DOM Elements
const elLangSelect = document.getElementById('lang-select');
const elStatusStrip = document.getElementById('status-strip');
const elStatusText = document.getElementById('status-text');
const elBtnCapture = document.getElementById('btn-capture');
const elFileInput = document.getElementById('file-input');
const elGpsCoords = document.getElementById('gps-coords');
const elIncidentList = document.getElementById('incident-list');
const elBtnForceSync = document.getElementById('btn-force-sync');
const elAriaAnnouncer = document.getElementById('aria-announcer');

// Register Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(() => console.log('[PWA] Service Worker registered successfully.'))
    .catch((err) => console.warn('[PWA] Service Worker registration failed:', err));
}

// 1. Language Initialization & Translation Applicator
function setLanguage(langCode) {
  currentLang = TRANSLATIONS[langCode] ? langCode : 'en';
  const t = TRANSLATIONS[currentLang];

  // Update dynamic texts
  document.getElementById('app-title').textContent = t.appTitle;
  document.getElementById('app-subtitle').textContent = t.appSubtitle;
  document.getElementById('label-lang').textContent = t.languageLabel;
  document.getElementById('heading-capture').textContent = t.captureHeading;
  document.getElementById('desc-capture').textContent = t.captureDesc;
  document.getElementById('capture-btn-text').textContent = t.btnCapture;
  document.getElementById('heading-queue').textContent = t.queueHeading;
  document.getElementById('btn-force-sync').textContent = t.btnSyncNow;
  document.getElementById('dashboard-link-text').textContent = t.governmentPortalLink;

  updateNetworkStatusUI();
  renderIncidentHistory();
}

// 2. Network Status Handling
function updateNetworkStatusUI() {
  const t = TRANSLATIONS[currentLang];
  if (navigator.onLine) {
    elStatusStrip.className = 'status-strip online';
    elStatusText.textContent = t.online;
  } else {
    elStatusStrip.className = 'status-strip offline';
    elStatusText.textContent = t.offline;
  }
}

window.addEventListener('online', updateNetworkStatusUI);
window.addEventListener('offline', updateNetworkStatusUI);

// 3. Geolocation Acquisition
function fetchCurrentLocation() {
  if (!('geolocation' in navigator)) {
    elGpsCoords.textContent = `${currentCoords.lat.toFixed(4)}, ${currentCoords.lng.toFixed(4)} (Default)`;
    return;
  }

  isAcquiringLocation = true;
  elGpsCoords.textContent = TRANSLATIONS[currentLang].locating;

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      currentCoords = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };
      elGpsCoords.textContent = `${currentCoords.lat.toFixed(4)}, ${currentCoords.lng.toFixed(4)}`;
      isAcquiringLocation = false;
    },
    (err) => {
      console.warn('[GPS] Position unavailable, using regional default:', err.message);
      elGpsCoords.textContent = `${currentCoords.lat.toFixed(4)}, ${currentCoords.lng.toFixed(4)} (Approx)`;
      isAcquiringLocation = false;
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// 4. Edge Image Compression (Downsample to max 1280px to protect IndexedDB quota)
async function compressImageAtEdge(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      const MAX_DIM = 1280;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        }
      } else {
        if (height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.82);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      console.warn('[Image] Edge canvas downsample failed; using original image payload.');
      resolve(file);
    };
  });
}

function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// 5. Capture and Save to IndexedDB
async function handleImageCapture(file) {
  if (!file) return;

  const t = TRANSLATIONS[currentLang];
  elBtnCapture.disabled = true;
  document.getElementById('capture-btn-text').textContent = t.processing;
  elAriaAnnouncer.textContent = t.processing;

  try {
    const compressedBlob = await compressImageAtEdge(file);
    const incidentId = generateUUID();

    const incidentRecord = {
      id: incidentId,
      imageBlob: compressedBlob,
      lat: currentCoords.lat,
      lng: currentCoords.lng,
      lang: currentLang,
      createdAt: new Date().toISOString(),
      synced: false
    };

    // Store in IndexedDB
    await saveIncident(incidentRecord);

    elAriaAnnouncer.textContent = "Incident saved offline. Attempting sync...";
    
    // Refresh local list
    await renderIncidentHistory();

    // Trigger sync engine
    syncEngine.requestBackgroundSync();
    if (navigator.onLine) {
      syncEngine.drainQueue();
    }
  } catch (err) {
    console.error('[Capture Error]', err);
    alert('Capture error: ' + err.message);
  } finally {
    elBtnCapture.disabled = false;
    document.getElementById('capture-btn-text').textContent = t.btnCapture;
  }
}

let activeThumbUrls = [];

function createSampleLeafBlob(type) {
  return new Promise((resolve) => {
    const cvs = document.createElement('canvas');
    cvs.width = 320;
    cvs.height = 320;
    const ctx = cvs.getContext('2d');

    // Base background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 320, 320);

    // Leaf base shape
    ctx.save();
    ctx.translate(160, 160);
    ctx.beginPath();
    ctx.ellipse(0, 0, 110, 140, 0, 0, Math.PI * 2);

    if (type === 'healthy') {
      ctx.fillStyle = '#16a34a';
      ctx.fill();
      // Healthy veins
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -130); ctx.lineTo(0, 130);
      ctx.stroke();
      ctx.lineWidth = 2;
      for (let y = -90; y <= 90; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y); ctx.lineTo(55, y - 25);
        ctx.moveTo(0, y); ctx.lineTo(-55, y - 25);
        ctx.stroke();
      }
    } else if (type === 'bacterial') {
      ctx.fillStyle = '#4d7c0f';
      ctx.fill();
      // Bacterial necrotic water-soaked angular lesions
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath(); ctx.ellipse(-30, -40, 35, 25, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(40, 30, 45, 30, -0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#450a0a';
      ctx.beginPath(); ctx.ellipse(-30, -40, 18, 12, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(40, 30, 22, 14, -0.2, 0, Math.PI * 2); ctx.fill();
      // Yellow halos
      ctx.strokeStyle = '#eab308';
      ctx.lineWidth = 4;
      ctx.stroke();
    } else if (type === 'fungus') {
      ctx.fillStyle = '#65a30d';
      ctx.fill();
      // Early Blight concentric rings (target spots)
      ctx.fillStyle = '#ca8a04';
      ctx.beginPath(); ctx.ellipse(-20, -30, 35, 35, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(30, 45, 40, 40, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#78350f';
      ctx.beginPath(); ctx.ellipse(-20, -30, 22, 22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(30, 45, 25, 25, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#292524';
      ctx.beginPath(); ctx.ellipse(-20, -30, 10, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(30, 45, 12, 12, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      // Pest infestation / holes
      ctx.fillStyle = '#84cc16';
      ctx.fill();
      ctx.fillStyle = '#0f172a'; // eaten holes revealing dark background
      ctx.beginPath(); ctx.ellipse(-35, -20, 25, 18, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(30, 20, 30, 20, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(5, 60, 20, 15, 0.2, 0, Math.PI * 2); ctx.fill();
      // Chewed brown margins
      ctx.strokeStyle = '#713f12';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();

    cvs.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
  });
}

async function renderIncidentHistory() {
  const t = TRANSLATIONS[currentLang];
  const items = await getAllIncidents();

  // Revoke previous blob URLs to prevent client memory leaks
  activeThumbUrls.forEach((u) => URL.revokeObjectURL(u));
  activeThumbUrls = [];

  if (items.length === 0) {
    elIncidentList.innerHTML = `
      <div class="empty-state">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
        <p class="empty-state-title">${t.queueEmpty}</p>
        <p class="empty-state-hint">Capture a plant photo above or tap a Quick Test Sample to inspect edge neural diagnosis.</p>
      </div>
    `;
    return;
  }

  elIncidentList.innerHTML = '';
  items.slice(0, 10).forEach((item) => {
    const card = document.createElement('div');
    card.className = 'incident-card';

    const thumbUrl = URL.createObjectURL(item.imageBlob);
    activeThumbUrls.push(thumbUrl);
    const dateFormatted = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const diag = item.diagnosis;
    const hasDiag = !!diag;
    const sev = (diag?.severity || 'LOW').toLowerCase();
    const confPercent = (diag?.confidence !== undefined && diag?.confidence !== null) ? (diag.confidence * 100).toFixed(1) : null;


    card.innerHTML = `
      <div class="card-main-row">
        <img src="${thumbUrl}" alt="Crop symptom snapshot" class="incident-thumb" />
        <div class="incident-info">
          <div class="incident-header-line">
            <span class="incident-title">${hasDiag ? diag.condition : 'Incident #' + item.id.substring(0, 8)}</span>
            <span class="badge ${item.synced ? 'badge-synced' : 'badge-pending'}">
              ${item.synced ? t.statusSynced : t.statusPending}
            </span>
          </div>

          <div class="incident-meta">
            GPS: <span class="font-mono">${item.lat.toFixed(4)}, ${item.lng.toFixed(4)}</span> • ${dateFormatted}
            ${confPercent ? ` • Neural Conf: <strong class="conf-highlight">${confPercent}%</strong>` : ''}
          </div>

          ${hasDiag ? `
            <div class="treatment-box sev-${sev}">
              <div class="treatment-title-row">
                <span class="badge badge-sev badge-sev-${sev}">${diag.severity}</span>
                <span class="treatment-label">${t.treatmentTitle || 'Prescribed Action'}:</span>
              </div>
              <p class="treatment-text">${diag.treatment_plan}</p>
            </div>
          ` : `
            <div class="pending-notice">
              <span>⏳ Stored in local IndexedDB. Neural triage plan will populate upon sync.</span>
            </div>
          `}
        </div>
      </div>
    `;

    elIncidentList.appendChild(card);
  });
}

// Event Listeners
elLangSelect.addEventListener('change', (e) => setLanguage(e.target.value));

elBtnCapture.addEventListener('click', () => {
  elFileInput.click();
});

elFileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) {
    handleImageCapture(file);
  }
  elFileInput.value = '';
});

// Drag & Drop and click handlers on dropzone-area
const dropzone = document.getElementById('dropzone-area');
if (dropzone) {
  dropzone.addEventListener('click', (e) => {
    // If click was directly on dropzone or hint text (not on inner button), open picker
    if (e.target !== elBtnCapture && !elBtnCapture.contains(e.target)) {
      elFileInput.click();
    }
  });

  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      elFileInput.click();
    }
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleImageCapture(file);
    }
  });
}

// Quick Sample Leaf Buttons
document.querySelectorAll('.btn-sample-leaf').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const sampleType = btn.dataset.sample || 'healthy';
    btn.disabled = true;
    try {
      const sampleBlob = await createSampleLeafBlob(sampleType);
      const sampleFile = new File([sampleBlob], `sample_${sampleType}_${Date.now()}.jpg`, { type: 'image/jpeg' });
      await handleImageCapture(sampleFile);
    } catch (err) {
      console.error('Sample generation failed:', err);
    } finally {
      btn.disabled = false;
    }
  });
});

elBtnForceSync.addEventListener('click', () => {
  syncEngine.drainQueue();
});

const elBtnClearQueue = document.getElementById('btn-clear-queue');
if (elBtnClearQueue) {
  elBtnClearQueue.addEventListener('click', async () => {
    if (confirm('Clear all local edge images and triage incidents from IndexedDB?')) {
      await clearAllLocalIncidents();
      await renderIncidentHistory();
    }
  });
}

// Subscribe to Sync Engine updates with interactive button state feedback
syncEngine.subscribe((event) => {
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  if (event.type === 'SYNC_STARTED') {
    elBtnForceSync.disabled = true;
    elBtnForceSync.textContent = '⏳ Syncing Queue...';
  } else if (event.type === 'SYNC_COMPLETED') {
    elBtnForceSync.disabled = false;
    elBtnForceSync.textContent = t.btnSyncNow;
    renderIncidentHistory();
  } else if (event.type === 'SYNC_OFFLINE') {
    elBtnForceSync.disabled = false;
    elBtnForceSync.textContent = t.btnSyncNow;
    alert(event.message || 'Cannot sync: Device is offline.');
  } else if (event.type === 'ITEM_SYNCED') {
    renderIncidentHistory();
  }
});


// Initialization
setLanguage('en');
fetchCurrentLocation();
renderIncidentHistory();

// Automated Demo & Telemetry Inspection Modes
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('lang')) {
  setLanguage(urlParams.get('lang'));
  elLangSelect.value = urlParams.get('lang');
}


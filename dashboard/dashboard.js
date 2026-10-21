/**
 * National Outbreak Command Center - Tactical GIS & Triage Orchestrator.
 * Connects Leaflet map, MarkerCluster, Density Heatmap, SSE stream, 
 * multi-language diagnosis triage, audio alarms, and data export.
 */

// Ensure dashboard is always served fresh and not cached by offline PWA service worker
if ('serviceWorker' in navigator && typeof window !== 'undefined' && window.caches && typeof window.caches.keys === 'function') {
  caches.keys().then((names) => {
    names.forEach((name) => {
      caches.open(name).then((cache) => {
        cache.delete('/dashboard');
        cache.delete('/dashboard/');
        cache.delete('/dashboard/index.html');
        cache.delete('/dashboard/dashboard.js');
        cache.delete('/dashboard/dashboard.css');
      }).catch(() => {});
    });
  }).catch(() => {});
}


// Global Application State
let map;
let markerClusterGroup;
let heatLayer;
let allIncidents = [];
let activeMarkersMap = new Map(); // incident_id -> L.CircleMarker
let activeFilterSeverity = 'ALL';
let activeSearchQuery = '';
let selectedIncidentId = null;

let audioEnabled = false;
let audioCtx = null;
let autoSimInterval = null;

const SEVERITY_COLORS = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#10b981'
};

// DOM Elements
const kpiTotal = document.getElementById('kpi-total');
const kpiCritical = document.getElementById('kpi-critical');
const kpiConfidence = document.getElementById('kpi-confidence');
const kpiClusters = document.getElementById('kpi-clusters');
const threatLevelBadge = document.getElementById('threat-level-badge');

const barCrit = document.getElementById('bar-crit');
const barHigh = document.getElementById('bar-high');
const barMed = document.getElementById('bar-med');
const barLow = document.getElementById('bar-low');

const countAll = document.getElementById('count-all');
const countCrit = document.getElementById('count-crit');
const countHigh = document.getElementById('count-high');
const countMed = document.getElementById('count-med');
const countLow = document.getElementById('count-low');

const feedContainer = document.getElementById('feed-container');
const feedCountBadge = document.getElementById('feed-count-badge');
const searchInput = document.getElementById('search-input');
const btnSearchClear = document.getElementById('btn-search-clear');
const btnResetFilters = document.getElementById('btn-reset-filters');

const btnSimulate = document.getElementById('btn-simulate');
const btnAutoSim = document.getElementById('btn-auto-sim');
const autoSimLabel = document.getElementById('auto-sim-label');
const btnAudioToggle = document.getElementById('btn-audio-toggle');
const audioBtnLabel = document.getElementById('audio-btn-label');
const iconAudioOff = document.getElementById('icon-audio-off');
const iconAudioOn = document.getElementById('icon-audio-on');

const btnSidebarToggle = document.getElementById('btn-sidebar-toggle');
const sidebar = document.getElementById('sidebar');

const btnExportMenu = document.getElementById('btn-export-menu');
const exportDropdown = document.getElementById('export-dropdown');
const btnExportGeoJSON = document.getElementById('btn-export-geojson');
const btnExportCSV = document.getElementById('btn-export-csv');

const connectionBadge = document.getElementById('connection-badge');
const connectionStatusText = document.getElementById('connection-status-text');
const hudCoords = document.getElementById('hud-coords');
const hudZoom = document.getElementById('hud-zoom');
const hudTime = document.getElementById('hud-time');

// Modal Elements
const modal = document.getElementById('incident-modal');
const btnModalClose = document.getElementById('btn-modal-close');
const modalSeverityBadge = document.getElementById('modal-severity-badge');
const modalCategory = document.getElementById('modal-category');
const modalConditionTitle = document.getElementById('modal-condition-title');
const modalAgent = document.getElementById('modal-agent');
const modalTime = document.getElementById('modal-time');
const modalConfidenceVal = document.getElementById('modal-confidence-val');
const modalConfidenceBar = document.getElementById('modal-confidence-bar');
const modalTreatment = document.getElementById('modal-treatment');
const modalCoords = document.getElementById('modal-coords');
const modalId = document.getElementById('modal-id');
const btnDispatchAdvisory = document.getElementById('btn-dispatch-advisory');
const btnCopyGeoJSON = document.getElementById('btn-copy-geojson');
const toastContainer = document.getElementById('toast-container');

// ==========================================================================
// 1. Initialize Map, Layers, and Controls
// ==========================================================================
function initMap() {
  map = L.map('map', {
    zoomControl: true,
    minZoom: 3
  }).setView([20.5937, 78.9629], 5);

  // Basemap 1: Tactical Dark Canvas (Default, Esri)
  const darkCanvasBase = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    maxNativeZoom: 16,
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
  });

  const darkCanvasLabels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
    maxNativeZoom: 16,
    maxZoom: 19,
    attribution: 'Esri &mdash; Labels'
  });

  const darkCanvasGroup = L.layerGroup([darkCanvasBase, darkCanvasLabels]).addTo(map);

  // Basemap 2: Standard OpenStreetMap (Detailed streets & boundaries)
  const osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });

  // Basemap 3: High-Resolution Satellite Imagery (Esri)
  const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, GIS Community'
  });

  // Overlay 1: Incident Cluster Group
  markerClusterGroup = L.markerClusterGroup({
    chunkedLoading: true,
    maxClusterRadius: 45,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false
  });
  map.addLayer(markerClusterGroup);

  // Overlay 2: Outbreak Density Heatmap (using Leaflet.heat if available)
  if (typeof L.heatLayer === 'function') {
    heatLayer = L.heatLayer([], {
      radius: 28,
      blur: 18,
      maxZoom: 9,
      max: 1.0,
      gradient: {
        0.2: '#10b981',
        0.5: '#eab308',
        0.8: '#f97316',
        1.0: '#ef4444'
      }
    });
    map.addLayer(heatLayer);
  }

  // Layer Switcher Control
  const baseMaps = {
    '🌙 Dark Canvas': darkCanvasGroup,
    '🗺️ Street Map (OSM)': osmLayer,
    '🛰️ Satellite View': satelliteLayer
  };

  const overlayMaps = {
    '📍 Outbreak Hotspots': markerClusterGroup
  };
  if (heatLayer) {
    overlayMaps['🌡️ Density Heatmap'] = heatLayer;
  }

  L.control.layers(baseMaps, overlayMaps, { position: 'topright', collapsed: false }).addTo(map);

  // Map Telemetry HUD Updates
  map.on('mousemove', (e) => {
    if (hudCoords) {
      hudCoords.textContent = `${e.latlng.lat.toFixed(4)}° N, ${e.latlng.lng.toFixed(4)}° E`;
    }
  });

  map.on('zoomend', () => {
    if (hudZoom) {
      hudZoom.textContent = map.getZoom().toFixed(1);
    }
  });

  // Ensure map tiles properly layout on window resize
  window.addEventListener('resize', () => {
    if (map) map.invalidateSize();
  });
  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 250);
}

// ==========================================================================
// 2. Helper Utilities (Sanitization & Date Formatting)
// ==========================================================================
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatIncidentTime(timestamp) {
  if (!timestamp) return 'Just now';
  const d = new Date(timestamp);
  return isNaN(d.getTime()) ? 'Just now' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatIncidentDateTime(timestamp) {
  if (!timestamp) return 'Just now';
  const d = new Date(timestamp);
  return isNaN(d.getTime()) ? 'Just now' : d.toLocaleString();
}

function createIncidentMarker(feature) {
  const [lng, lat] = feature.geometry.coordinates;
  const props = feature.properties;
  const color = SEVERITY_COLORS[props.severity] || '#38bdf8';
  const safeCondition = escapeHtml(props.condition);
  const safeSeverity = escapeHtml(props.severity);
  const safeAgent = escapeHtml(props.agent_id || 'field-node');
  const safeTreatment = escapeHtml(props.treatment_plan);
  const safeId = escapeHtml(feature.id);

  const marker = L.circleMarker([lat, lng], {
    radius: props.severity === 'CRITICAL' ? 11 : 9,
    fillColor: color,
    color: '#ffffff',
    weight: 1.5,
    opacity: 0.95,
    fillOpacity: 0.85
  });

  const popupHtml = `
    <div style="font-family: inherit; font-size: 13px; line-height: 1.4; min-width: 200px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <strong style="color: #f8fafc; font-size: 14px;">${safeCondition}</strong>
        <span class="badge badge-${safeSeverity.toLowerCase()}">${safeSeverity}</span>
      </div>
      <div style="color: #94a3b8; font-size: 11px; margin-bottom: 8px;">
        Agent: <code>${safeAgent}</code> • Conf: <strong>${((props.confidence || 0.9) * 100).toFixed(1)}%</strong>
      </div>
      <div style="background: rgba(255,255,255,0.06); padding: 8px; border-radius: 6px; margin-bottom: 8px;">
        <span style="color: #38bdf8; font-weight: 600; font-size: 11px; display: block; margin-bottom: 2px;">Triage Action:</span>
        <span style="color: #e2e8f0; font-size: 12px;">${safeTreatment}</span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
        <span style="font-size: 11px; color: #64748b;">${lat.toFixed(3)}, ${lng.toFixed(3)}</span>
        <button style="background: #0284c7; color: white; border: none; border-radius: 4px; padding: 3px 8px; font-size: 11px; cursor: pointer;" onclick="openIncidentDetails('${safeId}')">Inspect</button>
      </div>
    </div>
  `;

  marker.bindPopup(popupHtml, { maxWidth: 320 });

  marker.on('click', () => {
    highlightFeedItem(feature.id);
  });

  return marker;
}

// ==========================================================================
// 3. Process & Add Incident
// ==========================================================================
function addIncidentToDashboard(feature, isNewLive = false, shouldRender = true) {
  // Prevent duplicate additions
  if (allIncidents.some(i => i.id === feature.id)) return;

  allIncidents.unshift(feature);

  // Add marker to active markers map
  const marker = createIncidentMarker(feature);
  activeMarkersMap.set(feature.id, marker);

  // Update map layer if it matches current filter
  const matchesSeverity = (activeFilterSeverity === 'ALL' || feature.properties.severity === activeFilterSeverity);
  const matchesSearch = queryMatchesIncident(feature, activeSearchQuery);

  if (matchesSeverity && matchesSearch) {
    markerClusterGroup.addLayer(marker);
  }

  if (shouldRender) {
    // Update Heatmap
    updateHeatmap();

    // Recalculate KPIs and distribution bar
    updateKpiMetrics();

    // Refresh feed list
    renderFeedList();
  }

  if (isNewLive) {
    const [lng, lat] = feature.geometry.coordinates;
    const props = feature.properties;

    // Trigger audio chime if critical/high
    if (props.severity === 'CRITICAL' || props.severity === 'HIGH') {
      playAlertChime(props.severity);
    }

    // Show toast notification
    showToast(
      `🚨 Outbreak Alert: ${props.condition}`,
      `Severity ${props.severity} detected at [${lat.toFixed(2)}, ${lng.toFixed(2)}].`,
      props.severity.toLowerCase()
    );

    // If within active filters, fly to it
    if (matchesSeverity && matchesSearch) {
      map.panTo([lat, lng], { animate: true, duration: 1 });
      setTimeout(() => marker.openPopup(), 400);
    }
  }
}

// ==========================================================================
// 4. Incident Feed Rendering & Filtering
// ==========================================================================
function queryMatchesIncident(feature, query) {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  const props = feature.properties;
  return (
    (props.condition && props.condition.toLowerCase().includes(q)) ||
    (props.treatment_plan && props.treatment_plan.toLowerCase().includes(q)) ||
    (props.category && props.category.toLowerCase().includes(q)) ||
    (props.agent_id && props.agent_id.toLowerCase().includes(q))
  );
}

function renderFeedList() {
  feedContainer.innerHTML = '';

  const filtered = allIncidents.filter(inc => {
    const matchesSev = (activeFilterSeverity === 'ALL' || inc.properties.severity === activeFilterSeverity);
    const matchesSearch = queryMatchesIncident(inc, activeSearchQuery);
    return matchesSev && matchesSearch;
  });

  feedCountBadge.textContent = `${filtered.length} visible`;

  if (filtered.length === 0) {
    feedContainer.innerHTML = `
      <div style="text-align: center; padding: 24px 12px; color: var(--text-muted); font-size: 0.8rem;">
        No incidents match the active filter or search query.
      </div>
    `;
    return;
  }

  filtered.forEach(feature => {
    const props = feature.properties;
    const [lng, lat] = feature.geometry.coordinates;
    const timeFormatted = formatIncidentTime(props.timestamp);
    const sevClass = (props.severity || 'low').toLowerCase().slice(0, 4);
    const safeCondition = escapeHtml(props.condition);
    const safeSeverity = escapeHtml(props.severity);
    const safeTreatment = escapeHtml(props.treatment_plan);
    const safeId = escapeHtml(feature.id);

    const itemEl = document.createElement('div');
    itemEl.className = `feed-item ${sevClass}`;
    itemEl.id = `feed-${feature.id}`;
    if (selectedIncidentId === feature.id) {
      itemEl.classList.add('selected');
    }

    itemEl.innerHTML = `
      <div class="feed-item-top">
        <span class="feed-item-title">${safeCondition}</span>
        <span class="badge badge-${safeSeverity.toLowerCase()}">${safeSeverity}</span>
      </div>
      <div class="feed-item-desc">${safeTreatment}</div>
      <div class="feed-item-footer">
        <span class="font-mono">${lat.toFixed(2)}°, ${lng.toFixed(2)}°</span>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>${timeFormatted}</span>
          <button class="inspect-btn" type="button" title="View in-depth triage dossier" onclick="event.stopPropagation(); openIncidentDetails('${safeId}');">Inspect</button>
        </div>
      </div>
    `;

    itemEl.addEventListener('click', () => {
      highlightFeedItem(feature.id);
      map.flyTo([lat, lng], 11, { animate: true, duration: 1.2 });
      const marker = activeMarkersMap.get(feature.id);
      if (marker) {
        markerClusterGroup.zoomToShowLayer(marker, () => {
          marker.openPopup();
        });
      }
    });

    itemEl.addEventListener('dblclick', () => {
      openIncidentDetails(feature.id);
    });

    feedContainer.appendChild(itemEl);
  });
}

function highlightFeedItem(incidentId) {
  selectedIncidentId = incidentId;
  document.querySelectorAll('.feed-item').forEach(el => el.classList.remove('selected'));
  const target = document.getElementById(`feed-${incidentId}`);
  if (target) {
    target.classList.add('selected');
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// ==========================================================================
// 5. KPI Calculator & Outbreak Distribution
// ==========================================================================
function updateKpiMetrics() {
  const total = allIncidents.length;
  kpiTotal.textContent = total;

  const critCount = allIncidents.filter(i => i.properties.severity === 'CRITICAL').length;
  const highCount = allIncidents.filter(i => i.properties.severity === 'HIGH').length;
  const medCount  = allIncidents.filter(i => i.properties.severity === 'MEDIUM').length;
  const lowCount  = allIncidents.filter(i => i.properties.severity === 'LOW').length;

  kpiCritical.textContent = critCount + highCount;

  // Pills counts
  countAll.textContent = total;
  countCrit.textContent = critCount;
  countHigh.textContent = highCount;
  countMed.textContent = medCount;
  countLow.textContent = lowCount;

  // Confidence calculation
  if (total > 0) {
    const avgConf = (allIncidents.reduce((acc, curr) => acc + (curr.properties.confidence || 0.9), 0) / total) * 100;
    kpiConfidence.textContent = `${avgConf.toFixed(1)}%`;
  } else {
    kpiConfidence.textContent = '0.0%';
  }

  // Active Clusters approximation
  const clusterCount = total === 0 ? 0 : Math.min(total, Math.ceil(total * 0.6));
  kpiClusters.textContent = clusterCount;
  const hudHotspots = document.getElementById('hud-hotspots');
  if (hudHotspots) {
    hudHotspots.textContent = clusterCount > 0 ? `${clusterCount} Active` : 'None';
  }

  // Distribution Bar Proportions
  if (total > 0) {
    barCrit.style.width = `${(critCount / total) * 100}%`;
    barHigh.style.width = `${(highCount / total) * 100}%`;
    barMed.style.width  = `${(medCount / total) * 100}%`;
    barLow.style.width  = `${(lowCount / total) * 100}%`;
  } else {
    barCrit.style.width = '25%';
    barHigh.style.width = '25%';
    barMed.style.width  = '25%';
    barLow.style.width  = '25%';
  }

  // Threat Level assessment
  if (critCount >= 3 || (critCount + highCount) >= 6) {
    threatLevelBadge.textContent = 'CRITICAL ALERT';
    threatLevelBadge.style.color = '#f87171';
    threatLevelBadge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    threatLevelBadge.style.background = 'rgba(239, 68, 68, 0.2)';
  } else if ((critCount + highCount) >= 3) {
    threatLevelBadge.textContent = 'HIGH THREAT';
    threatLevelBadge.style.color = '#fb923c';
    threatLevelBadge.style.borderColor = 'rgba(249, 115, 22, 0.4)';
    threatLevelBadge.style.background = 'rgba(249, 115, 22, 0.2)';
  } else {
    threatLevelBadge.textContent = 'MODERATE';
    threatLevelBadge.style.color = '#34d399';
    threatLevelBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    threatLevelBadge.style.background = 'rgba(16, 185, 129, 0.2)';
  }
}

// ==========================================================================
// 6. Heatmap Engine
// ==========================================================================
function updateHeatmap() {
  if (!heatLayer) return;
  const filtered = allIncidents.filter(inc => {
    const matchesSev = (activeFilterSeverity === 'ALL' || inc.properties.severity === activeFilterSeverity);
    const matchesSearch = queryMatchesIncident(inc, activeSearchQuery);
    return matchesSev && matchesSearch;
  });

  const points = filtered.map(inc => {
    const [lng, lat] = inc.geometry.coordinates;
    const intensity = inc.properties.severity === 'CRITICAL' ? 1.0 :
                      inc.properties.severity === 'HIGH' ? 0.75 :
                      inc.properties.severity === 'MEDIUM' ? 0.5 : 0.25;
    return [lat, lng, intensity];
  });
  heatLayer.setLatLngs(points);
}

// ==========================================================================
// 7. Filter & Search Handling
// ==========================================================================
function applyFilters() {
  markerClusterGroup.clearLayers();

  allIncidents.forEach((feat) => {
    const marker = activeMarkersMap.get(feat.id);
    if (!marker) return;

    const matchesSev = (activeFilterSeverity === 'ALL' || feat.properties.severity === activeFilterSeverity);
    const matchesSearch = queryMatchesIncident(feat, activeSearchQuery);

    if (matchesSev && matchesSearch) {
      markerClusterGroup.addLayer(marker);
    }
  });

  updateHeatmap();
  renderFeedList();
}

// Severity pill buttons
document.querySelectorAll('.pill-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilterSeverity = btn.dataset.severity;
    applyFilters();
  });
});

// Search input
searchInput.addEventListener('input', (e) => {
  activeSearchQuery = e.target.value;
  btnSearchClear.style.display = activeSearchQuery ? 'block' : 'none';
  applyFilters();
});

btnSearchClear.addEventListener('click', () => {
  searchInput.value = '';
  activeSearchQuery = '';
  btnSearchClear.style.display = 'none';
  applyFilters();
});

btnResetFilters.addEventListener('click', () => {
  searchInput.value = '';
  activeSearchQuery = '';
  btnSearchClear.style.display = 'none';
  activeFilterSeverity = 'ALL';
  document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.pill-btn[data-severity="ALL"]').classList.add('active');
  applyFilters();
});

// ==========================================================================
// 8. Incident Details Modal & Actions
// ==========================================================================
function fallbackCopyText(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const success = document.execCommand('copy');
    document.body.removeChild(ta);
    if (success) {
      showToast('📋 Copied to Clipboard', 'GeoJSON feature copied for GIS export.', 'success');
      return;
    }
  } catch (err) {
    console.warn('Fallback copy failed:', err);
  }
  showToast('⚠️ Copy Failed', 'Please copy GeoJSON manually from dossier.', 'accent');
}

window.openIncidentDetails = function(incidentId) {
  const incident = allIncidents.find(i => i.id === incidentId);
  if (!incident) return;

  const props = incident.properties || {};
  const [lng, lat] = incident.geometry?.coordinates || [0, 0];
  const sev = (props.severity || 'LOW').toUpperCase();

  modalSeverityBadge.className = `badge badge-${sev.toLowerCase()}`;
  modalSeverityBadge.textContent = sev;
  modalCategory.textContent = props.category || 'General Pathology';
  modalConditionTitle.textContent = props.condition || 'Unspecified Incident';
  modalAgent.textContent = props.agent_id || 'pwa-edge';
  modalTime.textContent = formatIncidentDateTime(props.timestamp);

  const confPercent = ((props.confidence !== undefined && props.confidence !== null ? props.confidence : 0.95) * 100).toFixed(1);
  modalConfidenceVal.textContent = `${confPercent}%`;
  modalConfidenceBar.style.width = `${confPercent}%`;

  modalTreatment.textContent = props.treatment_plan || 'No immediate action plan recorded.';
  modalCoords.textContent = `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
  modalId.textContent = incident.id || '--';

  btnDispatchAdvisory.onclick = () => {
    showToast('📣 Regional Advisory Dispatched', `Broadcasted protocol for ${props.condition || 'incident'} to regional extension officers.`, 'success');
    closeIncidentDetails();
  };

  btnCopyGeoJSON.onclick = () => {
    const text = JSON.stringify(incident, null, 2);
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(() => {
        showToast('📋 Copied to Clipboard', 'GeoJSON feature copied for GIS export.', 'success');
      }).catch(() => fallbackCopyText(text));
    } else {
      fallbackCopyText(text);
    }
  };

  modal.style.display = 'flex';
};


function closeIncidentDetails() {
  modal.style.display = 'none';
}

btnModalClose.addEventListener('click', closeIncidentDetails);
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeIncidentDetails();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && modal.style.display === 'flex') {
    closeIncidentDetails();
  }
});

// ==========================================================================
// 9. Toast Notification System
// ==========================================================================
function showToast(title, msg, type = 'accent') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${msg}</div>
    </div>
  `;

  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px) scale(0.95)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 4500);
}

// ==========================================================================
// 10. Web Audio Synthesizer (Radar Chime)
// ==========================================================================
function playAlertChime(severity) {
  if (!audioEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    if (severity === 'CRITICAL') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.15);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (e) {
    console.warn('Audio play error:', e);
  }
}

btnAudioToggle.addEventListener('click', () => {
  audioEnabled = !audioEnabled;
  if (audioEnabled) {
    iconAudioOff.style.display = 'none';
    iconAudioOn.style.display = 'inline';
    audioBtnLabel.textContent = 'Alert Sound: On';
    btnAudioToggle.classList.add('active-state');
    playAlertChime('HIGH');
    showToast('🔊 Audio Alarms Enabled', 'Radar chimes will alert on new critical outbreak telemetry.', 'success');
  } else {
    iconAudioOff.style.display = 'inline';
    iconAudioOn.style.display = 'none';
    audioBtnLabel.textContent = 'Alert Sound: Off';
    btnAudioToggle.classList.remove('active-state');
  }
});

// ==========================================================================
// 11. Data Export (GeoJSON & CSV)
// ==========================================================================
btnExportMenu.addEventListener('click', (e) => {
  e.stopPropagation();
  exportDropdown.classList.toggle('show');
});

document.addEventListener('click', () => {
  exportDropdown.classList.remove('show');
});

btnExportGeoJSON.addEventListener('click', () => {
  const geojson = {
    type: 'FeatureCollection',
    features: allIncidents
  };
  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
  downloadBlob(blob, `outbreak_telemetry_${Date.now()}.geojson`);
  showToast('📥 Export Complete', 'Full GeoJSON FeatureCollection exported.', 'success');
});

btnExportCSV.addEventListener('click', () => {
  const headers = ['id', 'condition', 'category', 'severity', 'confidence', 'latitude', 'longitude', 'timestamp', 'agent_id', 'treatment_plan'];
  const rows = allIncidents.map(i => {
    const p = i.properties;
    const [lng, lat] = i.geometry.coordinates;
    return [
      `"${i.id}"`,
      `"${p.condition || ''}"`,
      `"${p.category || ''}"`,
      `"${p.severity || ''}"`,
      `"${p.confidence || ''}"`,
      lat,
      lng,
      `"${p.timestamp || ''}"`,
      `"${p.agent_id || ''}"`,
      `"${(p.treatment_plan || '').replace(/"/g, '""')}"`
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `outbreak_telemetry_${Date.now()}.csv`);
  showToast('📥 Export Complete', 'Telemetry spreadsheet CSV exported.', 'success');
});

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ==========================================================================
// 12. Sidebar Collapse & Layout Toggle
// ==========================================================================
btnSidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
  setTimeout(() => {
    if (map) map.invalidateSize();
  }, 320);
});

// ==========================================================================
// 13. HUD Clock (Live Time)
// ==========================================================================
function updateClock() {
  const now = new Date();
  hudTime.textContent = now.toLocaleTimeString([], { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

// ==========================================================================
// 14. Initial Data Hydration & SSE Real-Time Stream
// ==========================================================================
async function loadInitialIncidents() {
  try {
    const res = await fetch('/api/v1/incidents/geojson');
    if (res.ok) {
      const data = await res.json();
      data.features.forEach((feature) => {
        addIncidentToDashboard(feature, false, false);
      });
      // Single consolidated render cycle after initial hydration
      updateHeatmap();
      updateKpiMetrics();
      renderFeedList();
    }
  } catch (err) {
    console.error('[Dashboard] Error fetching initial GeoJSON:', err);
  }
}

function connectRealTimeStream() {
  const eventSource = new EventSource('/api/v1/dashboard/stream');

  eventSource.onopen = () => {
    connectionBadge.className = 'connection-pill live';
    connectionStatusText.textContent = 'SSE Live Feed Active';
  };

  eventSource.onmessage = (event) => {
    try {
      const feature = JSON.parse(event.data);
      if (feature && feature.geometry) {
        addIncidentToDashboard(feature, true);
      }
    } catch (err) {
      console.warn('[SSE] Parse warning:', err);
    }
  };

  eventSource.onerror = () => {
    connectionBadge.className = 'connection-pill disconnected';
    connectionStatusText.textContent = 'Reconnecting Feed...';
  };
}

// ==========================================================================
// 15. Simulation Controls (Single & Auto-Loop)
// ==========================================================================
async function triggerSimulatePing() {
  btnSimulate.disabled = true;

  const conditions = ["PestInfestation", "BacterialBlight", "EarlyBlightFungus", "NutrientChlorosis"];
  const severities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
  const langs = ["en", "hi", "ta", "te", "es", "bn"];

  const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
  const randomSeverity = severities[Math.floor(Math.random() * severities.length)];
  const randomLang = langs[Math.floor(Math.random() * langs.length)];

  try {
    await fetch('/api/v1/simulate-incident', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        condition: randomCondition,
        severity: randomSeverity,
        language_code: randomLang
      })
    });
  } catch (e) {
    console.error('Simulation error:', e);
  } finally {
    setTimeout(() => {
      btnSimulate.disabled = false;
    }, 400);
  }
}

btnSimulate.addEventListener('click', triggerSimulatePing);

btnAutoSim.addEventListener('click', () => {
  if (autoSimInterval) {
    clearInterval(autoSimInterval);
    autoSimInterval = null;
    autoSimLabel.textContent = 'Auto-Sim: Off';
    btnAutoSim.classList.remove('active-state');
    showToast('⚡ Auto-Simulation Stopped', 'Live telemetry feed running on standard inputs.', 'accent');
  } else {
    autoSimInterval = setInterval(triggerSimulatePing, 7000);
    autoSimLabel.textContent = 'Auto-Sim: Active';
    btnAutoSim.classList.add('active-state');
    showToast('⚡ Auto-Simulation Active', 'Simulating edge triage telemetry pings every 7 seconds.', 'success');
    triggerSimulatePing();
  }
});

// ==========================================================================
// 16. Boot Sequence
// ==========================================================================
initMap();
loadInitialIncidents();
connectRealTimeStream();

const dashUrlParams = new URLSearchParams(window.location.search);
if (dashUrlParams.has('open')) {
  setTimeout(() => {
    openIncidentDetails(dashUrlParams.get('open'));
  }, 600);
}

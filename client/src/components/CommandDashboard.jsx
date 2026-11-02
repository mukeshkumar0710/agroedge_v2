import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { simulateFieldIncident, clearAllIncidents } from '../services/api';
import { audioAlertEngine } from '../services/audio';

const SEVERITY_COLORS = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#10b981'
};

export default function CommandDashboard({
  incidents,
  setIncidents,
  currentLang,
  t,
  onSelectIncident
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef(new Map()); // incident_id -> L.CircleMarker

  const [activeFilter, setActiveFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSimulating, setIsSimulating] = useState(false);
  const [autoSimActive, setAutoSimActive] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const autoSimTimerRef = useRef(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [21.5, 79.0],
        zoom: 5,
        zoomControl: false,
        attributionControl: false
      });

      L.control.zoom({ position: 'topright' }).addTo(map);

      // Dark Matter CartoDB Tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Sync Markers with Incidents
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current.clear();

    const filtered = filteredIncidents();

    filtered.forEach((feature) => {
      const coords = feature.geometry?.coordinates; // [lng, lat]
      if (!coords || coords.length < 2) return;
      const [lng, lat] = coords;
      const props = feature.properties || {};
      const severity = props.severity || 'MEDIUM';
      const color = SEVERITY_COLORS[severity] || '#3b82f6';
      const isCritical = severity === 'CRITICAL';

      // Create Custom Leaflet Circle Marker with glowing radar effect
      const marker = L.circleMarker([lat, lng], {
        radius: isCritical ? 10 : 8,
        fillColor: color,
        color: '#ffffff',
        weight: 1.5,
        opacity: 0.9,
        fillOpacity: 0.85
      });

      const popupContent = `
        <div style="font-family: 'Inter', sans-serif; min-width: 200px; color: #0f172a;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px;">
            <strong style="font-size: 13px; color: #1e293b;">${props.condition || 'Crop Incident'}</strong>
            <span style="background:${color}; color:#fff; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px;">
              ${severity}
            </span>
          </div>
          <p style="font-size: 11px; color: #475569; margin: 0 0 6px 0;">
            Confidence: <strong>${Math.round((props.confidence || 0.9) * 100)}%</strong> • ${props.category || 'Agronomy'}
          </p>
          <p style="font-size: 11px; line-height: 1.4; color: #334155; margin: 0; background: #f1f5f9; padding: 6px; border-radius: 4px;">
            ${(props.treatment_plan || '').substring(0, 110)}...
          </p>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.on('click', () => {
        if (onSelectIncident) onSelectIncident(feature);
      });

      marker.addTo(map);
      markersRef.current.set(feature.id, marker);
    });
  }, [incidents, activeFilter, searchQuery]);

  // Handle Auto-Simulation interval
  useEffect(() => {
    if (autoSimActive) {
      autoSimTimerRef.current = setInterval(() => {
        handleSimulate();
      }, 5000);
    } else {
      if (autoSimTimerRef.current) clearInterval(autoSimTimerRef.current);
    }

    return () => {
      if (autoSimTimerRef.current) clearInterval(autoSimTimerRef.current);
    };
  }, [autoSimActive]);

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      const conditions = [
        'BacterialBlight',
        'PestInfestation',
        'EarlyBlightFungus',
        'NutrientChlorosis',
        'HealthySample'
      ];
      const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      const randCond = conditions[Math.floor(Math.random() * conditions.length)];
      const randSev = severities[Math.floor(Math.random() * severities.length)];

      const res = await simulateFieldIncident({
        condition: randCond,
        severity: randSev,
        language_code: currentLang
      });

      if (res.feature && audioEnabled && res.feature.properties?.severity === 'CRITICAL') {
        audioAlertEngine.playCriticalAlert();
      }
    } catch (err) {
      console.warn('[Simulation Warning]', err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to purge all telemetry records from MongoDB?')) {
      try {
        await clearAllIncidents();
        setIncidents([]);
      } catch (e) {
        alert('Failed to clear database: ' + e.message);
      }
    }
  };

  const toggleAudio = () => {
    const newState = audioAlertEngine.toggle();
    setAudioEnabled(newState);
  };

  const focusOnIncident = (feature) => {
    const coords = feature.geometry?.coordinates;
    if (!coords || !mapInstanceRef.current) return;
    mapInstanceRef.current.flyTo([coords[1], coords[0]], 9, { duration: 1.2 });
    const marker = markersRef.current.get(feature.id);
    if (marker) marker.openPopup();
    if (onSelectIncident) onSelectIncident(feature);
  };

  const filteredIncidents = () => {
    return incidents.filter((feat) => {
      const props = feat.properties || {};
      const matchesSeverity = activeFilter === 'ALL' || props.severity === activeFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (props.condition || '').toLowerCase().includes(q) ||
        (props.incident_id || '').toLowerCase().includes(q) ||
        (props.treatment_plan || '').toLowerCase().includes(q);

      return matchesSeverity && matchesSearch;
    });
  };

  // KPI Computations
  const totalCount = incidents.length;
  const criticalCount = incidents.filter((i) => i.properties?.severity === 'CRITICAL').length;
  const highCount = incidents.filter((i) => i.properties?.severity === 'HIGH').length;
  const mediumCount = incidents.filter((i) => i.properties?.severity === 'MEDIUM').length;
  const lowCount = incidents.filter((i) => i.properties?.severity === 'LOW').length;

  const avgConfidence = totalCount
    ? Math.round((incidents.reduce((acc, i) => acc + (i.properties?.confidence || 0.9), 0) / totalCount) * 100)
    : 92;

  const threatLevel = criticalCount > 3 ? 'CRITICAL' : criticalCount > 0 ? 'ELEVATED' : 'STABLE';

  // Export Utilities
  const exportGeoJSON = () => {
    const fc = {
      type: 'FeatureCollection',
      features: incidents
    };
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agroedge_telemetry_${Date.now()}.geojson`;
    a.click();
  };

  const exportCSV = () => {
    if (!incidents.length) return;
    const headers = ['id', 'condition', 'severity', 'confidence', 'latitude', 'longitude', 'timestamp', 'treatment'];
    const rows = incidents.map((i) => {
      const p = i.properties || {};
      const c = i.geometry?.coordinates || [0, 0];
      return [
        i.id,
        `"${p.condition || ''}"`,
        p.severity || '',
        p.confidence || 0,
        c[1],
        c[0],
        `"${p.timestamp || ''}"`,
        `"${(p.treatment_plan || '').replace(/"/g, '""')}"`
      ].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agroedge_telemetry_${Date.now()}.csv`;
    a.click();
  };

  const filtered = filteredIncidents();

  return (
    <div className="dashboard-container">
      {/* Top Tactical Command Strip */}
      <div className="command-strip">
        <div className="command-left">
          <div className="strip-title-wrap">
            <span className="radar-ping"></span>
            <span className="strip-title">National Agricultural Command Hub</span>
          </div>
          <span className={`threat-badge threat-${threatLevel.toLowerCase()}`}>
            THREAT: {threatLevel}
          </span>
        </div>

        {/* Action Controls */}
        <div className="command-actions">
          <button
            type="button"
            className="btn btn-sm btn-action"
            onClick={handleSimulate}
            disabled={isSimulating}
          >
            <span>⚡</span>
            <span>{t.simulateBtn}</span>
          </button>

          <button
            type="button"
            className={`btn btn-sm ${autoSimActive ? 'btn-active-sim' : 'btn-action'}`}
            onClick={() => setAutoSimActive(!autoSimActive)}
          >
            <span>{autoSimActive ? '🟢' : '⚪'}</span>
            <span>{t.autoSimToggle}</span>
          </button>

          <button
            type="button"
            className={`btn btn-sm ${audioEnabled ? 'btn-active-audio' : 'btn-action'}`}
            onClick={toggleAudio}
            title="Audio alerts for critical outbreaks"
          >
            <span>{audioEnabled ? '🔔' : '🔕'}</span>
            <span>{t.soundToggle}</span>
          </button>

          <button type="button" className="btn btn-sm btn-action" onClick={exportGeoJSON}>
            <span>📥</span>
            <span>GeoJSON</span>
          </button>

          <button type="button" className="btn btn-sm btn-action" onClick={exportCSV}>
            <span>📊</span>
            <span>CSV</span>
          </button>

          <button type="button" className="btn btn-sm btn-danger-action" onClick={handleClearAll}>
            <span>🗑️</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">{t.totalInspections}</span>
          <div className="kpi-value-wrap">
            <span className="kpi-value">{totalCount}</span>
            <span className="kpi-subtag">Persisted in MongoDB</span>
          </div>
        </div>

        <div className="kpi-card kpi-card-critical">
          <span className="kpi-label">{t.criticalRate}</span>
          <div className="kpi-value-wrap">
            <span className="kpi-value text-red">{criticalCount}</span>
            <span className="kpi-subtag">High Priority Alarms</span>
          </div>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">{t.meanConfidence}</span>
          <div className="kpi-value-wrap">
            <span className="kpi-value text-emerald">{avgConfidence}%</span>
            <span className="kpi-subtag">Neural Ensemble ViT</span>
          </div>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Active Severities</span>
          <div className="severity-mini-bars">
            <div className="mini-bar-item" title="Critical">
              <span className="dot dot-crit"></span>
              <span>{criticalCount}</span>
            </div>
            <div className="mini-bar-item" title="High">
              <span className="dot dot-high"></span>
              <span>{highCount}</span>
            </div>
            <div className="mini-bar-item" title="Medium">
              <span className="dot dot-med"></span>
              <span>{mediumCount}</span>
            </div>
            <div className="mini-bar-item" title="Low">
              <span className="dot dot-low"></span>
              <span>{lowCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tactical Layout: Map + Live Telemetry Feed */}
      <div className="dashboard-main-grid">
        {/* Left: GIS Map View */}
        <div className="map-wrapper card">
          <div className="map-hud-overlay">
            <span className="hud-pill">🗺️ CartoDB Dark Matter GIS</span>
            <span className="hud-pill">2dsphere Spatial Index</span>
            <span className="hud-pill">{filtered.length} Displayed</span>
          </div>
          <div ref={mapContainerRef} className="leaflet-map-canvas" />
        </div>

        {/* Right: Live Outbreak Feed & Filters */}
        <div className="feed-wrapper card">
          {/* Filter Bar */}
          <div className="feed-header">
            <h3 className="feed-title">{t.liveFeed}</h3>
            <span className="badge-feed-count">{filtered.length}</span>
          </div>

          <div className="filter-controls">
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />

            <div className="severity-filter-chips">
              {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
                <button
                  key={sev}
                  type="button"
                  className={`filter-chip chip-${sev.toLowerCase()} ${activeFilter === sev ? 'active' : ''}`}
                  onClick={() => setActiveFilter(sev)}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          {/* Incident Feed List */}
          <div className="feed-list-scroll">
            {filtered.length === 0 ? (
              <div className="empty-feed">
                <span>🔍</span>
                <p>No incidents match the active filters.</p>
              </div>
            ) : (
              filtered.map((feat) => {
                const p = feat.properties || {};
                const sev = p.severity || 'MEDIUM';
                const coords = feat.geometry?.coordinates || [0, 0];

                return (
                  <div
                    key={feat.id}
                    className={`feed-item feed-item-${sev.toLowerCase()}`}
                    onClick={() => focusOnIncident(feat)}
                  >
                    <div className="feed-item-top">
                      <span className="feed-condition-name">{p.condition}</span>
                      <span className={`badge-severity badge-${sev.toLowerCase()}`}>{sev}</span>
                    </div>

                    <p className="feed-treatment-snip">
                      {(p.treatment_plan || '').substring(0, 95)}...
                    </p>

                    <div className="feed-item-meta">
                      <span>
                        📍 {coords[1].toFixed(2)}°, {coords[0].toFixed(2)}°
                      </span>
                      <span>{Math.round((p.confidence || 0.9) * 100)}% Conf</span>
                      <span>{new Date(p.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

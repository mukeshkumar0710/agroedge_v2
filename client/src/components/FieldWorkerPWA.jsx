import React, { useState, useEffect, useRef } from 'react';
import { saveOfflineIncident, getAllOfflineIncidents, removeOfflineIncident } from '../services/idb';
import { submitDiagnosis } from '../services/api';

export default function FieldWorkerPWA({
  currentLang,
  isOnline,
  t,
  onIncidentCreated,
  pendingCount,
  setPendingCount
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [coords, setCoords] = useState({ lat: 20.5937, lng: 78.9629, approx: true });
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [latestDiagnosis, setLatestDiagnosis] = useState(null);
  const [offlineQueue, setOfflineQueue] = useState([]);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');
  const fileInputRef = useRef(null);

  // Load offline queue on mount
  useEffect(() => {
    loadOfflineQueue();
    acquireLocation();
  }, []);

  const loadOfflineQueue = async () => {
    try {
      const items = await getAllOfflineIncidents();
      setOfflineQueue(items);
      setPendingCount(items.length);
    } catch (e) {
      console.warn('[IDB] Failed to load offline items:', e);
    }
  };

  const acquireLocation = () => {
    if (!('geolocation' in navigator)) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          approx: false
        });
        setIsLocating(false);
      },
      (err) => {
        console.warn('[GPS] Using default regional coordinates:', err.message);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  // Convert File to compressed DataURL for safe offline IndexedDB storage
  const fileToDataUrl = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  };

  // Convert stored DataURL back to Blob for transmission
  const dataUrlToBlob = async (dataUrl) => {
    const res = await fetch(dataUrl);
    return res.blob();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please select or capture a crop leaf image first.');
      return;
    }

    setIsSubmitting(true);
    setSyncStatusMsg('');
    const incidentId = `edge-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    if (!isOnline) {
      // Offline mode: Save to IndexedDB
      try {
        const dataUrl = await fileToDataUrl(selectedFile);
        const offlineRecord = {
          client_incident_id: incidentId,
          latitude: coords.lat,
          longitude: coords.lng,
          language_code: currentLang,
          captured_at: nowIso,
          imageDataUrl: dataUrl,
          filename: selectedFile.name || 'leaf_capture.jpg'
        };
        await saveOfflineIncident(offlineRecord);
        await loadOfflineQueue();
        setSyncStatusMsg('Saved to offline storage. Will automatically sync when back online.');
        resetForm();
      } catch (err) {
        alert(`Failed to store offline: ${err.message}`);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Online mode: Submit to Express + MongoDB backend
    try {
      const formData = new FormData();
      formData.append('client_incident_id', incidentId);
      formData.append('latitude', coords.lat.toString());
      formData.append('longitude', coords.lng.toString());
      formData.append('language_code', currentLang);
      formData.append('captured_at', nowIso);
      formData.append('image', selectedFile);

      const result = await submitDiagnosis(formData);

      if (result.diagnosis) {
        setLatestDiagnosis(result.diagnosis);
        if (onIncidentCreated) {
          onIncidentCreated(result.diagnosis);
        }
      }
      resetForm();
    } catch (err) {
      console.error('[Upload Error]', err);
      // Fallback: save offline
      const dataUrl = await fileToDataUrl(selectedFile);
      await saveOfflineIncident({
        client_incident_id: incidentId,
        latitude: coords.lat,
        longitude: coords.lng,
        language_code: currentLang,
        captured_at: nowIso,
        imageDataUrl: dataUrl,
        filename: selectedFile.name
      });
      await loadOfflineQueue();
      setSyncStatusMsg('Network interrupted. Saved to offline queue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSync = async () => {
    if (!isOnline) {
      alert('Device is currently offline. Connect to network to sync.');
      return;
    }

    setIsSubmitting(true);
    setSyncStatusMsg('Syncing pending edge records with MongoDB...');
    let successCount = 0;

    for (const item of offlineQueue) {
      try {
        const blob = await dataUrlToBlob(item.imageDataUrl);
        const formData = new FormData();
        formData.append('client_incident_id', item.client_incident_id);
        formData.append('latitude', item.latitude.toString());
        formData.append('longitude', item.longitude.toString());
        formData.append('language_code', item.language_code);
        formData.append('captured_at', item.captured_at);
        formData.append('image', blob, item.filename);

        await submitDiagnosis(formData);
        await removeOfflineIncident(item.client_incident_id);
        successCount++;
      } catch (err) {
        console.warn(`[Sync Failure for ${item.client_incident_id}]`, err);
      }
    }

    await loadOfflineQueue();
    setSyncStatusMsg(`Successfully synchronized ${successCount} record(s) to MongoDB.`);
    setIsSubmitting(false);
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Text-to-speech for accessible farmer voice guidance
  const speakTreatment = () => {
    if (!latestDiagnosis || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      `${latestDiagnosis.condition}. ${latestDiagnosis.treatment_plan}`
    );
    utterance.lang = currentLang === 'hi' ? 'hi-IN' : currentLang === 'es' ? 'es-ES' : 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="pwa-container">
      {/* Network Banner */}
      <div className={`network-banner ${isOnline ? 'banner-online' : 'banner-offline'}`}>
        <span className="banner-dot"></span>
        <span>{isOnline ? t.online : t.offline}</span>
        {offlineQueue.length > 0 && (
          <span className="queue-pill">
            {offlineQueue.length} {t.queueHeading}
          </span>
        )}
      </div>

      <div className="pwa-grid">
        {/* Left: Capture & Form */}
        <section className="card pwa-capture-card">
          <div className="card-header">
            <h2 className="card-title">{t.captureHeading}</h2>
            <p className="card-desc">{t.captureDesc}</p>
          </div>

          <form onSubmit={handleSubmit} className="capture-form">
            {/* GPS Telemetry Bar */}
            <div className="gps-bar">
              <div className="gps-icon-wrap">📍</div>
              <div className="gps-info">
                <span className="gps-label">WGS84 Coordinates</span>
                <span className="gps-coords">
                  {isLocating
                    ? t.locating
                    : `${coords.lat.toFixed(4)}° N, ${coords.lng.toFixed(4)}° E ${coords.approx ? '(Regional Approx)' : '(GPS Locked)'}`}
                </span>
              </div>
              <button
                type="button"
                className="btn-gps-refresh"
                onClick={acquireLocation}
                title="Refresh GPS"
              >
                🔄
              </button>
            </div>

            {/* Photo Capture Zone */}
            <div
              className={`dropzone ${previewUrl ? 'has-preview' : ''}`}
              onClick={() => fileInputRef.current?.click()}
            >
              {previewUrl ? (
                <div className="preview-container">
                  <img src={previewUrl} alt="Leaf Preview" className="preview-img" />
                  <div className="preview-overlay">
                    <span>Click to change photo</span>
                  </div>
                </div>
              ) : (
                <div className="dropzone-prompt">
                  <div className="camera-icon-wrap">📷</div>
                  <span className="dropzone-primary-text">{t.btnCapture}</span>
                  <span className="dropzone-subtext">JPG, PNG up to 15MB • Edge AI Ready</span>
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                capture="environment"
                className="hidden-file-input"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !selectedFile}
              className="btn btn-primary btn-submit"
            >
              {isSubmitting ? (
                <span className="loading-spinner-wrap">
                  <span className="spinner"></span>
                  {t.diagnosing}
                </span>
              ) : (
                <>
                  <span>🚀</span>
                  <span>{isOnline ? 'Run Neural Diagnosis & Send' : 'Save to Offline Queue'}</span>
                </>
              )}
            </button>

            {syncStatusMsg && <div className="status-message">{syncStatusMsg}</div>}
          </form>
        </section>

        {/* Right: Latest Diagnosis & Offline Queue */}
        <div className="pwa-sidebar-column">
          {/* Latest Diagnosis Result */}
          {latestDiagnosis && (
            <section className="card diagnosis-card animate-fade-in">
              <div className="card-header diagnosis-header">
                <div>
                  <span className="diagnosis-kicker">Instant Neural Triage</span>
                  <h3 className="diagnosis-title">{latestDiagnosis.condition}</h3>
                </div>
                <span className={`badge-severity badge-${latestDiagnosis.severity.toLowerCase()}`}>
                  {latestDiagnosis.severity}
                </span>
              </div>

              <div className="diagnosis-metrics">
                <div className="metric-item">
                  <span className="metric-label">{t.confidenceScore}</span>
                  <div className="confidence-meter-wrap">
                    <div
                      className="confidence-fill"
                      style={{ width: `${Math.round(latestDiagnosis.confidence * 100)}%` }}
                    ></div>
                  </div>
                  <span className="metric-val">{Math.round(latestDiagnosis.confidence * 100)}%</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Category</span>
                  <span className="metric-val-text">{latestDiagnosis.category || 'Pathology'}</span>
                </div>
              </div>

              <div className="treatment-box">
                <div className="treatment-header">
                  <span className="treatment-icon">📋</span>
                  <span className="treatment-title">{t.treatmentPlan}</span>
                  <button
                    type="button"
                    className="btn-voice-read"
                    onClick={speakTreatment}
                    title="Read Aloud in Selected Language"
                  >
                    🔊 Voice
                  </button>
                </div>
                <p className="treatment-text">{latestDiagnosis.treatment_plan}</p>
              </div>

              <div className="diagnosis-footer">
                <span>Ref: #{latestDiagnosis.incident_id || 'IDG-99'}</span>
                <span>{new Date(latestDiagnosis.timestamp).toLocaleTimeString()}</span>
              </div>
            </section>
          )}

          {/* Offline Pending Queue */}
          <section className="card queue-card">
            <div className="queue-header">
              <div>
                <h3 className="queue-title">{t.queueHeading}</h3>
                <span className="queue-subtitle">
                  {offlineQueue.length} {offlineQueue.length === 1 ? 'item' : 'items'} awaiting MongoDB sync
                </span>
              </div>
              {offlineQueue.length > 0 && isOnline && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-sync"
                  onClick={handleManualSync}
                  disabled={isSubmitting}
                >
                  ⚡ {t.btnSyncNow}
                </button>
              )}
            </div>

            {offlineQueue.length === 0 ? (
              <div className="empty-queue">
                <span className="empty-icon">✅</span>
                <p>{t.noIncidents}</p>
              </div>
            ) : (
              <div className="queue-list">
                {offlineQueue.map((item) => (
                  <div key={item.client_incident_id} className="queue-item">
                    <img src={item.imageDataUrl} alt="Thumb" className="queue-thumb" />
                    <div className="queue-info">
                      <span className="queue-id">{item.client_incident_id}</span>
                      <span className="queue-meta">
                        {item.latitude.toFixed(2)}°, {item.longitude.toFixed(2)}° •{' '}
                        {new Date(item.captured_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <span className="queue-status-tag">Pending</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

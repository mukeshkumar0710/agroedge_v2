import React from 'react';

export default function IncidentDetailModal({ incident, onClose, currentLang }) {
  if (!incident) return null;

  const props = incident.properties || {};
  const coords = incident.geometry?.coordinates || [0, 0];
  const severity = props.severity || 'MEDIUM';

  const speakTreatment = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      `${props.condition}. Severity: ${severity}. ${props.treatment_plan}`
    );
    utterance.lang = currentLang === 'hi' ? 'hi-IN' : currentLang === 'es' ? 'es-ES' : 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content animate-scale-up" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <span className="modal-kicker">Geospatial Incident Telemetry</span>
            <h2 className="modal-title">{props.condition}</h2>
          </div>
          <button type="button" className="btn-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Badges & Meta */}
        <div className="modal-meta-strip">
          <span className={`badge-severity badge-${severity.toLowerCase()}`}>
            {severity}
          </span>
          <span className="meta-pill">Category: {props.category || 'Agronomy'}</span>
          <span className="meta-pill">Confidence: {Math.round((props.confidence || 0.9) * 100)}%</span>
          <span className="meta-pill">Language: {props.language || 'en'}</span>
        </div>

        {/* Spatial Coordinates */}
        <div className="modal-coords-box">
          <span className="coords-icon">📍</span>
          <div>
            <strong>Coordinates:</strong> {coords[1].toFixed(5)}° N, {coords[0].toFixed(5)}° E
          </div>
          <div className="time-badge">
            {new Date(props.timestamp).toLocaleString()}
          </div>
        </div>

        {/* Treatment Plan */}
        <div className="modal-treatment-box">
          <div className="treatment-header">
            <span className="treatment-icon">📋</span>
            <span className="treatment-title">Prescription & Emergency Field Action</span>
            <button
              type="button"
              className="btn-voice-read"
              onClick={speakTreatment}
              title="Voice Readout"
            >
              🔊 Read Aloud
            </button>
          </div>
          <p className="modal-treatment-text">{props.treatment_plan}</p>
        </div>

        {/* Tech Details */}
        <div className="modal-tech-details">
          <span>Agent Node: {props.agent_id || 'field-edge-node'}</span>
          <span>Incident ID: {incident.id}</span>
          <span>Payload Size: {props.file_size_kb || 250} KB</span>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * AgroEdge Express API Client Service.
 */

const API_BASE = '/api/v1';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function fetchGeoJSON() {
  const res = await fetch(`${API_BASE}/incidents/geojson`);
  if (!res.ok) throw new Error('Failed to fetch GeoJSON telemetry');
  return res.json();
}

export async function fetchIncidentById(id) {
  const res = await fetch(`${API_BASE}/incidents/${id}`);
  if (!res.ok) throw new Error('Incident not found');
  return res.json();
}

export async function submitDiagnosis(formData) {
  const res = await fetch(`${API_BASE}/diagnose-and-report`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Ingestion failed: ${errorText}`);
  }

  return res.json();
}

export async function simulateFieldIncident(payload = {}) {
  const res = await fetch(`${API_BASE}/simulate-incident`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error('Simulation failed');
  return res.json();
}

export async function clearAllIncidents() {
  const res = await fetch(`${API_BASE}/incidents`, {
    method: 'DELETE'
  });
  return res.json();
}

export function subscribeToSSEStream(onFeatureReceived, onStatusChange) {
  const sseUrl = `${API_BASE}/dashboard/stream`;
  let eventSource = null;
  let retryTimeout = null;

  function connect() {
    eventSource = new EventSource(sseUrl);

    eventSource.onopen = () => {
      if (onStatusChange) onStatusChange('connected');
    };

    eventSource.onmessage = (event) => {
      try {
        if (!event.data || event.data.trim() === '{}') return;
        const feature = JSON.parse(event.data);
        if (feature && feature.geometry && feature.properties) {
          onFeatureReceived(feature);
        }
      } catch (err) {
        console.warn('[SSE Parse Error]', err);
      }
    };

    eventSource.onerror = () => {
      if (onStatusChange) onStatusChange('disconnected');
      eventSource.close();
      retryTimeout = setTimeout(connect, 4000);
    };
  }

  connect();

  return () => {
    if (eventSource) eventSource.close();
    if (retryTimeout) clearTimeout(retryTimeout);
  };
}

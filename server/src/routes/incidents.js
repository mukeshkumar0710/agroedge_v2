/**
 * Incident Ingestion, Geospatial Retrieval, Simulation, and SSE Streaming Routes.
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const incidentStore = require('../services/store');
const { mlClassifier } = require('../services/mlPipeline');
const { getLocalizedTreatment } = require('../services/localization');
const sseManager = require('../services/sseManager');

// Memory storage for multer so we can pass Buffer directly to ML classifier
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_IMAGE_SIZE_BYTES || '15728640', 10) // 15MB default
  }
});

/**
 * Primary edge PWA ingestion endpoint.
 * Evaluates edge crop image via ML pipeline, generates localized treatment,
 * persists GeoJSON feature to MongoDB with idempotency, and broadcasts to dashboard.
 */
router.post('/diagnose-and-report', upload.single('image'), async (req, res) => {
  try {
    const clientIncidentId = req.body.client_incident_id || req.body.incident_id || `edge-${uuidv4().substring(0, 8)}`;
    const latitude = parseFloat(req.body.latitude || req.body.lat || '20.5937');
    const longitude = parseFloat(req.body.longitude || req.body.lng || '78.9629');
    const languageCode = req.body.language_code || req.body.lang || 'en';
    const capturedAt = req.body.captured_at || new Date().toISOString();

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ error: 'Valid latitude and longitude are required.' });
    }

    // 1. Idempotency Check
    const isDup = await incidentStore.isDuplicate(clientIncidentId);
    if (isDup) {
      const existing = await incidentStore.getIncidentById(clientIncidentId);
      return res.status(200).json({
        client_incident_id: clientIncidentId,
        status: 'acknowledged_duplicate',
        message: 'Incident has already been processed and recorded in MongoDB.',
        received_at: new Date().toISOString(),
        diagnosis: existing ? existing.properties : null
      });
    }

    // 2. Machine Learning Inspection
    const imageBuffer = req.file ? req.file.buffer : Buffer.alloc(0);
    const mlResult = await mlClassifier.predictImage(imageBuffer);

    // 3. Derived Localized Treatment
    const localized = getLocalizedTreatment(mlResult.condition, languageCode);

    // 4. Build GeoJSON Feature (RFC 7946 coordinates: [longitude, latitude])
    const featureData = {
      id: clientIncidentId,
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [longitude, latitude]
      },
      properties: {
        incident_id: clientIncidentId,
        condition: localized.title,
        category: mlResult.category,
        confidence: mlResult.confidence,
        severity: mlResult.severity,
        treatment_plan: localized.treatment_plan,
        language: localized.language_applied,
        timestamp: capturedAt,
        reported_lat: latitude,
        reported_lng: longitude,
        agent_id: req.body.agent_id || 'field-pwa-edge',
        file_size_kb: mlResult.fileSizeKb,
        dimensions: mlResult.dimensions
      }
    };

    // 5. Persist to MongoDB (Upsert guarantees strict idempotency)
    await incidentStore.saveIncident(featureData);

    // 6. Broadcast to live Government Command Dashboards
    sseManager.broadcastFeature(featureData);

    return res.status(200).json({
      client_incident_id: clientIncidentId,
      status: 'queued',
      message: 'Neural classification and localized triage generated successfully in MongoDB.',
      received_at: new Date().toISOString(),
      diagnosis: featureData.properties
    });
  } catch (error) {
    console.error(`[Ingestion Error] ${error.message}`);
    return res.status(500).json({ error: `Inference and ingestion failure: ${error.message}` });
  }
});

/**
 * Returns RFC 7946 GeoJSON FeatureCollection from MongoDB.
 */
router.get('/incidents/geojson', async (req, res) => {
  try {
    const features = await incidentStore.getAllIncidents();
    return res.json({
      type: 'FeatureCollection',
      features
    });
  } catch (error) {
    console.error(`[GeoJSON Retrieval Error] ${error.message}`);
    return res.status(500).json({ error: 'Failed to retrieve GeoJSON from MongoDB.' });
  }
});

/**
 * Retrieves a single incident by ID.
 */
router.get('/incidents/:id', async (req, res) => {
  try {
    const incident = await incidentStore.getIncidentById(req.params.id);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    return res.json(incident);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Purges all stored incidents in MongoDB.
 */
const clearAllHandler = async (req, res) => {
  try {
    await incidentStore.clearAll();
    return res.json({
      status: 'cleared',
      message: 'All database incident records purged successfully from MongoDB.',
      total_incidents: 0
    });
  } catch (error) {
    return res.status(500).json({ error: `Failed to clear MongoDB records: ${error.message}` });
  }
};

router.post('/incidents/clear', clearAllHandler);
router.delete('/incidents', clearAllHandler);

/**
 * Tactical Field Simulation Endpoint.
 * Generates synthetic telemetry and pumps it into MongoDB and SSE stream.
 */
router.post('/simulate-incident', async (req, res) => {
  try {
    const simId = `sim-${uuidv4().substring(0, 8)}`;
    const lat = req.body.latitude !== undefined && req.body.latitude !== null
      ? parseFloat(req.body.latitude)
      : 12.0 + Math.random() * 18.0; // Random coordinate across India
    const lng = req.body.longitude !== undefined && req.body.longitude !== null
      ? parseFloat(req.body.longitude)
      : 72.0 + Math.random() * 16.0;

    const condition = req.body.condition || 'PestInfestation';
    const severity = (req.body.severity || 'HIGH').toUpperCase();
    const language = req.body.language_code || 'en';

    const localized = getLocalizedTreatment(condition, language);

    const feature = {
      id: simId,
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [lng, lat]
      },
      properties: {
        incident_id: simId,
        condition: localized.title,
        category: 'Simulation',
        confidence: parseFloat((0.88 + Math.random() * 0.11).toFixed(2)),
        severity: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(severity) ? severity : 'HIGH',
        treatment_plan: localized.treatment_plan,
        language: localized.language_applied,
        timestamp: new Date().toISOString(),
        reported_lat: lat,
        reported_lng: lng,
        agent_id: 'test-simulator',
        file_size_kb: 215.4,
        dimensions: '1280x720'
      }
    };

    await incidentStore.saveIncident(feature);
    sseManager.broadcastFeature(feature);

    return res.json({
      status: 'broadcasted',
      feature
    });
  } catch (error) {
    return res.status(500).json({ error: `Simulation failed: ${error.message}` });
  }
});

/**
 * Server-Sent Events (SSE) Stream for real-time telemetry updates.
 */
router.get('/dashboard/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  sseManager.addClient(res);
});

module.exports = router;

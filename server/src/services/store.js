/**
 * Resilient Hybrid Storage Repository for AgroEdge.
 * Automatically switches between MongoDB (primary) and In-Memory Buffer (fallback)
 * to guarantee 100% service uptime even during MongoDB Atlas network reconnects.
 */
const mongoose = require('mongoose');
const Incident = require('../models/Incident');
const { isConnected } = require('../config/db');
const { getLocalizedTreatment } = require('./localization');

class IncidentRepository {
  constructor() {
    this.memoryStore = new Map(); // id -> feature object
    this.initDefaultMemorySamples();
  }

  initDefaultMemorySamples() {
    const samples = [
      {
        id: 'init-inc-001',
        lat: 30.7333, lng: 76.7794,
        condition: 'BacterialBlight',
        category: 'Bacteriology',
        severity: 'CRITICAL',
        confidence: 0.96,
        lang: 'en'
      },
      {
        id: 'init-inc-002',
        lat: 30.9010, lng: 75.8573,
        condition: 'PestInfestation',
        category: 'Entomology',
        severity: 'HIGH',
        confidence: 0.91,
        lang: 'hi'
      },
      {
        id: 'init-inc-003',
        lat: 18.5204, lng: 73.8567,
        condition: 'EarlyBlightFungus',
        category: 'Mycology',
        severity: 'HIGH',
        confidence: 0.88,
        lang: 'en'
      },
      {
        id: 'init-inc-004',
        lat: 19.9975, lng: 73.7898,
        condition: 'NutrientChlorosis',
        category: 'Agronomy',
        severity: 'MEDIUM',
        confidence: 0.89,
        lang: 'hi'
      },
      {
        id: 'init-inc-005',
        lat: 11.0168, lng: 76.9558,
        condition: 'PestInfestation',
        category: 'Entomology',
        severity: 'HIGH',
        confidence: 0.94,
        lang: 'ta'
      },
      {
        id: 'init-inc-006',
        lat: 13.0827, lng: 80.2707,
        condition: 'HealthySample',
        category: 'Baseline',
        severity: 'LOW',
        confidence: 0.99,
        lang: 'ta'
      },
      {
        id: 'init-inc-007',
        lat: 17.3850, lng: 78.4867,
        condition: 'BacterialBlight',
        category: 'Bacteriology',
        severity: 'CRITICAL',
        confidence: 0.93,
        lang: 'te'
      },
      {
        id: 'init-inc-008',
        lat: 22.5726, lng: 88.3639,
        condition: 'EarlyBlightFungus',
        category: 'Mycology',
        severity: 'HIGH',
        confidence: 0.87,
        lang: 'bn'
      }
    ];

    const now = new Date().toISOString();
    samples.forEach((s) => {
      const loc = getLocalizedTreatment(s.condition, s.lang);
      this.memoryStore.set(s.id, {
        id: s.id,
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [s.lng, s.lat]
        },
        properties: {
          incident_id: s.id,
          condition: loc.title,
          category: s.category,
          confidence: s.confidence,
          severity: s.severity,
          treatment_plan: loc.treatment_plan,
          language: s.lang,
          timestamp: now,
          reported_lat: s.lat,
          reported_lng: s.lng,
          agent_id: 'seed-historical',
          file_size_kb: 320.4,
          dimensions: '1280x720'
        }
      });
    });
  }

  async isDuplicate(id) {
    if (this.memoryStore.has(id)) return true;
    if (isConnected()) {
      try {
        const doc = await Incident.findOne({ id }).select('id').lean();
        return doc !== null;
      } catch {
        return false;
      }
    }
    return false;
  }

  async saveIncident(featureData) {
    // Keep in memory
    this.memoryStore.set(featureData.id, featureData);

    // Persist to MongoDB if connected
    if (isConnected()) {
      try {
        await Incident.findOneAndUpdate(
          { id: featureData.id },
          featureData,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } catch (err) {
        console.warn(`[Storage Warning] MongoDB write failed, preserved in memory buffer: ${err.message}`);
      }
    }

    return featureData;
  }

  async getAllIncidents() {
    if (isConnected()) {
      try {
        const docs = await Incident.find({}).sort({ 'properties.timestamp': -1 }).limit(5000).lean();
        if (docs && docs.length > 0) {
          // Sync into memory cache
          docs.forEach((d) => this.memoryStore.set(d.id, d));
          return docs.map((d) => {
            delete d._id;
            delete d.__v;
            return d;
          });
        }
      } catch (err) {
        console.warn(`[Storage Warning] MongoDB read failed, falling back to memory store: ${err.message}`);
      }
    }

    // Fallback: return in-memory items sorted by timestamp desc
    return Array.from(this.memoryStore.values()).sort((a, b) => {
      const tA = new Date(a.properties?.timestamp || 0).getTime();
      const tB = new Date(b.properties?.timestamp || 0).getTime();
      return tB - tA;
    });
  }

  async getIncidentById(id) {
    if (isConnected()) {
      try {
        const doc = await Incident.findOne({ id }).lean();
        if (doc) {
          delete doc._id;
          delete doc.__v;
          return doc;
        }
      } catch {
        // Fallback
      }
    }
    return this.memoryStore.get(id) || null;
  }

  async clearAll() {
    this.memoryStore.clear();
    if (isConnected()) {
      try {
        await Incident.deleteMany({});
      } catch (err) {
        console.warn(`[Storage Warning] MongoDB delete failed: ${err.message}`);
      }
    }
  }

  async count() {
    if (isConnected()) {
      try {
        return await Incident.countDocuments();
      } catch {
        return this.memoryStore.size;
      }
    }
    return this.memoryStore.size;
  }

  /**
   * Called when MongoDB connection is established to flush memory buffer into MongoDB.
   */
  async flushBufferToMongoDB() {
    if (!isConnected() || this.memoryStore.size === 0) return;
    try {
      const items = Array.from(this.memoryStore.values());
      for (const item of items) {
        await Incident.findOneAndUpdate(
          { id: item.id },
          item,
          { upsert: true }
        );
      }
      console.log(`[Storage] Synced ${items.length} telemetry records to MongoDB.`);
    } catch (err) {
      console.warn(`[Storage Warning] Sync to MongoDB failed: ${err.message}`);
    }
  }
}

const incidentStore = new IncidentRepository();

module.exports = incidentStore;

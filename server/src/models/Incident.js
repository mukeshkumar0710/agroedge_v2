/**
 * Mongoose Incident Schema conforming to RFC 7946 GeoJSON Specification.
 * Includes 2dsphere indexing for high-performance spatial queries,
 * unique incident identifier for idempotency, and descending timestamp indexing.
 */
const mongoose = require('mongoose');

const GeometrySchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Point'],
    default: 'Point',
    required: true
  },
  // RFC 7946 specifies coordinates as [longitude, latitude]
  coordinates: {
    type: [Number],
    required: true,
    validate: {
      validator: function (v) {
        return Array.isArray(v) && v.length === 2 && !isNaN(v[0]) && !isNaN(v[1]);
      },
      message: 'Coordinates must be an array of two numbers: [longitude, latitude]'
    }
  }
}, { _id: false });

const IncidentPropertiesSchema = new mongoose.Schema({
  incident_id: {
    type: String,
    required: true,
    index: true
  },
  condition: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  severity: {
    type: String,
    enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
    required: true
  },
  treatment_plan: {
    type: String,
    required: true
  },
  language: {
    type: String,
    default: 'en'
  },
  timestamp: {
    type: String,
    required: true,
    index: true
  },
  reported_lat: {
    type: Number,
    required: true
  },
  reported_lng: {
    type: Number,
    required: true
  },
  agent_id: {
    type: String,
    default: 'field-pwa-edge'
  },
  file_size_kb: {
    type: Number,
    default: 0
  },
  dimensions: {
    type: String,
    default: '640x480'
  }
}, { _id: false });

const IncidentSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  type: {
    type: String,
    default: 'Feature',
    enum: ['Feature']
  },
  geometry: {
    type: GeometrySchema,
    required: true
  },
  properties: {
    type: IncidentPropertiesSchema,
    required: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function (doc, ret) {
      delete ret._id;
      delete ret.__v;
      delete ret.createdAt;
      delete ret.updatedAt;
      return ret;
    }
  }
});

// Spatial index for Leaflet bounding box / proximity queries
IncidentSchema.index({ geometry: '2dsphere' }, { name: 'idx_geometry_2dsphere' });
IncidentSchema.index({ 'properties.timestamp': -1 }, { name: 'idx_timestamp_desc' });

const Incident = mongoose.model('Incident', IncidentSchema);

module.exports = Incident;

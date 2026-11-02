/**
 * Health & Telemetry Status Routes.
 */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const incidentStore = require('../services/store');
const sseManager = require('../services/sseManager');
const { isConnected } = require('../config/db');

router.get('/health', async (req, res) => {
  const dbConnected = isConnected();
  const incidentCount = await incidentStore.count();

  const status = {
    status: dbConnected ? 'healthy' : 'operational_hybrid',
    service: 'AgroEdge MERN Stack API & Geospatial Command Hub',
    stack: 'MERN (MongoDB, Express, React, Node.js)',
    database: {
      type: 'MongoDB',
      connected: dbConnected,
      readyState: mongoose.connection.readyState,
      persisted_incidents: incidentCount,
      cloud_ready: true
    },
    active_sse_subscribers: sseManager.getSubscriberCount(),
    uptime_seconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  };

  // Return HTTP 200 so monitoring tools and dashboards recognize it as operational
  res.status(200).json(status);
});

module.exports = router;

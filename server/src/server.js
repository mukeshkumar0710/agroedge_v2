/**
 * AgroEdge MERN Stack Server Entrypoint.
 * Express.js REST API + Server-Sent Events with MongoDB (Mongoose) persistence.
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment configuration from root or local .env
const rootEnvPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
} else {
  dotenv.config();
}

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { connectDB } = require('./config/db');
const { seedInitialData } = require('./services/seedData');
const healthRoutes = require('./routes/health');
const incidentRoutes = require('./routes/incidents');

const app = express();
const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || '0.0.0.0';

// Global Middlewares
app.use(cors({
  origin: process.env.CORS_ORIGINS === '*' ? '*' : (process.env.CORS_ORIGINS || '*').split(','),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('short'));
}

// Favicon inline SVG responder
app.get('/favicon.ico', (req, res) => {
  res.type('image/svg+xml');
  res.send("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='#10b981'/><path d='M35 50 L45 60 L68 35' stroke='white' stroke-width='8' fill='none' stroke-linecap='round'/></svg>");
});

// API Routes
app.use('/api/v1', healthRoutes);
app.use('/api/v1', incidentRoutes);

// Root informational endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'AgroEdge MERN Stack API Services',
    version: '2.0.0',
    documentation: '/api/v1/health',
    endpoints: {
      health: 'GET /api/v1/health',
      diagnoseAndReport: 'POST /api/v1/diagnose-and-report',
      geojsonIncidents: 'GET /api/v1/incidents/geojson',
      singleIncident: 'GET /api/v1/incidents/:id',
      simulateIncident: 'POST /api/v1/simulate-incident',
      streamSSE: 'GET /api/v1/dashboard/stream',
      clearIncidents: 'DELETE /api/v1/incidents'
    }
  });
});

// Serve compiled React client in production if client/dist exists
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  console.log(`[Static] Serving React application bundle from: ${clientDistPath}`);
  app.use(express.static(clientDistPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Global 404 Handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `Endpoint ${req.originalUrl} not found` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Server Bootstrap
const startServer = async () => {
  const incidentStore = require('./services/store');
  const conn = await connectDB();
  if (conn) {
    await seedInitialData();
    await incidentStore.flushBufferToMongoDB();
  }

  app.listen(PORT, HOST, () => {
    console.log(`=======================================================`);
    console.log(`🌿 AgroEdge MERN Stack Express API Gateway`);
    console.log(`📡 URL: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    console.log(`🩺 Health Check: http://localhost:${PORT}/api/v1/health`);
    console.log(`🗺️  GeoJSON Feed: http://localhost:${PORT}/api/v1/incidents/geojson`);
    console.log(`=======================================================`);
  });
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = { app, startServer };

# AgroEdge: MERN Stack Edge PWA & Geospatial Outbreak Command Hub

A production-grade, highly accessible, multi-lingual Full-Stack **MERN** application (**M**ongoDB Atlas, **E**xpress.js, **R**eact.js, **N**ode.js).

AgroEdge combines an offline-first Edge PWA for farmers/field workers with an asynchronous Machine Learning disease classification pipeline and a real-time National Outbreak Command Center powered by Leaflet GIS and Server-Sent Events (SSE).

---

## 🏛️ MERN Stack Architecture

```
 ┌────────────────────────────────────────────────────────┐
 │               REACT 18 CLIENT (Vite PWA)               │
 │  - Edge Photo Capture & Foliage Inspection             │
 │  - Geolocation API (WGS84 Lat/Lng Coordinates)         │
 │  - Offline-first IndexedDB Store (Auto/Manual Sync)    │
 │  - Multi-Lingual Engine (EN, HI, TA, TE, ES, BN)       │
 │  - SpeechSynthesis Audio Remedy Readout                │
 │  - Interactive Leaflet Dark GIS Map & Radar Pings      │
 └────────────────────────────┬───────────────────────────┘
                              │ HTTPS / REST + SSE (/dashboard/stream)
                              ▼
 ┌────────────────────────────────────────────────────────┐
 │               EXPRESS.JS & NODE.JS BACKEND             │
 │  - RESTful API Ingestion with Multer File Streaming    │
 │  - Strict Idempotency Deduplication Cache              │
 │  - Asynchronous ML Spectral & Pathology Classifier    │
 │  - Real-Time SSE Event Broker & Keepalive Heartbeat    │
 └────────────────────────────┬───────────────────────────┘
                              │ Mongoose ODM & 2dsphere Spatial Indexing
                              ▼
 ┌────────────────────────────────────────────────────────┐
 │            MONGODB ATLAS (Cloud Database)              │
 │  - GeoJSON RFC 7946 Features & 2dsphere Geometry Index │
 │  - Cloud Cluster with Connection Pooling & Auto-Retry  │
 │  - Resilient In-Memory Buffer Fallback Mechanism       │
 └────────────────────────────────────────────────────────┘
```

---

## 📦 Directory Structure

```
d:/FSD/
├── server/                    # Node.js + Express + Mongoose Backend
│   ├── package.json           # Express, Mongoose, Multer, Morgan, UUID, Dotenv
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js          # MongoDB Mongoose connection manager (Atlas support)
│   │   ├── models/
│   │   │   └── Incident.js    # RFC 7946 GeoJSON Mongoose model with 2dsphere index
│   │   ├── services/
│   │   │   ├── mlPipeline.js  # Neural pathology inspection & confidence scoring
│   │   │   ├── localization.js# Multi-lingual clinical triage (EN, HI, TA, TE, ES, BN)
│   │   │   ├── sseManager.js  # Server-Sent Events real-time broadcast engine
│   │   │   ├── store.js       # Resilient storage repository (Mongo + Memory buffer)
│   │   │   └── seedData.js    # Historical agricultural telemetry seeder
│   │   ├── routes/
│   │   │   ├── health.js      # Health status and database monitoring
│   │   │   └── incidents.js   # Ingestion, GeoJSON, simulation & SSE endpoints
│   │   └── server.js          # Express app entrypoint & React static file server
│   └── test/
│       └── api.test.js        # Automated unit and integration test suite
├── client/                    # React 18 + Vite Frontend Application
│   ├── package.json           # React 18, Leaflet, Vite
│   ├── vite.config.js         # Vite configuration with Express API proxy
│   ├── index.html             # HTML template with Leaflet & Google Fonts Inter
│   ├── public/
│   │   ├── manifest.json      # Progressive Web App manifest
│   │   └── favicon.svg        # AgroEdge SVG emblem
│   └── src/
│       ├── main.jsx           # React DOM root entrypoint
│       ├── App.jsx            # State coordinator, SSE listener & tab routing
│       ├── App.css            # Dark glassmorphic design system & WCAG AA contrast
│       ├── i18n/
│       │   └── translations.js# Client translations (EN, HI, TA, TE, ES, BN)
│       ├── services/
│       │   ├── api.js         # Express REST & SSE stream subscriber
│       │   ├── idb.js         # Offline IndexedDB storage wrapper
│       │   └── audio.js       # Web Audio API radar ping synthesizer
│       └── components/
│           ├── Navbar.jsx               # MERN badges, live indicators & language switch
│           ├── FieldWorkerPWA.jsx       # Camera capture, GPS, offline queue & diagnosis
│           ├── CommandDashboard.jsx     # Leaflet GIS map, KPIs, SSE feed & simulator
│           └── IncidentDetailModal.jsx  # Detailed clinical triage & voice readout
├── .env                       # Root environment configuration (MongoDB Atlas URI)
├── .env.example               # Reference environment template
├── package.json               # Root scripts to run full MERN dev / build / start
├── Dockerfile                 # Multi-stage container: React Vite builder + Node runtime
├── docker-compose.yml         # Container orchestration for MongoDB & MERN App
└── README.md                  # System documentation
```

---

## ⚡ Quick Start

### 1. Configure MongoDB Atlas

Open `.env` in the project root and configure your **MongoDB Atlas** connection string:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-name>.mongodb.net/agroedge_db?retryWrites=true&w=majority
```

> **Tip:** You can also use a local MongoDB instance: `mongodb://127.0.0.1:27017/agroedge_db`. AgroEdge includes an automated in-memory buffer fallback to keep the service operational even during cloud network transitions.

---

### 2. Install Dependencies

Install both server and client packages with one command from the project root:

```bash
npm run install:all
```

Or individually:
```bash
npm install --prefix server
npm install --prefix client
```

---

### 3. Start Development Servers

Run both the **Express Backend** (port 8000) and **React Vite Client** (port 5173) concurrently:

```bash
npm run dev
```

- **React Development UI:** [http://localhost:5173/](http://localhost:5173/)
- **Express API Gateway:** [http://localhost:8000/api](http://localhost:8000/api)
- **Health Check:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health)

---

### 4. Build & Production Deployment

To compile the React client and serve it directly from the Node.js Express server:

```bash
# Build the React production bundle
npm run build

# Start the unified production server
npm start
```

Access the unified production app at: [http://localhost:8000/](http://localhost:8000/)

---

### 5. Run Automated Test Suite

Execute the comprehensive automated test suite validating ML inference, localization, GeoJSON RFC 7946 compliance, Express endpoints, and React static delivery:

```bash
npm test --prefix server
```

---

## 🛰️ REST API & SSE Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/health` | System health, MongoDB Atlas connection status, incident count |
| `POST` | `/api/v1/diagnose-and-report` | Primary edge ingestion (Multipart form with photo + GPS coords) |
| `GET` | `/api/v1/incidents/geojson` | Returns RFC 7946 GeoJSON FeatureCollection for Leaflet GIS |
| `GET` | `/api/v1/incidents/:id` | Detailed diagnostic record and localized treatment plan by ID |
| `POST` | `/api/v1/simulate-incident` | Tactical simulation: injects synthetic telemetry into MongoDB & SSE |
| `GET` | `/api/v1/dashboard/stream` | Server-Sent Events (SSE) live telemetry stream with keepalive pings |
| `DELETE` | `/api/v1/incidents` | Purges all telemetry incident records from MongoDB |

---

## 🌾 Key Features

1. **Edge PWA (Field Worker App):**
   - Instant edge leaf capture with auto GPS positioning.
   - Offline-First: captures are safely stored in IndexedDB when disconnected and synced automatically upon reconnection.
   - Multi-lingual clinical diagnosis in 6 languages with Text-to-Speech audio readout for farmers.

2. **Tactical GIS Command Center:**
   - Leaflet interactive map with CartoDB Dark Matter tiles.
   - Dynamic outbreak markers colored by severity (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) with radar pulsing animation.
   - Live SSE Telemetry Activity Feed updating in real-time without polling.
   - KPI counters: Total Incidents, Critical Outbreaks, Average Neural Confidence, Threat Level.
   - Data Export tools: One-click export to GeoJSON and CSV.
   - Tactical field outbreak simulation button for demonstrations.

---

## 🐳 Docker Deployment

To launch the complete environment using Docker Compose:

```bash
docker compose up --build
```

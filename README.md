# AgroEdge: Edge PWA, Async ML Pipeline & Geospatial Command Hub

A production-grade, highly accessible, multi-lingual Progressive Web App (PWA) with offline-first capabilities that handles edge image capture, pipes data to an asynchronous ML microservice for instant localized treatment plans, and maps geospatial data onto a real-time government analytical command dashboard.

---

## 🏛️ System Architecture

```
 ┌────────────────────────────────────────────────────────┐
 │                   EDGE CLIENT (PWA)                    │
 │  [Camera/Input] ──► [Geolocation API] ──► [IndexedDB] │
 │                            │               ▲           │
 │                            ▼               │ retry     │
 │                   [Background Sync / SW] ──┘           │
 └────────────────────────────┬───────────────────────────┘
                              │ HTTPS / Multipart + JSON (Idempotency Key)
                              ▼
 ┌────────────────────────────────────────────────────────┐
 │               FASTAPI ASYNC INGESTION                  │
 │   - Validates Payload & GeoCoordinates                │
 │   - Idempotency Deduplication Cache                    │
 │   - Dispatches Background ML Inference Worker          │
 └────────────────────────────┬───────────────────────────┘
                              │ Non-blocking Background Task
                              ▼
 ┌────────────────────────────────────────────────────────┐
 │           ASYNC ML & LOCALIZATION PIPELINE             │
 │   - Edge Image Inspection (Pillow / ONNX Runtime)      │
 │   - Multi-Lingual Engine (EN, HI, TA, TE, ES, BN)      │
 │   - Generates RFC 7946 Compliant GeoJSON Feature       │
 └────────────────────────────┬───────────────────────────┘
                              │ Server-Sent Events (SSE) Broadcast
                              ▼
 ┌────────────────────────────────────────────────────────┐
 │            GOVERNMENT COMMAND DASHBOARD                │
 │   - Leaflet.js + MarkerCluster Interactive GIS         │
 │   - Real-Time Outbreak Clustering & Heatmap            │
 │   - Live Activity Feed & KPI Counters                  │
 └────────────────────────────────────────────────────────┘
```

---

## 📦 Directory Structure

```
d:/FSD/
├── backend/
│   ├── app.py                 # FastAPI application, CORS, static mounts, API routing, SSE streaming
│   ├── config.py              # Port, host, max upload size, geobound parameters
│   ├── models.py              # Pydantic schemas (RFC 7946 GeoJSON, Ingestion, Simulation)
│   ├── localization.py        # Multi-lingual treatment plans (EN, HI, TA, TE, ES, BN)
│   ├── ml_pipeline.py         # Async ML model runner, feature extraction, and confidence scoring
│   ├── geo_store.py           # In-memory spatial repository & deduplication cache (pre-seeded)
│   └── requirements.txt       # Dependencies list
├── frontend/                  # Accessible, multi-lingual PWA with edge camera & IndexedDB
│   ├── index.html             # High-accessibility UI, WCAG AA compliant, language toggle, camera trigger
│   ├── manifest.json          # PWA Web App Manifest (standalone, theme colors, icons)
│   ├── sw.js                  # Service Worker with Cache-First strategy & Background Sync
│   ├── js/
│   │   ├── app.js             # Main frontend logic, reactive state, online/offline status bar
│   │   ├── idb-store.js       # IndexedDB storage wrapper for offline blobs and metadata
│   │   ├── sync-engine.js     # Hybrid sync engine (Background Sync API + online event fallback)
│   │   └── i18n.js            # Client-side multi-lingual localization dictionary
│   └── css/
│       └── app.css            # Modern glassmorphism, responsive, high-contrast dark theme
├── dashboard/                 # Real-time government analytical command dashboard
│   ├── index.html             # Command dashboard with Leaflet map, KPI cards, outbreak triage feed
│   ├── dashboard.js           # Leaflet map, MarkerCluster, SSE subscriber, filter state, real-time counters
│   └── dashboard.css          # Dark-mode GIS dashboard layout, metric badges, radar ping animation
├── run.py                     # Convenience launcher script
└── README.md                  # This file
```

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
python -m pip install -r backend/requirements.txt
```

### 2. Start the Server
```bash
python run.py
```

### 3. Open in Browser
- **Field Worker PWA:** [http://localhost:8000/](http://localhost:8000/)
- **Government Command Center:** [http://localhost:8000/dashboard](http://localhost:8000/dashboard)
- **Interactive Swagger API Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 📱 Offline-First PWA Workflow
1. **Open the PWA** at `http://localhost:8000/`.
2. Open DevTools (`F12`), navigate to **Network**, and switch throttling to **Offline**.
3. Click **Capture / Select Leaf Image** and select any photo.
4. The image will be:
   - Compressed at the edge to prevent storage blowout.
   - Tagged with GPS coordinates and selected language.
   - Stored in local **IndexedDB** with status `Queued for Sync`.
5. Switch DevTools back to **Online**.
6. The **Hybrid Sync Engine** automatically detects network recovery, drains the offline queue, transmits the payload with its idempotency UUID, and marks it `Synced to Command`.

---

## 🛰️ Real-Time Government Dashboard
1. Open the dashboard at `http://localhost:8000/dashboard`.
2. Observe pre-seeded historical outbreak clusters across regions (Punjab, Maharashtra, Tamil Nadu, etc.).
3. Click **Trigger Simulated Edge Ping** or submit an incident from the PWA.
4. Watch the dashboard update in real-time over the **Server-Sent Events (`/api/v1/dashboard/stream`)** connection:
   - Map smoothly flies to the new outbreak point.
   - Pulsating pin renders with severity color coding.
   - KPI counters update automatically.
   - Localized treatment plan appears in the triage feed.

---

## 🚀 Production Deployment (Docker & Nginx)

For full production rollout instructions, refer to the [Deployment Guide](DEPLOYMENT.md).

### Quick Launch with Docker Compose
```bash
# 1. Prepare environment variables
cp .env.example .env

# 2. Build and launch containers in background
docker compose up -d --build

# 3. Check container health status
docker compose ps
```

The stack launches:
* **`agroedge-app`**: Security-hardened non-root Python 3.11 container running multi-worker Uvicorn.
* **`agroedge-proxy`**: Optimized Nginx alpine reverse proxy configured for unbuffered Server-Sent Events (SSE), PWA Service Worker cache-invalidation headers, and static asset caching.


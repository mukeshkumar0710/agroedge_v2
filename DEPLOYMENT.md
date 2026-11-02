# Production Deployment & Operations Guide: AgroEdge MERN Stack

This guide provides end-to-end instructions for deploying the **AgroEdge MERN Stack (MongoDB Atlas, Express.js, React 18, Node.js)** into production across containerized environments (Docker / Docker Compose), cloud PaaS (Render, Railway, Heroku, AWS ECS), and bare-metal / virtual Linux servers (Ubuntu, Debian, RHEL).

---

## 🏛️ Production Architecture Overview

```
                                ┌───────────────────────────────────┐
                                │          INTERNET / CLIENTS       │
                                │   - Mobile PWA Field Devices      │
                                │   - Government Command Consoles   │
                                └─────────────────┬─────────────────┘
                                                  │ HTTPS (Port 443) / HTTP (Port 80)
                                                  ▼
                                ┌───────────────────────────────────┐
                                │        NGINX REVERSE PROXY        │
                                │  - SSL/TLS Termination            │
                                │  - SSE Buffer Bypass (No buffer)  │
                                │  - Service Worker Cache Control   │
                                │  - Static Asset Gzip Compression  │
                                └─────────────────┬─────────────────┘
                                                  │ HTTP Proxy (Port 8000)
                                                  ▼
                                ┌───────────────────────────────────┐
                                │      NODE.JS EXPRESS SERVER       │
                                │  - Express REST & SSE Streamer    │
                                │  - Serves React 18 SPA (client)   │
                                │  - ML Pathology Inspection Engine │
                                │  - Idempotency Deduplication      │
                                └─────────────────┬─────────────────┘
                                                  │ Mongoose ODM (TLS / SRV)
                                                  ▼
                                ┌───────────────────────────────────┐
                                │      MONGODB ATLAS CLOUD          │
                                │  - GeoJSON RFC 7946 Storage       │
                                │  - 2dsphere Geospatial Indexing   │
                                │  - High Availability Cluster      │
                                └───────────────────────────────────┘
```

---

## 📋 Prerequisites & HTTPS Requirement

> [!IMPORTANT]
> **HTTPS is Mandatory for Production PWAs:**
> Modern mobile and desktop browsers strictly limit **Service Workers** (`/sw.js`) and the **Geolocation API** (`navigator.geolocation`) to Secure Contexts (`localhost` or `https://`). For production domain deployments, SSL/TLS termination via Nginx or Cloudflare is required.

---

## 🚀 Option 1: Native Node.js Production Deployment

### 1. Install Node.js (v18+)
```bash
node -v   # Should be >= 18.0.0
npm -v    # Should be >= 9.0.0
```

### 2. Configure Environment (.env)
```bash
cp .env.example .env
nano .env
```

Ensure your **MongoDB Atlas** connection string is configured:
```env
NODE_ENV=production
PORT=8000
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/agroedge_db?retryWrites=true&w=majority
```

### 3. Install & Build
```bash
# Install all dependencies
npm run install:all

# Build React client bundle
npm run build
```

### 4. Run with Process Manager (PM2)
```bash
npm install -g pm2
pm2 start server/src/server.js --name "agroedge-mern" -i max
pm2 save
pm2 startup
```

---

## 🐳 Option 2: Docker Compose Deployment

Docker Compose launches the full multi-stage container running the Node.js Express server with built React static bundle and reverse proxy:

```bash
docker compose up -d --build
```

Check health:
```bash
docker compose ps
curl http://localhost:8000/api/v1/health
```

---

## 🧪 Validating Deployment

Run the automated test suite to ensure all components are functioning as expected:

```bash
npm test --prefix server
```
Expected output:
```
✔ PASS: ML Pipeline Image Classification
✔ PASS: Multi-Lingual Localization Engine across 6 languages
✔ PASS: /api/v1/health responded with stack="MERN (MongoDB, Express, React, Node.js)"
✔ PASS: /api/v1/simulate-incident created valid GeoJSON Point
✔ PASS: /api/v1/incidents/geojson returned RFC 7946 FeatureCollection
✔ PASS: GET / successfully serves compiled React 18 production bundle
🎉 ALL AGROEDGE MERN STACK TESTS PASSED SUCCESSFULLY!
```

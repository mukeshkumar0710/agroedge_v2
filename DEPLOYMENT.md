# Production Deployment & Operations Guide: AgroEdge

This guide provides end-to-end instructions for deploying the **AgroEdge Edge PWA, Async ML Pipeline & Geospatial Command Hub** into production across containerized environments (Docker / Docker Compose / Kubernetes) and bare-metal / virtual Linux servers (Ubuntu, Debian, RHEL).

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
                                │  - SSE Buffer Bypass (No buffering│
                                │  - Service Worker Cache Control   │
                                │  - Static Asset Gzip Compression  │
                                │  - 25MB Max Upload Request Limits │
                                └─────────────────┬─────────────────┘
                                                  │ HTTP Proxy (Port 8000)
                                                  ▼
                                ┌───────────────────────────────────┐
                                │     UVICORN ASGI SERVER (x4)      │
                                │  - Async Telemetry Ingestion      │
                                │  - Idempotency Deduplication      │
                                │  - RFC 7946 GeoJSON Serializer    │
                                │  - Background ML Inference Queue  │
                                └─────────────────┬─────────────────┘
                                                  │
                                                  ▼
                                ┌───────────────────────────────────┐
                                │   REAL-TIME EVENT BUS (SSE)       │
                                │  - Non-blocking Subscriptions     │
                                │  - Live Outbreak Clustering       │
                                └───────────────────────────────────┘
```

---

## 📋 Prerequisites & HTTPS Requirement

> [!IMPORTANT]
> **HTTPS is Mandatory for Production PWAs:**
> Modern mobile and desktop browsers strictly limit **Service Workers** (`/sw.js`) and the **Geolocation API** (`navigator.geolocation`) to Secure Contexts (`localhost` or `https://`). For production domain deployments, SSL/TLS termination is required.

---

## 🐳 Option 1: Docker Compose Deployment (Recommended)

Docker Compose provides a fully orchestrated, reproducible deployment with isolated networking, automatic restart policies, health checks, and a tuned Nginx proxy.

### 1. Clone & Configure Environment
```bash
git clone <your-repository-url> /opt/agroedge
cd /opt/agroedge

# Copy and configure the environment variables
cp .env.example .env
```

Edit `.env` to configure your settings:
```ini
APP_ENV=production
HOST=0.0.0.0
PORT=8000
WORKERS=4
CORS_ORIGINS=*
HTTP_PORT=80
HTTPS_PORT=443
```

### 2. Build & Launch Containers
```bash
# Build images and start services in detached mode
docker compose up -d --build
```

### 3. Verify Container Health
```bash
docker compose ps
```
Output should show both `agroedge-app` (healthy) and `agroedge-proxy` (running).

### 4. Inspect Live Logs
```bash
# View backend application logs
docker compose logs -f agroedge-app

# View reverse proxy access & error logs
docker compose logs -f agroedge-proxy
```

---

## 🐧 Option 2: Native Bare-Metal / Linux VM Deployment

For dedicated Ubuntu, Debian, or RHEL instances running without Docker.

### 1. Install System Dependencies
```bash
# Ubuntu / Debian
sudo apt update && sudo apt install -y python3.11 python3.11-venv python3-pip nginx git curl

# RHEL / Rocky Linux
sudo dnf install -y python3.11 python3-pip nginx git curl
```

### 2. Create System User and Directory
```bash
sudo useradd -r -s /bin/false agroedge
sudo mkdir -p /opt/agroedge
sudo chown -R agroedge:agroedge /opt/agroedge
```

### 3. Clone Repository & Set Up Virtual Environment
```bash
cd /opt/agroedge
sudo -u agroedge git clone <your-repository-url> .

# Create virtual environment and install dependencies
sudo -u agroedge python3.11 -m venv venv
sudo -u agroedge ./venv/bin/pip install --upgrade pip
sudo -u agroedge ./venv/bin/pip install -r backend/requirements.txt
```

### 4. Configure Environment
```bash
sudo -u agroedge cp .env.example .env
```

### 5. Install & Enable Systemd Service
Copy the provided unit file:
```bash
sudo cp systemd/agroedge.service /etc/systemd/system/agroedge.service
sudo systemctl daemon-reload
sudo systemctl enable agroedge
sudo systemctl start agroedge
```

Check status:
```bash
sudo systemctl status agroedge
```

### 6. Configure Nginx Reverse Proxy
```bash
sudo cp nginx/conf.d/agroedge.conf /etc/nginx/conf.d/agroedge.conf

# Test syntax and reload Nginx
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔒 SSL / TLS Setup with Let's Encrypt (Certbot)

To secure your production domain with a free, automated Let's Encrypt certificate:

```bash
# 1. Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# 2. Obtain and install certificate
sudo certbot --nginx -d your-agroedge-domain.com

# 3. Automatic renewal test
sudo certbot renew --dry-run
```

Certbot will automatically configure the SSL directives in `/etc/nginx/conf.d/agroedge.conf` and handle certificate renewal.

---

## ⚡ Server-Sent Events (SSE) Proxy Rules

Server-Sent Events (`/api/v1/dashboard/stream`) require specific proxy directives to prevent reverse proxies from buffering or terminating continuous event streams:

```nginx
location = /api/v1/dashboard/stream {
    proxy_pass http://agroedge_backend;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_set_header Host $host;

    # Crucial: Disable proxy buffering and response caching
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding on;

    # Long read timeout prevents premature stream termination
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
}
```

---

## 📲 PWA Service Worker Cache Invalidation

To prevent stale client versions when updating the application, `sw.js` must **never** be cached by intermediate proxies or browser HTTP caches:

```nginx
location = /sw.js {
    proxy_pass http://agroedge_backend;
    proxy_set_header Host $host;
    add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    add_header Pragma "no-cache" always;
    add_header Expires "0" always;
}
```

---

## 🔍 Health Checks & Verification

Verify that all components are functioning as expected in your target environment:

### Health Endpoint
```bash
curl -f http://localhost:8000/api/v1/health
```
Expected response:
```json
{
  "status": "healthy",
  "service": "Edge PWA & Geospatial Command Hub",
  "cached_incidents": 8,
  "active_subscribers": 0
}
```

### Live SSE Event Stream Test
```bash
curl -N http://localhost:8000/api/v1/dashboard/stream
```
Expected output:
```text
event: ping
data: {}

: keepalive
```

### GeoJSON Spatial Query Test
```bash
curl -s http://localhost:8000/api/v1/incidents/geojson | jq .
```

---

## 📊 Performance & Sizing Recommendations

| Scale Tier | Concurrent Field Nodes | Recommended Specs | Workers | Memory Allocation |
| :--- | :--- | :--- | :--- | :--- |
| **Small / Pilot** | 10 - 50 | 2 vCPU, 2 GB RAM | 2 workers | 512 MB |
| **Medium / State** | 50 - 500 | 4 vCPU, 8 GB RAM | 4 workers | 2 GB |
| **High / National** | 500 - 5,000+ | 8 vCPU, 16 GB RAM | 8 workers | 6 GB |

Formula for calculating worker count:
$$\text{Workers} = (2 \times \text{CPU Cores}) + 1$$

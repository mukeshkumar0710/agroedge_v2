# ==============================================================================
# AgroEdge: Edge PWA & Geospatial Command Hub - Production Dockerfile
# Multi-stage optimized, non-root security hardened container
# ==============================================================================

# Stage 1: Build & wheels generation
FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip wheel --no-cache-dir --no-deps --wheel-dir /build/wheels -r requirements.txt

# Stage 2: Final runtime container
FROM python:3.11-slim AS runtime

LABEL maintainer="AgroEdge Team"
LABEL description="Production container for AgroEdge PWA, ML Pipeline, and Geospatial Hub"

# Set runtime environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOST=0.0.0.0 \
    PORT=8000 \
    WORKERS=2 \
    APP_ENV=production \
    LOG_LEVEL=info

# Create non-root system user and group
RUN groupadd -g 10001 agroedge && \
    useradd -u 10001 -g agroedge -s /bin/bash -m agroedge

WORKDIR /app

# Install pre-built wheels from builder stage
COPY --from=builder /build/wheels /wheels
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir /wheels/* && \
    rm -rf /wheels

# Copy application modules
COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY dashboard/ ./dashboard/
COPY run.py .

# Assign file ownership to non-root user
RUN chown -R agroedge:agroedge /app

# Switch to non-root security context
USER agroedge

# Expose internal listening port
EXPOSE 8000

# Docker healthcheck querying the internal health API
HEALTHCHECK --interval=30s --timeout=5s --start-period=8s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health')" || exit 1

# Launch production ASGI server with proxy header forwarding enabled
CMD ["sh", "-c", "uvicorn backend.app:app --host 0.0.0.0 --port ${PORT:-8000} --workers ${WORKERS:-2} --proxy-headers --forwarded-allow-ips '*'"]


# ==============================================================================
# AgroEdge MERN Stack Production Dockerfile
# Multi-stage optimized: React Vite frontend builder + Node.js Express runtime
# ==============================================================================

# Stage 1: Build React Vite Client
FROM node:20-alpine AS client-builder

WORKDIR /build/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# Stage 2: Production Node.js Express Runtime
FROM node:20-alpine AS runtime

LABEL maintainer="AgroEdge Team"
LABEL description="AgroEdge MERN Stack Container: Node.js Express + React + MongoDB"

ENV NODE_ENV=production \
    PORT=8000 \
    HOST=0.0.0.0

WORKDIR /app

# Install server production dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --only=production

# Copy server application source
COPY server/ ./server/

# Copy compiled React static assets from Stage 1 into client/dist for Express static serving
COPY --from=client-builder /build/client/dist ./client/dist

# Copy root environment and package definitions
COPY package*.json ./

# Create non-root user and assign permissions
RUN addgroup -g 10001 agroedge && \
    adduser -u 10001 -G agroedge -s /bin/sh -D agroedge && \
    chown -R agroedge:agroedge /app

USER agroedge

EXPOSE 8000

# Health check against Node.js health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/api/v1/health || exit 1

CMD ["node", "server/src/server.js"]

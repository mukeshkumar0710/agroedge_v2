/**
 * Server-Sent Events (SSE) Manager.
 * Maintains persistent event streams with connected government dashboards,
 * broadcasts real-time telemetry updates, and performs heartbeat keepalives.
 */

class SSEManager {
  constructor() {
    this.clients = new Set();

    // Heartbeat every 15 seconds to keep proxies from terminating idle connections
    setInterval(() => {
      this.broadcastKeepAlive();
    }, 15000);
  }

  /**
   * Registers a new SSE client connection.
   * @param {express.Response} res 
   */
  addClient(res) {
    this.clients.add(res);

    // Initial ping event
    res.write('event: ping\ndata: {}\n\n');

    res.on('close', () => {
      this.clients.delete(res);
    });
  }

  /**
   * Broadcasts a GeoJSON Feature payload to all active dashboard subscribers.
   * @param {Object} feature 
   */
  broadcastFeature(feature) {
    if (this.clients.size === 0) return;

    const payload = `data: ${JSON.stringify(feature)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch (err) {
        this.clients.delete(client);
      }
    }
  }

  /**
   * Periodic keepalive comment for proxies and load balancers.
   */
  broadcastKeepAlive() {
    for (const client of this.clients) {
      try {
        client.write(': keepalive\n\n');
      } catch {
        this.clients.delete(client);
      }
    }
  }

  getSubscriberCount() {
    return this.clients.size;
  }
}

const sseManager = new SSEManager();

module.exports = sseManager;

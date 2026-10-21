/**
 * Hybrid Sync Engine for PWA Offline-First Telemetry.
 * Combines Background Sync API, Online Event Listeners, and manual retry draining.
 */

import { getPendingIncidents, markIncidentSynced } from './idb-store.js';

class SyncEngine {
  constructor() {
    this.isSyncing = false;
    this.listeners = new Set();
    this._bindEvents();
  }

  _bindEvents() {
    // 1. Listen for network reconnection
    window.addEventListener('online', () => {
      console.log('[SyncEngine] Network restored. Triggering queue drain.');
      this.drainQueue();
    });

    // 2. Listen for messages from Service Worker background sync
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'BACKGROUND_SYNC_TRIGGERED') {
          console.log('[SyncEngine] Background sync message received from SW.');
          this.drainQueue();
        }
      });
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  _notify(event) {
    this.listeners.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.error(err);
      }
    });
  }

  async requestBackgroundSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.sync.register('sync-diagnoses');
        console.log('[SyncEngine] Background sync tag registered.');
      } catch (err) {
        console.warn('[SyncEngine] Background sync registration failed; fallback to online listener.', err);
      }
    }
  }

  async drainQueue() {
    if (this.isSyncing) return;
    if (!navigator.onLine) {
      this._notify({ type: 'SYNC_OFFLINE', message: 'Cannot sync: Device is offline.' });
      return;
    }

    this.isSyncing = true;
    this._notify({ type: 'SYNC_STARTED' });

    try {
      const pendingItems = await getPendingIncidents();
      let successCount = 0;

      for (const item of pendingItems) {
        try {
          const formData = new FormData();
          formData.append('client_incident_id', item.id);
          formData.append('latitude', item.lat.toString());
          formData.append('longitude', item.lng.toString());
          formData.append('language_code', item.lang || 'en');
          formData.append('captured_at', item.createdAt);
          formData.append('image', item.imageBlob, `${item.id}.jpg`);

          const response = await fetch('/api/v1/diagnose-and-report', {
            method: 'POST',
            body: formData
          });

          if (response.ok) {
            const data = await response.json();
            await markIncidentSynced(item.id, data);
            successCount++;
            this._notify({ type: 'ITEM_SYNCED', id: item.id, receipt: data });
          } else {
            console.warn(`[SyncEngine] Server responded with HTTP ${response.status} for ${item.id}`);
          }
        } catch (err) {
          console.error(`[SyncEngine] Network transfer failed for item ${item.id}:`, err);
          // Keep item in queue for next cycle
        }
      }

      this._notify({
        type: 'SYNC_COMPLETED',
        syncedCount: successCount,
        remainingCount: pendingItems.length - successCount
      });
    } finally {
      this.isSyncing = false;
    }
  }
}

export const syncEngine = new SyncEngine();

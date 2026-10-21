/**
 * IndexedDB Local Storage Wrapper for Edge Image & Geolocation Records.
 * Designed for reliable offline queueing and local triage history.
 */

const DB_NAME = 'AgroEdge_OfflineStore_v2';
const DB_VERSION = 1;
const STORE_NAME = 'edge_incidents';

export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('synced_idx', 'synced', { unique: false });
        store.createIndex('created_at_idx', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveIncident(incident) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(incident);
    tx.oncomplete = () => resolve(incident.id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllIncidents() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      // Sort newest first
      const results = request.result || [];
      results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingIncidents() {
  const all = await getAllIncidents();
  return all.filter((item) => !item.synced);
}

export async function markIncidentSynced(id, serverReceipt) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const record = getReq.result;
      if (record) {
        record.synced = true;
        record.syncedAt = new Date().toISOString();
        record.serverReceipt = serverReceipt;
        if (serverReceipt && serverReceipt.diagnosis) {
          record.diagnosis = serverReceipt.diagnosis;
        }
        store.put(record);
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}


export async function clearAllLocalIncidents() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

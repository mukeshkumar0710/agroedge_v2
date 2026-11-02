import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import FieldWorkerPWA from './components/FieldWorkerPWA';
import CommandDashboard from './components/CommandDashboard';
import IncidentDetailModal from './components/IncidentDetailModal';
import { TRANSLATIONS } from './i18n/translations';
import { fetchHealth, fetchGeoJSON, subscribeToSSEStream } from './services/api';
import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentLang, setCurrentLang] = useState('en');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [mongoConnected, setMongoConnected] = useState(false);
  const [sseStatus, setSseStatus] = useState('disconnected');
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;

  // Track Online / Offline State
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Poll Backend / MongoDB Health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const data = await fetchHealth();
        setMongoConnected(data.database?.connected || data.status === 'healthy');
      } catch {
        setMongoConnected(false);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Initial GeoJSON Telemetry
  useEffect(() => {
    const loadIncidents = async () => {
      try {
        const fc = await fetchGeoJSON();
        if (fc && Array.isArray(fc.features)) {
          setIncidents(fc.features);
        }
      } catch (err) {
        console.warn('[Init GeoJSON Load Warning]', err.message);
      }
    };

    loadIncidents();
  }, []);

  // Subscribe to Real-Time SSE Stream
  useEffect(() => {
    const unsubscribe = subscribeToSSEStream(
      (newFeature) => {
        setIncidents((prev) => {
          // Idempotency: Avoid adding duplicate features
          const exists = prev.some((item) => item.id === newFeature.id);
          if (exists) {
            return prev.map((item) => (item.id === newFeature.id ? newFeature : item));
          }
          return [newFeature, ...prev];
        });
      },
      (status) => {
        setSseStatus(status);
      }
    );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleIncidentCreated = (diagnosis) => {
    // Refresh incident list
    fetchGeoJSON()
      .then((fc) => {
        if (fc?.features) setIncidents(fc.features);
      })
      .catch(() => {});
  };

  return (
    <div className="app-root">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentLang={currentLang}
        setLanguage={setCurrentLang}
        isOnline={isOnline}
        mongoConnected={mongoConnected}
        sseStatus={sseStatus}
        pendingSyncCount={pendingCount}
        t={t}
      />

      <main className="app-main-content">
        {activeTab === 'field' ? (
          <FieldWorkerPWA
            currentLang={currentLang}
            isOnline={isOnline}
            t={t}
            onIncidentCreated={handleIncidentCreated}
            pendingCount={pendingCount}
            setPendingCount={setPendingCount}
          />
        ) : (
          <CommandDashboard
            incidents={incidents}
            setIncidents={setIncidents}
            currentLang={currentLang}
            t={t}
            onSelectIncident={setSelectedIncident}
          />
        )}
      </main>

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <IncidentDetailModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          currentLang={currentLang}
        />
      )}
    </div>
  );
}

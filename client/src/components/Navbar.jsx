import React from 'react';

export default function Navbar({
  activeTab,
  setActiveTab,
  currentLang,
  setLanguage,
  isOnline,
  mongoConnected,
  sseStatus,
  pendingSyncCount,
  t
}) {
  const languages = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिन्दी' },
    { code: 'ta', label: 'தமிழ்' },
    { code: 'te', label: 'తెలుగు' },
    { code: 'es', label: 'Español' },
    { code: 'bn', label: 'বাংলা' }
  ];

  return (
    <header className="navbar-root">
      <div className="navbar-container">
        {/* Brand & Stack Badges */}
        <div className="brand-group">
          <div className="brand-logo-wrap">
            <svg className="brand-icon" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="48" fill="#10b981" />
              <path d="M50 20 C35 35 30 65 50 80 C70 65 65 35 50 20 Z" fill="#ffffff" opacity="0.9" />
              <path d="M50 35 L50 72" stroke="#059669" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="brand-title-wrap">
              <h1 className="brand-title">AgroEdge</h1>
              <span className="badge-mern">MERN STACK</span>
            </div>
            <p className="brand-subtitle">MongoDB • Express • React • Node.js</p>
          </div>
        </div>

        {/* Center Mode Navigation */}
        <nav className="nav-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'field' ? 'active' : ''}`}
            onClick={() => setActiveTab('field')}
          >
            <span className="tab-icon">🌾</span>
            <span>{t.fieldWorkerLink}</span>
            {pendingSyncCount > 0 && (
              <span className="badge-pending" title="Pending offline captures">
                {pendingSyncCount}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <span className="tab-icon">🗺️</span>
            <span>{t.governmentPortalLink}</span>
            <span className="live-indicator-dot" title="Live SSE Feed Active"></span>
          </button>
        </nav>

        {/* Right Status Badges & Language Selector */}
        <div className="status-group">
          {/* MongoDB Status */}
          <div
            className={`badge-status ${mongoConnected ? 'status-connected' : 'status-disconnected'}`}
            title={mongoConnected ? 'MongoDB Atlas Connected' : 'MongoDB Reconnecting...'}
          >
            <span className="status-dot"></span>
            <span className="status-label">MongoDB</span>
          </div>

          {/* SSE Live Status */}
          <div
            className={`badge-status ${sseStatus === 'connected' ? 'status-connected' : 'status-warning'}`}
            title={sseStatus === 'connected' ? 'SSE Live Stream Connected' : 'SSE Reconnecting...'}
          >
            <span className="status-pulse-dot"></span>
            <span className="status-label">Live Telemetry</span>
          </div>

          {/* Network Status */}
          <div
            className={`badge-status ${isOnline ? 'status-online' : 'status-offline'}`}
            title={isOnline ? 'Online' : 'Offline Mode'}
          >
            <span className="status-dot"></span>
            <span className="status-label">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* Language Selector */}
          <div className="lang-selector-wrap">
            <select
              className="lang-select"
              value={currentLang}
              onChange={(e) => setLanguage(e.target.value)}
              aria-label="Select Interface Language"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
}

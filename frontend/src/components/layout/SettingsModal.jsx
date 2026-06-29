import { useState, useEffect } from 'react';
import { API_BASE } from '../../api/client';

export default function SettingsModal({ onClose }) {
  const [health, setHealth] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('finsight-theme') || 'sovereign');

  useEffect(() => {
    fetch(`${API_BASE}/health`).then(r => r.json()).then(setHealth);
  }, []);

  const applyTheme = (t) => {
    setTheme(t);
    localStorage.setItem('finsight-theme', t);
    if (t === 'midnight') {
      document.documentElement.setAttribute('data-theme', 'midnight');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-amber)', fontSize: '18px', letterSpacing: '1px' }}>SYSTEM_SETTINGS</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <section>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '12px', letterSpacing: '1px' }}>SYSTEM_STATUS</div>
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>API_STATUS</span>
                <span style={{ color: 'var(--accent-green)' }}>{health?.status?.toUpperCase() || 'CONNECTING...'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>LLM_PROVIDER</span>
                <span style={{ color: 'var(--text-primary)' }}>{health?.llm_provider?.toUpperCase() || '---'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>VERSION</span>
                <span style={{ color: 'var(--text-primary)' }}>v{health?.version || '4.0.1'}</span>
              </div>
            </div>
          </section>

          <section>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '12px', letterSpacing: '1px' }}>DISPLAY_THEME</div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className={`filter-btn ${theme === 'sovereign' ? 'active' : ''}`} style={{ flex: 1 }} onClick={() => applyTheme('sovereign')}>SOVEREIGN_DARK</button>
              <button className={`filter-btn ${theme === 'midnight' ? 'active' : ''}`} style={{ flex: 1 }} onClick={() => applyTheme('midnight')}>MIDNIGHT_BLUE</button>
            </div>
          </section>

          <section>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '12px', letterSpacing: '1px' }}>DATA_MANAGEMENT</div>
            <button 
              className="filter-btn" 
              style={{ width: '100%', borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }}
              onClick={() => {
                if (window.confirm('WIPE ALL SYSTEM DATA? THIS CANNOT BE UNDONE.')) {
                  localStorage.clear();
                  window.location.reload();
                }
              }}
            >
              PURGE_LOCAL_CACHE
            </button>
          </section>
        </div>

        <div style={{ marginTop: '32px', textAlign: 'center' }}>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>FINSIGHT // BUILT BY ANMOL SETHI</div>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>PRECISION_FINANCIAL_INTELLIGENCE_2026</div>
        </div>
      </div>
    </div>
  );
}

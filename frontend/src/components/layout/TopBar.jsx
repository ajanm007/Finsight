import React, { useState, useEffect } from 'react';

export default function TopBar({ ticker, onSearch, status, onOpenSettings, onOpenHelp }) {
  const [input, setInput] = useState('');
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toISOString().split('T')[1].split('.')[0]);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && input.trim()) {
      onSearch(input.trim().toUpperCase());
      setInput('');
    }
  };

  return (
    <div className="topbar" style={{ display: 'flex', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ color: 'var(--accent-amber)', fontSize: '18px', fontWeight: 'bold', fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>
          FINSIGHT
        </div>
        
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>🔍</span>
          <input 
            type="text" 
            placeholder="SEARCH_TICKER..." 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ paddingLeft: '36px', width: '240px', backgroundColor: 'var(--bg-secondary)' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-muted)', fontSize: '12px' }}>
          <span>ANALYSIS</span>
          {ticker && (
            <>
              <span style={{ color: 'var(--accent-amber)', borderBottom: '2px solid var(--accent-amber)', paddingBottom: '22px', marginBottom: '-22px' }}>{ticker}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '6px', height: '6px', backgroundColor: status === 'running' ? 'var(--accent-amber)' : status === 'error' ? 'var(--accent-red)' : 'var(--accent-green)', borderRadius: '50%' }}></div>
                V4.1_{status === 'running' ? 'ANALYZING' : status === 'error' ? 'ERROR' : 'LIVE'}_{time}
              </span>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', color: 'var(--text-muted)', alignItems: 'center' }}>
        <span
          style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', border: '1px solid rgba(255,165,0,0.3)', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-amber)', opacity: 0.7 }}
          onClick={onOpenHelp}
          title="Plain English Guide"
        >?</span>
        <span style={{ cursor: 'pointer' }} onClick={onOpenSettings}>⚙</span>
        <span style={{ cursor: 'pointer' }}>👤</span>
      </div>
    </div>
  );
}

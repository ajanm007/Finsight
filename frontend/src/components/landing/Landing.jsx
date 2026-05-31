import React, { useState } from 'react';

export default function Landing({ onSearch }) {
  const [input, setInput] = useState('');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && input.trim()) {
      onSearch(input.trim().toUpperCase());
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
      
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '72px', color: 'var(--accent-amber)', letterSpacing: '8px', margin: 0, textShadow: '0 0 20px rgba(232, 168, 56, 0.2)' }}>
          FINSIGHT
        </h1>
        <div style={{ color: 'var(--text-muted)', letterSpacing: '4px', fontSize: '11px', marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
          <span>PRECISION FINANCIAL INTELLIGENCE</span>
          <span style={{ width: '40px', height: '1px', backgroundColor: 'var(--border)' }}></span>
          <span style={{ color: 'var(--accent-green)' }}>V4.1.0_STABLE</span>
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: '600px', position: 'relative', marginBottom: '32px' }}>
        <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '16px' }}>🔍</span>
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="COMMAND_INPUT: SEARCH TICKER, ANALYST, OR SIGNAL..."
          autoFocus
          style={{ 
            width: '100%', 
            padding: '16px 16px 16px 48px', 
            fontSize: '14px', 
            backgroundColor: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)'
          }}
        />
        <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '8px' }}>
          <span style={{ backgroundColor: '#1a2230', padding: '2px 6px', borderRadius: '2px', fontSize: '10px', color: 'var(--text-muted)' }}>CTRL</span>
          <span style={{ backgroundColor: '#1a2230', padding: '2px 6px', borderRadius: '2px', fontSize: '10px', color: 'var(--text-muted)' }}>K</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px', color: 'var(--text-muted)' }}>
        <span>TRENDING_SIGNALS:</span>
        <div style={{ display: 'flex', gap: '12px' }}>
          {['NVDA', 'AAPL', 'TSLA', 'MSFT', 'GOOGL'].map(t => (
            <div key={t} onClick={() => onSearch(t)} style={{ border: '1px solid var(--border)', padding: '6px 12px', cursor: 'pointer' }}>
              <span style={{ color: 'var(--text-primary)' }}>{t}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginTop: 'auto', width: '100%', maxWidth: '800px', borderTop: '1px solid var(--border)', paddingTop: '32px' }}>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-primary)' }}>SECURE_COMM_ENCRYPTED</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>AES-256-GCM HARDWARE ACCELERATED TUNNEL ACTIVE. ALL QUERIES LOGGED TO SOVEREIGN AUDIT VAULT.</div>
        </div>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-primary)' }}>LATENCY_OPTIMIZED</div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>FIBER-DIRECT EXCHANGE ROUTING ENABLED. MILLISECOND-GRADE TRADE EXECUTION AVAILABLE IN COMMAND CONSOLE.</div>
        </div>
        <div>
          <div style={{ fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '8px', color: 'var(--text-primary)' }}>MARKET_STATUS</div>
          <div style={{ fontSize: '10px', color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '4px', height: '4px', backgroundColor: 'var(--accent-green)' }}></div>
            NYSE_OPEN
          </div>
        </div>
      </div>

    </div>
  );
}

import React from 'react';

export default function SignalCard({ signal, onClick }) {
  const getIcon = () => {
    switch (signal.type) {
      case 'bull': return '▲';
      case 'bear': return '▼';
      case 'conflict': return '⚡';
      default: return '○';
    }
  };

  const getColor = () => {
    switch (signal.type) {
      case 'bull': return 'var(--accent-green)';
      case 'bear': return 'var(--accent-red)';
      case 'conflict': return 'var(--accent-amber)';
      default: return 'var(--text-muted)';
    }
  };

  return (
    <div className={`signal-card ${signal.type}`} onClick={onClick} style={{ cursor: 'pointer' }}>
      <div style={{ 
        width: '32px', 
        height: '32px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        backgroundColor: 'rgba(255,255,255,0.03)', 
        border: `1px solid ${getColor()}`,
        color: getColor(),
        fontSize: '14px',
        flexShrink: 0
      }}>
        {getIcon()}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ color: getColor(), fontWeight: 'bold', fontSize: '11px', letterSpacing: '1px' }}>{signal.type.toUpperCase()}</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 'bold', border: '1px solid var(--border)', padding: '0 6px', fontSize: '10px' }}>{signal.ticker}</span>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '9px' }}>{new Date(signal.time * 1000).toLocaleString()}</span>
        </div>
        
        <div style={{ color: 'var(--text-primary)', fontSize: '12px', lineHeight: 1.4 }}>
          {signal.text}
        </div>

        {signal.source && (
          <div style={{ marginTop: '8px', fontSize: '9px', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
            <span>SOURCE: {signal.source.toUpperCase()}</span>
            <span>|</span>
            <span>STRENGTH: {Math.round(signal.confidence * 100)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

import React from 'react';

const TYPE_META = {
  bull:     { icon: '▲', color: 'var(--accent-green)', label: 'BULL' },
  bear:     { icon: '▼', color: 'var(--accent-red)',   label: 'BEAR' },
  conflict: { icon: '⚡', color: 'var(--accent-amber)', label: 'CONFLICT' },
};

// signals carry a source_type (yfinance/news/...) — map to a readable category
const SOURCE_LABELS = {
  yfinance: 'TECHNICAL', technical: 'TECHNICAL', news: 'NEWS', tavily: 'NEWS',
  sec_filing: 'SEC FILING', fundamentals: 'FUNDAMENTALS', analyst: 'ANALYST',
  sentiment: 'SENTIMENT',
};

export default function SignalCard({ signal, onClick, index = 0 }) {
  const meta = TYPE_META[signal.type] || { icon: '○', color: 'var(--text-muted)', label: 'SIGNAL' };
  const color = meta.color;
  const isConflict = signal.type === 'conflict';

  const sourceTag = signal.source_type
    ? (SOURCE_LABELS[signal.source_type] || signal.source_type.toUpperCase().replace(/_/g, ' '))
    : null;

  const validSrcs = (signal.sources || []).filter(s => s.label && s.label !== 'undefined' && s.value != null);

  return (
    <div
      className={`signal-card ${signal.type}`}
      onClick={onClick}
      style={{ cursor: 'pointer', animationDelay: `${index * 45}ms` }}
    >
      <span className="signal-scanline" aria-hidden="true" />

      <div className="signal-icon" style={{ borderColor: color, color }}>
        {meta.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', minWidth: 0 }}>
            <span style={{ color, fontWeight: 'bold', fontSize: '10px', letterSpacing: '1.5px' }}>{meta.label}</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 'bold', border: '1px solid var(--border)', padding: '0 6px', fontSize: '10px', letterSpacing: '0.5px' }}>{signal.ticker}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {sourceTag && (
              <span style={{ fontSize: '8px', letterSpacing: '1px', color: 'var(--text-muted)', border: '1px solid var(--border)', padding: '1px 5px' }}>{sourceTag}</span>
            )}
            <span style={{ color: 'var(--text-muted)', fontSize: '9px', whiteSpace: 'nowrap' }}>
              {new Date(signal.time * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        {signal.title && !isConflict && (
          <div style={{ color, fontSize: '12px', fontWeight: 'bold', letterSpacing: '0.4px', marginBottom: '3px' }}>{signal.title}</div>
        )}

        <div style={{ color: 'var(--text-primary)', fontSize: '12px', lineHeight: 1.5 }}>
          {signal.description || signal.text}
        </div>

        {validSrcs.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
            {validSrcs.map((src, i) => (
              <span key={i} className="signal-source-badge">
                {src.label}: {src.value}{src.threshold ? ` / ${src.threshold}` : ''}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

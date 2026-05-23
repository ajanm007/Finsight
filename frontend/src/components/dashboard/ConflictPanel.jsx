import React from 'react';

export default function ConflictPanel({ conflicts }) {
  const hasConflicts = conflicts && conflicts.length > 0;

  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ color: hasConflicts ? 'var(--accent-amber)' : 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', letterSpacing: '1px', fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>
        <span>{hasConflicts ? '⚑' : '✓'}</span> {hasConflicts ? 'SIGNAL CONFLICTS' : 'CROSS-VALIDATION: CLEAR'}
      </div>

      
      {hasConflicts ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          {conflicts.map((conflictStr, i) => {
            const text = conflictStr.replace(/^⚠\s*/, '');
            let title = "DIVERGENCE ALERT";
            const lower = text.toLowerCase();
            if (lower.includes('valuation') || lower.includes('p/e')) {
              title = "VALUATION ANOMALY";
            } else if (lower.includes('sentiment') || lower.includes('news')) {
              title = "SENTIMENT DIVERGENCE";
            } else if (lower.includes('momentum') || lower.includes('velocity') || lower.includes('rsi')) {
              title = "MOMENTUM RISK";
            } else if (lower.includes('trend') || lower.includes('ma ') || lower.includes('ma-')) {
              title = "TREND CONFLICT";
            } else if (lower.includes('macd')) {
              title = "TECHNICAL WARNING";
            }
            
            return (
              <div key={i} style={{ border: '1px solid var(--accent-amber)', padding: '16px', display: 'flex', gap: '16px', alignItems: 'flex-start', backgroundColor: '#2a2215' }}>
                <div style={{ color: 'var(--accent-amber)', fontSize: '24px', lineHeight: 1 }}>
                  {i % 2 === 0 ? '⚠' : '⚖'}
                </div>
                <div>
                  <div style={{ color: 'var(--accent-amber)', fontWeight: 'bold', fontSize: '13px', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '1px' }}>
                    {title}
                  </div>
                  <div style={{ color: 'var(--text-primary)', fontSize: '11px', lineHeight: 1.6 }}>
                    {text}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: '8px 12px', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent-green)', color: 'var(--text-muted)', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'var(--accent-green)', fontWeight: 'bold', letterSpacing: '1px' }}>VALIDATED</span>
          <span>ALL DATA SOURCES ALIGNED. NO SIGNIFICANT DIVERGENCE DETECTED.</span>
        </div>
      )}

    </div>
  );
}


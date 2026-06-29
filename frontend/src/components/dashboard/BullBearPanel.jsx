import { useState } from 'react';
import DataBadge from '../common/DataBadge';

function SignalCard({ signal, color, icon }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const renderSources = () => {
    if (!signal.sources || signal.sources.length === 0) return null;

    if (signal.source_type === 'tavily') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px' }}>
            SOURCE: TAVILY NEWS
          </div>
          {signal.sources.map((src, i) => (
            <a 
              key={i} 
              href={src.url} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ textDecoration: 'none', display: 'block', padding: '8px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid transparent', transition: 'border-color 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              onMouseOut={(e) => e.currentTarget.style.borderColor = 'transparent'}
            >
              <div style={{ color: 'var(--text-primary)', fontSize: '10px', fontWeight: 'bold', marginBottom: '2px' }}>
                • "{src.headline}"
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '8px' }}>
                <span>{src.outlet} · {src.age}</span>
                <span style={{ color: src.sentiment_score > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                  score: {src.sentiment_score > 0 ? '+' : ''}{src.sentiment_score.toFixed(2)}
                </span>
              </div>
            </a>
          ))}
        </div>
      );
    }

    if (signal.source_type === 'yfinance' || signal.source_type === 'sec edgar') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '8px' }}>
            SOURCE: {signal.source_type.toUpperCase()}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {signal.sources.map((src, i) => (
              <div key={i} style={{ padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-primary)', marginBottom: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>{src.label}</div>
                <div style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 'bold' }}>{src.value}</div>
                {src.threshold && (
                  <div style={{ fontSize: '8px', color: 'var(--text-muted)', marginTop: '4px' }}>THRESHOLD: {src.threshold}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div 
      className="panel" 
      style={{ 
        borderLeft: `3px solid ${color}`,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'transform 0.2s, border-color 0.2s',
        backgroundColor: isExpanded ? 'rgba(255,255,255,0.04)' : 'transparent'
      }}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div style={{ padding: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span style={{ color, fontSize: '14px' }}>{icon}</span>
          <div style={{ color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1 }}>
            {signal.title}
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '10px', transition: 'transform 0.3s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            ▼
          </span>
        </div>
        
        <div style={{ color: 'var(--text-muted)', fontSize: '10px', lineHeight: 1.4, paddingLeft: '22px', marginBottom: '8px' }}>
          {signal.description}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' }}>
          <DataBadge status={signal.status.toUpperCase()} small={true} />
        </div>
      </div>

      <div style={{ 
        maxHeight: isExpanded ? '400px' : '0', 
        overflow: 'hidden', 
        transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1)' 
      }}>
        {renderSources()}
      </div>
    </div>
  );
}

export default function BullBearPanel({ brief }) {
  if (!brief) return null;
  
  const signals = brief.signals || [];
  const bullPoints = signals.filter(s => s.type === 'bull').slice(0, 3);
  const bearPoints = signals.filter(s => s.type === 'bear').slice(0, 3);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
      
      {/* BULL CASE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', letterSpacing: '1.5px', fontSize: '11px', fontWeight: 'bold' }}>
          <span style={{ fontSize: '14px' }}>▲</span> BULL SIGNALS
        </div>
        
        {bullPoints.map((signal, i) => (
          <SignalCard key={i} signal={signal} color="var(--accent-green)" icon="✓" />
        ))}
        {bullPoints.length === 0 && (
          <div className="panel panel-body" style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '11px', padding: '32px' }}>
            NO POSITIVE DRIFT DETECTED
          </div>
        )}
      </div>
      
      {/* BEAR CASE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ color: 'var(--accent-red)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', letterSpacing: '1.5px', fontSize: '11px', fontWeight: 'bold' }}>
          <span style={{ fontSize: '14px' }}>▼</span> BEAR SIGNALS
        </div>
        
        {bearPoints.map((signal, i) => (
          <SignalCard key={i} signal={signal} color="var(--accent-red)" icon="⚠" />
        ))}
        {bearPoints.length === 0 && (
          <div className="panel panel-body" style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '11px', padding: '32px' }}>
            NO NEGATIVE DRIFT DETECTED
          </div>
        )}
      </div>
      
    </div>
  );
}


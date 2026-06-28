import React, { useState, useEffect, useRef } from 'react';

const TOOLS = [
  { id: 'fetch_price_data',   label: 'FETCHING PRICE & VOLUME DATA',   sub: 'YFINANCE' },
  { id: 'fetch_news',         label: 'SYNCHRONIZING NEWS FEED',         sub: 'TAVILY' },
  { id: 'fetch_sec_filing',   label: 'QUERYING SEC EDGAR FILINGS',      sub: 'SEC.GOV' },
  { id: 'compute_technicals', label: 'COMPUTING TECHNICAL INDICATORS',  sub: 'RSI / MACD / MA' },
  { id: 'run_sentiment',      label: 'RUNNING SENTIMENT ANALYSIS',      sub: 'FINBERT NLP' },
];

export default function PipelineLoaderCinematic({ ticker, toolStates, status }) {
  const [revealed, setRevealed] = useState(new Set());
  const [elapsed, setElapsed] = useState(0);
  const startTime = useRef(Date.now());
  const prevStates = useRef({});

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTime.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // Reveal a tool row the moment it goes running or done
  useEffect(() => {
    TOOLS.forEach(({ id }) => {
      const curr = toolStates[id];
      const prev = prevStates.current[id];
      if (!curr) return;
      const active = curr.state === 'running' || curr.state === 'done' || curr.state === 'failed';
      const wasInactive = !prev || (prev.state === 'pending' || prev.state === 'idle');
      if (active && wasInactive) {
        setRevealed(r => new Set([...r, id]));
      }
    });
    prevStates.current = { ...toolStates };
  }, [toolStates]);

  const doneCount = TOOLS.filter(t => {
    const s = toolStates[t.id]?.state;
    return s === 'done' || s === 'failed';
  }).length;

  const progress = Math.round((doneCount / TOOLS.length) * 100);

  const getState = (id) => toolStates[id]?.state || 'pending';
  const getDataStatus = (id) => toolStates[id]?.status;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', padding: '48px 24px',
      fontFamily: 'var(--font-mono)',
      position: 'relative',
    }}>

      {/* Subtle grid bg */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          repeating-linear-gradient(rgba(255,255,255,0.008) 0px, rgba(255,255,255,0.008) 1px, transparent 1px, transparent 40px),
          repeating-linear-gradient(90deg, rgba(255,255,255,0.008) 0px, rgba(255,255,255,0.008) 1px, transparent 1px, transparent 40px)
        `,
      }} />

      {/* Ticker hero */}
      <div style={{ textAlign: 'center', marginBottom: '48px', position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '4px', marginBottom: '12px' }}>
          INITIALIZING ANALYSIS PIPELINE
        </div>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: '88px', letterSpacing: '14px',
          color: 'var(--accent-amber)',
          textShadow: '0 0 40px rgba(232,168,56,0.25)',
          animation: 'heroGlow 3s ease-in-out infinite',
        }}>
          {ticker}
        </div>
        <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '3px', marginTop: '10px' }}>
          PRECISION FINANCIAL INTELLIGENCE
        </div>
      </div>

      {/* Task list */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: '14px',
        width: '100%', maxWidth: '420px',
        marginBottom: '52px',
        position: 'relative', zIndex: 1,
      }}>
        {TOOLS.map((tool) => {
          const state = getState(tool.id);
          const dataStatus = getDataStatus(tool.id);
          const isRevealed = revealed.has(tool.id);
          const isDone = state === 'done' || state === 'failed';
          const isRunning = state === 'running';

          const dotColor = state === 'failed' ? 'var(--accent-red)'
            : isDone && dataStatus === 'CACHED' ? 'var(--accent-amber)'
            : isDone ? 'var(--accent-green)'
            : isRunning ? 'var(--accent-green)'
            : 'var(--border)';

          const labelColor = isRevealed ? (isDone ? 'var(--text-primary)' : 'var(--accent-green)') : 'transparent';

          return (
            <div key={tool.id} style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              opacity: isRevealed ? 1 : 0,
              transform: isRevealed ? 'translateX(0)' : 'translateX(-12px)',
              transition: 'opacity 0.35s ease, transform 0.35s ease',
            }}>
              {/* Indicator */}
              <div style={{ flexShrink: 0, width: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isDone ? (
                  <span style={{ fontSize: '12px', color: dotColor }}>✓</span>
                ) : isRunning ? (
                  <div style={{
                    width: '8px', height: '8px', backgroundColor: dotColor,
                    animation: 'pulse 0.8s ease-in-out infinite',
                  }} />
                ) : (
                  <div style={{ width: '6px', height: '6px', border: '1px solid var(--border)' }} />
                )}
              </div>

              {/* Label */}
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '11px', letterSpacing: '1.5px',
                  color: labelColor,
                  transition: 'color 0.3s ease',
                }}>
                  {tool.label}
                  {isRunning && <span style={{ color: 'var(--accent-green)', opacity: 0.6 }}> ...</span>}
                </div>
              </div>

              {/* Source tag */}
              <div style={{
                fontSize: '8px', letterSpacing: '1px',
                color: isDone ? (dataStatus === 'CACHED' ? 'var(--accent-amber)' : 'var(--accent-green)') : 'var(--text-muted)',
                opacity: isRevealed ? 1 : 0,
                transition: 'opacity 0.3s ease 0.1s, color 0.3s ease',
                flexShrink: 0,
              }}>
                {isDone && dataStatus === 'CACHED' ? 'CACHED' : isDone ? 'LIVE' : tool.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress bar block */}
      <div style={{ width: '100%', maxWidth: '420px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '1.5px' }}>
            {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')} ELAPSED
          </span>
          <span style={{ fontSize: '8px', color: 'var(--accent-amber)', letterSpacing: '1.5px' }}>
            {doneCount}/{TOOLS.length} SOURCES
          </span>
        </div>

        {/* Track */}
        <div style={{ height: '5px', backgroundColor: 'var(--border)', position: 'relative', overflow: 'hidden' }}>
          {/* Fill */}
          <div style={{
            position: 'absolute', top: 0, left: 0, height: '100%',
            width: `${progress}%`,
            backgroundColor: 'var(--accent-amber)',
            boxShadow: '0 0 10px rgba(232,168,56,0.5)',
            transition: 'width 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
          {/* Shimmer on fill */}
          {progress > 0 && progress < 100 && (
            <div style={{
              position: 'absolute', top: 0, height: '100%', width: '60px',
              left: `calc(${progress}% - 30px)`,
              background: 'linear-gradient(90deg, transparent, rgba(232,168,56,0.6), transparent)',
              animation: 'shimmer 1.2s ease-in-out infinite',
            }} />
          )}
        </div>

        <div style={{ marginTop: '8px', textAlign: 'center', fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '2px' }}>
          {progress === 100 ? 'PIPELINE COMPLETE — GENERATING REPORT...' : status === 'connecting' ? 'ESTABLISHING CONNECTION...' : 'PIPELINE EXECUTING'}
        </div>
      </div>

      <style>{`
        @keyframes heroGlow {
          0%, 100% { text-shadow: 0 0 40px rgba(232,168,56,0.25); }
          50%       { text-shadow: 0 0 60px rgba(232,168,56,0.4), 0 0 100px rgba(232,168,56,0.15); }
        }
        @keyframes shimmer {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.7); }
        }
      `}</style>
    </div>
  );
}

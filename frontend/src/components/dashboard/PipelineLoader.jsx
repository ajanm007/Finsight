import React, { useState, useEffect, useRef } from 'react';

const TOOLS = [
  { id: 'fetch_price_data',   label: 'YFINANCE',    desc: 'PRICE & VOLUME DATA',    icon: '◈' },
  { id: 'fetch_news',         label: 'TAVILY NEWS', desc: 'NEWS FEED & ARTICLES',   icon: '◉' },
  { id: 'fetch_sec_filing',   label: 'SEC EDGAR',   desc: '10-K / 10-Q FILINGS',    icon: '⬡' },
  { id: 'compute_technicals', label: 'TECHNICALS',  desc: 'RSI / MACD / MA CROSS',  icon: '◎' },
  { id: 'run_sentiment',      label: 'FINBERT NLP', desc: 'SENTIMENT SCORING',      icon: '◆' },
];

const LOG_TEMPLATES = {
  running: (label) => `INITIATING ${label} QUERY...`,
  done_AVAILABLE: (label, ms) => `${label} ACQUIRED // ${ms}MS // LIVE DATA`,
  done_CACHED: (label, ms) => `${label} RESTORED FROM CACHE // ${ms}MS`,
  done_UNAVAILABLE: (label) => `${label} UNAVAILABLE // SKIPPING`,
  failed: (label) => `${label} QUERY FAILED // TIMEOUT`,
};

function timestamp() {
  return new Date().toISOString().split('T')[1].split('.')[0];
}

export default function PipelineLoader({ ticker, toolStates, status }) {
  const [logs, setLogs] = useState([
    { ts: timestamp(), text: `SOVEREIGN ANALYSIS TERMINAL // TARGET: ${ticker}`, color: 'var(--accent-amber)' },
    { ts: timestamp(), text: 'INITIALIZING MULTI-SOURCE PIPELINE...', color: 'var(--text-muted)' },
  ]);
  const [elapsed, setElapsed] = useState(0);
  const [dotCount, setDotCount] = useState(1);
  const prevStates = useRef({});
  const logEndRef = useRef(null);
  const startTime = useRef(Date.now());

  // Elapsed timer
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTime.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // Animated dots on header
  useEffect(() => {
    const id = setInterval(() => setDotCount(d => (d % 3) + 1), 500);
    return () => clearInterval(id);
  }, []);

  // Watch toolStates for transitions → append log lines
  useEffect(() => {
    const newLogs = [];
    TOOLS.forEach(({ id, label }) => {
      const curr = toolStates[id];
      const prev = prevStates.current[id];
      if (!curr) return;

      if (curr.state === 'running' && prev?.state !== 'running') {
        newLogs.push({ ts: timestamp(), text: LOG_TEMPLATES.running(label), color: 'var(--accent-green)' });
      }
      if (curr.state === 'done' && prev?.state !== 'done') {
        const key = `done_${curr.status || 'AVAILABLE'}`;
        const tpl = LOG_TEMPLATES[key] || LOG_TEMPLATES['done_AVAILABLE'];
        newLogs.push({ ts: timestamp(), text: tpl(label, curr.latency_ms || '—'), color: curr.status === 'CACHED' ? 'var(--accent-amber)' : 'var(--accent-green)' });
      }
      if (curr.state === 'failed' && prev?.state !== 'failed') {
        newLogs.push({ ts: timestamp(), text: LOG_TEMPLATES.failed(label), color: 'var(--accent-red)' });
      }
    });

    if (newLogs.length > 0) setLogs(prev => [...prev, ...newLogs]);
    prevStates.current = { ...toolStates };
  }, [toolStates]);

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const doneCount = TOOLS.filter(t => {
    const s = toolStates[t.id]?.state;
    return s === 'done' || s === 'failed';
  }).length;
  const progress = Math.round((doneCount / TOOLS.length) * 100);

  const getToolColor = (state, dataStatus) => {
    if (state === 'pending') return 'var(--text-muted)';
    if (state === 'running') return 'var(--accent-green)';
    if (state === 'done') return dataStatus === 'CACHED' ? 'var(--accent-amber)' : 'var(--accent-green)';
    if (state === 'failed') return 'var(--accent-red)';
    return 'var(--text-muted)';
  };

  const getToolStatus = (state, dataStatus, latency) => {
    if (state === 'pending') return { text: 'QUEUED', color: 'var(--text-muted)' };
    if (state === 'running') return { text: 'FETCHING' + '.'.repeat(dotCount), color: 'var(--accent-green)' };
    if (state === 'done' && dataStatus === 'CACHED') return { text: `CACHED  ${latency}MS`, color: 'var(--accent-amber)' };
    if (state === 'done') return { text: `LIVE  ${latency}MS`, color: 'var(--accent-green)' };
    if (state === 'failed') return { text: 'FAILED', color: 'var(--accent-red)' };
    return { text: 'IDLE', color: 'var(--text-muted)' };
  };

  const getStateIcon = (state, dataStatus) => {
    if (state === 'pending') return { ch: '○', spin: false };
    if (state === 'running') return { ch: '◌', spin: true };
    if (state === 'done' && dataStatus === 'CACHED') return { ch: '◐', spin: false };
    if (state === 'done') return { ch: '●', spin: false };
    if (state === 'failed') return { ch: '✕', spin: false };
    return { ch: '○', spin: false };
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '0',
      border: '1px solid var(--border)',
      backgroundColor: 'var(--bg-secondary)',
      fontFamily: 'var(--font-mono)',
      animation: 'fadeInUp 0.4s ease',
    }}>

      {/* Header bar */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: 'rgba(232,168,56,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '8px', height: '8px',
            backgroundColor: 'var(--accent-amber)',
            animation: 'pulse 1s infinite',
          }} />
          <span style={{ fontSize: '11px', color: 'var(--accent-amber)', letterSpacing: '2px' }}>
            ANALYZING: <span style={{ color: 'var(--text-primary)' }}>{ticker}</span>
          </span>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '1px' }}>
            {status === 'connecting' ? 'CONNECTING' + '.'.repeat(dotCount) : `${doneCount} / ${TOOLS.length} SOURCES`}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '1px', fontVariantNumeric: 'tabular-nums' }}>
            {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')} ELAPSED
          </span>
          <span style={{ fontSize: '9px', color: 'var(--accent-amber)', letterSpacing: '1px' }}>
            {progress}%
          </span>
        </div>
      </div>

      {/* Overall progress bar */}
      <div style={{ height: '2px', backgroundColor: 'var(--bg-primary)' }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          backgroundColor: 'var(--accent-amber)',
          boxShadow: '0 0 8px rgba(232,168,56,0.4)',
          transition: 'width 0.6s ease',
        }} />
      </div>

      {/* Tool rows */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {TOOLS.map((tool, i) => {
          const ts = toolStates[tool.id] || { state: 'pending' };
          const color = getToolColor(ts.state, ts.status);
          const statusInfo = getToolStatus(ts.state, ts.status, ts.latency_ms);
          const icon = getStateIcon(ts.state, ts.status);
          const isDone = ts.state === 'done' || ts.state === 'failed';

          return (
            <div
              key={tool.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '20px 120px 1fr auto',
                alignItems: 'center',
                gap: '16px',
                padding: '11px 20px',
                borderBottom: i < TOOLS.length - 1 ? '1px solid rgba(30,42,58,0.6)' : 'none',
                backgroundColor: ts.state === 'running' ? 'rgba(46,204,113,0.03)' : 'transparent',
                transition: 'background-color 0.3s ease',
              }}
            >
              {/* State icon */}
              <span style={{
                fontSize: '12px', color,
                animation: icon.spin ? 'rotateCW 1.2s linear infinite' : 'none',
                display: 'inline-block',
              }}>
                {icon.ch}
              </span>

              {/* Tool label */}
              <div>
                <div style={{ fontSize: '10px', color: ts.state === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)', letterSpacing: '1px', fontWeight: ts.state !== 'pending' ? 'bold' : 'normal' }}>
                  {tool.label}
                </div>
                <div style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.5px', marginTop: '2px' }}>
                  {tool.desc}
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: '2px', backgroundColor: 'rgba(30,42,58,0.8)', position: 'relative', overflow: 'hidden' }}>
                {ts.state === 'running' && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, height: '100%', width: '40%',
                    background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
                    animation: 'scanBar 1.4s ease-in-out infinite',
                  }} />
                )}
                {isDone && (
                  <div style={{
                    height: '100%', width: '100%',
                    backgroundColor: color, opacity: 0.6,
                    transition: 'width 0.4s ease',
                  }} />
                )}
              </div>

              {/* Status text */}
              <div style={{
                fontSize: '9px', color: statusInfo.color,
                letterSpacing: '1px', textAlign: 'right',
                minWidth: '120px',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {statusInfo.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* Terminal log */}
      <div style={{
        borderTop: '1px solid var(--border)',
        backgroundColor: 'var(--bg-primary)',
        padding: '12px 20px',
        height: '120px',
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: '4px',
      }}>
        {logs.map((log, i) => (
          <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.5px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
              [{log.ts}]
            </span>
            <span style={{ fontSize: '9px', color: log.color, letterSpacing: '0.8px' }}>
              {log.text}
            </span>
          </div>
        ))}
        <div ref={logEndRef} />
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes rotateCW {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes scanBar {
          0%   { left: -40%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}

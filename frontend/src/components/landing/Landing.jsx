import React, { useState, useEffect, useRef, useMemo } from 'react';
import TutorialModal from './TutorialModal';
import { API_BASE } from '../../api/client';
import { useSymbolSearch } from '../../hooks/useSymbolSearch';

const INDICES = [
  { label: 'S&P 500', value: '5,842.30', change: '+0.38%', pos: true },
  { label: 'NASDAQ', value: '21,218.60', change: '-0.12%', pos: false },
  { label: 'DOW', value: '42,840.10', change: '+0.21%', pos: true },
  { label: 'VIX', value: '18.42', change: '+2.10%', pos: false },
  { label: 'DXY', value: '104.82', change: '+0.05%', pos: true },
  { label: 'GOLD', value: '2,385.00', change: '+0.31%', pos: true },
  { label: 'BTC/USD', value: '68,420', change: '+1.24%', pos: true },
  { label: 'OIL WTI', value: '78.34', change: '-0.88%', pos: false },
];

const TICKER_STRIP = [
  'SPY +0.38%', 'QQQ -0.12%', 'NVDA +2.14%', 'AAPL +0.62%', 'TSLA -1.33%',
  'MSFT +0.45%', 'GOOGL +0.18%', 'META +1.07%', 'AMZN +0.29%', 'BRK.B +0.11%',
  'JPM +0.54%', 'GS +0.33%', 'BAC -0.21%', 'AMD +1.82%', 'INTC -0.67%',
  'DIS -0.44%', 'NFLX +0.93%', 'UBER +0.76%', 'CRM +0.38%', 'PLTR +3.14%',
];

const PIPELINE = [
  { label: 'ANALYSIS ENGINE', status: 'READY', ok: true },
  { label: 'FINBERT NLP', status: 'WARM', ok: true },
  { label: 'LLM SYNTHESIS', status: 'ONLINE', ok: true },
  { label: 'DATA PIPELINE', status: '8/8 LIVE', ok: true },
  { label: 'SEC FILINGS', status: 'INDEXED', ok: true },
  { label: 'SIGNAL DETECTOR', status: 'ACTIVE', ok: true },
];

const HEX_CHARS = '0123456789ABCDEF';
const DATA_CHARS = '01アイウエオ∑∂∇∈≈×÷';

function useDataStreams(count = 8) {
  const streams = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 4 + i * 12.5,
    speed: 1.8 + Math.random() * 2.4,
    delay: Math.random() * -8,
    chars: Array.from({ length: 18 }, () => DATA_CHARS[Math.floor(Math.random() * DATA_CHARS.length)]),
  })), [count]);
  return streams;
}

function useGlitch(interval = 8000) {
  const [glitching, setGlitching] = useState(false);
  useEffect(() => {
    const fire = () => {
      setGlitching(true);
      setTimeout(() => setGlitching(false), 400);
    };
    const id = setInterval(fire, interval);
    const t = setTimeout(fire, 1200);
    return () => { clearInterval(id); clearTimeout(t); };
  }, [interval]);
  return glitching;
}

function useCounter(target, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      setValue(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function useFlicker(interval = 3200) {
  const [flickering, setFlickering] = useState(new Set());
  useEffect(() => {
    const id = setInterval(() => {
      const idx = Math.floor(Math.random() * INDICES.length);
      setFlickering(s => new Set([...s, idx]));
      setTimeout(() => setFlickering(s => { const n = new Set(s); n.delete(idx); return n; }), 120);
    }, interval);
    return () => clearInterval(id);
  }, [interval]);
  return flickering;
}

export default function Landing({ onSearch, onLogout }) {
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const [time, setTime] = useState('');
  const [backendStatus, setBackendStatus] = useState('checking');
  const [recentTickers, setRecentTickers] = useState([]);
  const [mounted, setMounted] = useState(false);
  const [analysisCount] = useState(Math.floor(Math.random() * 40) + 12);
  const [showTutorial, setShowTutorial] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const blurTimer = useRef(null);
  const suggestions = useSymbolSearch(input);

  useEffect(() => {
    if (!localStorage.getItem('finsight-tutorial-seen')) {
      setTimeout(() => setShowTutorial(true), 800);
    }
  }, []);
  const flickering = useFlicker(2800);
  const glitching = useGlitch(8000);
  const displayCount = useCounter(analysisCount, 1400);
  const streams = useDataStreams(8);
  const stripRef = useRef(null);

  useEffect(() => {
    setTimeout(() => setMounted(true), 50);
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toISOString().replace('T', ' ').split('.')[0] + ' UTC');
    };
    updateTime();
    const id = setInterval(updateTime, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then(r => r.json())
      .then(() => setBackendStatus('online'))
      .catch(() => setBackendStatus('offline'));
  }, []);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('finsight-recent') || '[]');
    setRecentTickers(saved.slice(0, 5));
  }, []);

  useEffect(() => setHighlightIdx(-1), [suggestions]);

  const saveRecent = (ticker) => {
    const recent = JSON.parse(localStorage.getItem('finsight-recent') || '[]');
    const updated = [ticker, ...recent.filter(t => t !== ticker)].slice(0, 5);
    localStorage.setItem('finsight-recent', JSON.stringify(updated));
  };

  const handleSelect = (symbol) => {
    setDropdownOpen(false);
    setInput('');
    saveRecent(symbol);
    onSearch(symbol);
  };

  const handleKeyDown = (e) => {
    if (dropdownOpen && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIdx(i => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIdx(i => Math.max(i - 1, -1));
        return;
      }
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        return;
      }
      if (e.key === 'Enter' && highlightIdx >= 0) {
        handleSelect(suggestions[highlightIdx].symbol);
        return;
      }
    }
    if (e.key === 'Enter' && input.trim()) {
      handleSelect(input.trim().toUpperCase());
    }
  };

  const handleChipClick = (ticker) => {
    saveRecent(ticker);
    onSearch(ticker);
  };

  const defaultTickers = ['NVDA', 'AAPL', 'TSLA', 'MSFT', 'GOOGL'];
  const chips = recentTickers.length > 0 ? recentTickers : defaultTickers;
  const chipsLabel = recentTickers.length > 0 ? 'RECENT_SEARCHES' : 'QUICK_ACCESS';

  const fadeIn = (delay) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(12px)',
    transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
  });

  const statusDotColor = backendStatus === 'online' ? 'var(--accent-green)' : backendStatus === 'offline' ? 'var(--accent-red)' : 'var(--accent-amber)';

  return (
    <div style={{
      height: '100vh', width: '100%', display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden', backgroundColor: 'var(--bg-primary)',
      fontFamily: 'var(--font-mono)',
    }}>

      {/* Animated grid background */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none',
        backgroundImage: `
          radial-gradient(ellipse at 50% 40%, rgba(232,168,56,0.05) 0%, transparent 60%),
          repeating-linear-gradient(rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 48px),
          repeating-linear-gradient(90deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 48px)
        `,
      }} />

      {/* Scanline overlay */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0,
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)',
      }} />

      {/* Moving scanline sweep */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '1px',
        background: 'linear-gradient(90deg, transparent 0%, rgba(232,168,56,0.04) 20%, rgba(232,168,56,0.09) 50%, rgba(232,168,56,0.04) 80%, transparent 100%)',
        pointerEvents: 'none', zIndex: 2,
        animation: 'scanlineSweep 10s linear infinite',
      }} />

      {/* Background data streams */}
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0, opacity: 0.07 }} aria-hidden="true">
        {streams.map(s => (
          <text
            key={s.id}
            x={`${s.x}%`}
            style={{ animation: `dataStream ${s.speed}s linear ${s.delay}s infinite`, fontFamily: 'monospace', fontSize: '9px', fill: '#e8a838' }}
          >
            {s.chars.map((ch, ci) => (
              <tspan key={ci} x={`${s.x}%`} dy={ci === 0 ? '-120%' : '1.4em'}>{ch}</tspan>
            ))}
          </text>
        ))}
      </svg>

      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: '48px', borderBottom: '1px solid var(--border)',
        flexShrink: 0, position: 'relative', zIndex: 10,
        ...fadeIn(0),
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '2px' }}>
            FINSIGHT <span style={{ color: 'var(--accent-green)' }}>V4.1.0</span>
          </span>
          <span style={{ width: '1px', height: '12px', backgroundColor: 'var(--border)' }} />
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '1.5px' }}>
            SOVEREIGN ANALYSIS TERMINAL
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px', fontVariantNumeric: 'tabular-nums' }}>
            {time}
          </span>
          <span style={{ width: '1px', height: '12px', backgroundColor: 'var(--border)' }} />
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px' }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              backgroundColor: statusDotColor,
              boxShadow: backendStatus === 'online' ? `0 0 8px ${statusDotColor}` : 'none',
              animation: backendStatus === 'online' ? 'pulse 2s infinite' : 'none',
            }} />
            {backendStatus === 'online' ? 'SYSTEMS_ONLINE' : backendStatus === 'offline' ? 'BACKEND_OFFLINE' : 'CONNECTING...'}
          </span>
          <span style={{ width: '1px', height: '12px', backgroundColor: 'var(--border)' }} />
          <button
            onClick={() => setShowTutorial(true)}
            style={{
              background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
              fontSize: '9px', letterSpacing: '1.5px', padding: '4px 10px', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', transition: 'border-color 0.2s, color 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent-amber)'; e.currentTarget.style.color = 'var(--accent-amber)'; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            ? GUIDE
          </button>
          <button
            onClick={onLogout}
            style={{
              background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
              fontSize: '9px', letterSpacing: '1.5px', padding: '4px 10px', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', transition: 'border-color 0.2s, color 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent-red)'; e.currentTarget.style.color = 'var(--accent-red)'; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            LOGOUT
          </button>
        </div>
      </div>

      {/* Main 3-column layout */}
      <div style={{
        flex: 1, display: 'grid', gridTemplateColumns: '220px 1fr 220px',
        minHeight: 0, position: 'relative', zIndex: 1,
      }}>

        {/* LEFT PANEL — Market Indices */}
        <div style={{
          borderRight: '1px solid var(--border)',
          padding: '24px 0',
          display: 'flex', flexDirection: 'column', gap: 0,
          ...fadeIn(100),
        }}>
          <div style={{
            padding: '0 20px 14px', fontSize: '9px', letterSpacing: '2px',
            color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', marginBottom: '4px',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ width: '4px', height: '4px', backgroundColor: 'var(--accent-amber)', display: 'inline-block' }} />
            MARKET_INDICES
          </div>

          {INDICES.map((idx, i) => (
            <div
              key={idx.label}
              style={{
                padding: '10px 20px',
                display: 'flex', flexDirection: 'column', gap: '3px',
                borderBottom: '1px solid rgba(30,42,58,0.5)',
                opacity: mounted ? (flickering.has(i) ? 0.4 : 1) : 0,
                transition: flickering.has(i) ? 'opacity 0.05s' : `opacity 0.5s ease ${150 + i * 60}ms`,
                transform: mounted ? 'translateX(0)' : 'translateX(-8px)',
              }}
            >
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '1px' }}>{idx.label}</span>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-primary)', letterSpacing: '0.5px', fontVariantNumeric: 'tabular-nums' }}>
                  {idx.value}
                </span>
                <span style={{ fontSize: '9px', color: idx.pos ? 'var(--accent-green)' : 'var(--accent-red)', letterSpacing: '0.5px' }}>
                  {idx.change}
                </span>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 'auto', padding: '14px 20px 0', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '6px' }}>DATA_LATENCY</div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '24px' }}>
              {[4, 7, 5, 9, 6, 8, 5, 7, 10, 6].map((h, i) => (
                <div key={i} style={{
                  flex: 1, backgroundColor: 'var(--accent-amber)',
                  height: `${h * 10}%`, opacity: 0.3 + (i / 10) * 0.5,
                  transition: `height 0.8s ease ${i * 80}ms`,
                }} />
              ))}
            </div>
            <div style={{ fontSize: '8px', color: 'var(--accent-amber)', letterSpacing: '1px', marginTop: '6px' }}>
              AVG 2.3s / ANALYSIS
            </div>
          </div>
        </div>

        {/* CENTER — Hero + Search */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '48px 60px',
        }}>

          {/* Hero */}
          <div style={{ textAlign: 'center', marginBottom: '48px', ...fadeIn(200) }}>
            <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '4px', marginBottom: '16px' }}>
              ── SOVEREIGN INTELLIGENCE SYSTEM ──
            </div>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <h1 style={{
                fontFamily: 'var(--font-display)', fontSize: '80px', color: 'var(--accent-amber)',
                letterSpacing: '12px', margin: 0, lineHeight: 1,
                textShadow: '0 0 60px rgba(232,168,56,0.2), 0 0 120px rgba(232,168,56,0.08)',
                animation: glitching ? 'logoGlitch 0.4s steps(2) forwards' : 'none',
                position: 'relative', zIndex: 1,
              }}>
                FINSIGHT
              </h1>
              {/* Cyan ghost */}
              <h1 aria-hidden="true" style={{
                fontFamily: 'var(--font-display)', fontSize: '80px', color: '#00f0ff',
                letterSpacing: '12px', margin: 0, lineHeight: 1,
                position: 'absolute', top: 0, left: 0, zIndex: 0,
                opacity: glitching ? 0.4 : 0,
                transform: glitching ? 'translate(-4px, -3px) skewX(-3deg)' : 'none',
                transition: glitching ? 'none' : 'opacity 0.15s',
                pointerEvents: 'none',
              }}>FINSIGHT</h1>
              {/* Red ghost */}
              <h1 aria-hidden="true" style={{
                fontFamily: 'var(--font-display)', fontSize: '80px', color: '#ff2060',
                letterSpacing: '12px', margin: 0, lineHeight: 1,
                position: 'absolute', top: 0, left: 0, zIndex: 0,
                opacity: glitching ? 0.3 : 0,
                transform: glitching ? 'translate(4px, 3px) skewX(2deg)' : 'none',
                transition: glitching ? 'none' : 'opacity 0.15s',
                pointerEvents: 'none',
              }}>FINSIGHT</h1>
            </div>
            <div style={{
              color: 'var(--text-muted)', letterSpacing: '5px', fontSize: '9px', marginTop: '14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
            }}>
              <span style={{ width: '40px', height: '1px', backgroundColor: 'var(--border)' }} />
              PRECISION FINANCIAL INTELLIGENCE
              <span style={{ width: '40px', height: '1px', backgroundColor: 'var(--border)' }} />
            </div>
          </div>

          {/* Search card with corner brackets */}
          <div style={{ width: '100%', maxWidth: '540px', position: 'relative', ...fadeIn(350) }}>
            {/* Amber corner brackets */}
            {[
              { top: -6, left: -6, borderTop: '2px solid var(--accent-amber)', borderLeft: '2px solid var(--accent-amber)' },
              { top: -6, right: -6, borderTop: '2px solid var(--accent-amber)', borderRight: '2px solid var(--accent-amber)' },
              { bottom: -6, left: -6, borderBottom: '2px solid var(--accent-amber)', borderLeft: '2px solid var(--accent-amber)' },
              { bottom: -6, right: -6, borderBottom: '2px solid var(--accent-amber)', borderRight: '2px solid var(--accent-amber)' },
            ].map((s, i) => (
              <div key={i} style={{ position: 'absolute', width: '14px', height: '14px', ...s, transition: 'opacity 0.5s ease 400ms', opacity: mounted ? 1 : 0 }} />
            ))}

            <div style={{
              backgroundColor: 'rgba(17,23,32,0.8)',
              border: '1px solid var(--border)',
              padding: '24px',
              backdropFilter: 'blur(4px)',
            }}>
              <div style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '2px', marginBottom: '14px' }}>
                ENTER ANALYSIS TARGET
              </div>

              {/* Input */}
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                <span style={{
                  position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                  color: focused ? 'var(--accent-amber)' : 'var(--text-muted)', fontSize: '13px', transition: 'color 0.2s',
                }}>⌕</span>
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => { setFocused(true); clearTimeout(blurTimer.current); setDropdownOpen(true); }}
                  onBlur={() => { setFocused(false); blurTimer.current = setTimeout(() => setDropdownOpen(false), 150); }}
                  placeholder="TICKER SYMBOL..."
                  autoFocus
                  style={{
                    width: '100%', padding: '13px 80px 13px 42px',
                    fontSize: '14px', letterSpacing: '2px',
                    backgroundColor: 'var(--bg-primary)',
                    border: `1px solid ${focused ? 'var(--accent-amber)' : 'var(--border)'}`,
                    color: 'var(--text-primary)', outline: 'none',
                    fontFamily: 'var(--font-mono)',
                    boxShadow: focused ? '0 0 24px rgba(232,168,56,0.1), inset 0 0 12px rgba(232,168,56,0.03)' : 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    caretColor: 'var(--accent-amber)',
                  }}
                />
                {dropdownOpen && suggestions.length > 0 && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--accent-amber)',
                    borderTop: 'none',
                  }}>
                    {suggestions.map((s, i) => (
                      <div
                        key={s.symbol}
                        onMouseDown={() => handleSelect(s.symbol)}
                        onMouseEnter={() => setHighlightIdx(i)}
                        onMouseLeave={() => setHighlightIdx(-1)}
                        style={{
                          padding: '9px 16px',
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'baseline', gap: '12px',
                          backgroundColor: i === highlightIdx ? 'rgba(232,168,56,0.08)' : 'transparent',
                          borderLeft: `2px solid ${i === highlightIdx ? 'var(--accent-amber)' : 'transparent'}`,
                        }}
                      >
                        <span style={{ color: 'var(--accent-amber)', fontSize: '13px', fontWeight: 'bold', minWidth: '64px', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>
                          {s.symbol}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '0.5px' }}>
                          {s.description}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <span style={{
                  position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
                  fontSize: '9px', color: focused ? 'var(--accent-amber)' : 'var(--text-muted)',
                  letterSpacing: '1px', transition: 'color 0.2s',
                }}>ENTER ↵</span>
              </div>

              {/* Chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '1.5px', flexShrink: 0 }}>
                  {chipsLabel}:
                </span>
                {chips.map((t, i) => (
                  <div
                    key={t}
                    onClick={() => handleChipClick(t)}
                    style={{
                      border: '1px solid var(--border)', padding: '4px 10px',
                      cursor: 'pointer', color: 'var(--text-primary)', fontSize: '10px',
                      letterSpacing: '1px', transition: 'all 0.15s',
                      backgroundColor: 'var(--bg-primary)',
                      opacity: mounted ? 1 : 0,
                      transform: mounted ? 'scale(1)' : 'scale(0.9)',
                      transitionDelay: `${500 + i * 50}ms`,
                    }}
                    onMouseOver={e => {
                      e.currentTarget.style.borderColor = 'var(--accent-amber)';
                      e.currentTarget.style.color = 'var(--accent-amber)';
                      e.currentTarget.style.backgroundColor = 'rgba(232,168,56,0.06)';
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                      e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                    }}
                  >
                    {t}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom hint */}
          <div style={{ marginTop: '32px', display: 'flex', gap: '24px', ...fadeIn(600) }}>
            {[
              { icon: '◈', text: 'MULTI-SOURCE ANALYSIS' },
              { icon: '⬡', text: 'LLM SYNTHESIS' },
              { icon: '◎', text: 'REAL-TIME SIGNALS' },
            ].map(item => (
              <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '1px' }}>
                <span style={{ color: 'var(--accent-amber)', opacity: 0.6, fontSize: '10px' }}>{item.icon}</span>
                {item.text}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL — Pipeline Status */}
        <div style={{
          borderLeft: '1px solid var(--border)',
          padding: '24px 0',
          display: 'flex', flexDirection: 'column', gap: 0,
          ...fadeIn(100),
        }}>
          <div style={{
            padding: '0 20px 14px', fontSize: '9px', letterSpacing: '2px',
            color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', marginBottom: '4px',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ width: '4px', height: '4px', backgroundColor: 'var(--accent-green)', display: 'inline-block', borderRadius: '50%' }} />
            PIPELINE_STATUS
          </div>

          {PIPELINE.map((mod, i) => (
            <div
              key={mod.label}
              style={{
                padding: '10px 20px',
                display: 'flex', flexDirection: 'column', gap: '3px',
                borderBottom: '1px solid rgba(30,42,58,0.5)',
                opacity: mounted ? 1 : 0,
                transform: mounted ? 'translateX(0)' : 'translateX(8px)',
                transition: `opacity 0.5s ease ${150 + i * 70}ms, transform 0.5s ease ${150 + i * 70}ms`,
              }}
            >
              <span style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '1px' }}>{mod.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '6px', color: mod.ok ? 'var(--accent-green)' : 'var(--accent-red)' }}>■</span>
                <span style={{ fontSize: '10px', color: mod.ok ? 'var(--accent-green)' : 'var(--accent-red)', letterSpacing: '0.5px' }}>
                  {mod.status}
                </span>
              </div>
            </div>
          ))}

          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(30,42,58,0.5)' }}>
            <div style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '8px' }}>SESSION_STATS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                <span style={{ color: 'var(--text-muted)' }}>TODAY'S ANALYSES</span>
                <span style={{ color: 'var(--accent-amber)' }}>{displayCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                <span style={{ color: 'var(--text-muted)' }}>DATA SOURCES</span>
                <span style={{ color: 'var(--accent-green)' }}>8 LIVE</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                <span style={{ color: 'var(--text-muted)' }}>MODEL VERSION</span>
                <span style={{ color: 'var(--text-primary)' }}>4.1.0</span>
              </div>
            </div>
          </div>

          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '8px' }}>CLEARANCE</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {['L1 BASIC', 'L2 STANDARD', 'L3 ADVANCED', 'L4 SOVEREIGN'].map((tier, i) => (
                <div key={tier} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '4px 8px',
                  backgroundColor: i === 3 ? 'rgba(232,168,56,0.08)' : 'transparent',
                  border: i === 3 ? '1px solid rgba(232,168,56,0.2)' : '1px solid transparent',
                }}>
                  <span style={{ fontSize: '6px', color: i === 3 ? 'var(--accent-amber)' : 'var(--border)' }}>■</span>
                  <span style={{ fontSize: '8px', color: i === 3 ? 'var(--accent-amber)' : 'var(--text-muted)', letterSpacing: '1px' }}>
                    {tier}
                  </span>
                  {i === 3 && <span style={{ marginLeft: 'auto', fontSize: '7px', color: 'var(--accent-amber)', opacity: 0.7 }}>ACTIVE</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Market ticker strip */}
      <div style={{
        borderTop: '1px solid var(--border)', height: '28px',
        overflow: 'hidden', flexShrink: 0, position: 'relative', zIndex: 10,
        backgroundColor: 'var(--bg-secondary)',
        ...fadeIn(700),
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', height: '100%',
          animation: 'tickerScroll 30s linear infinite',
          whiteSpace: 'nowrap',
        }}>
          {[...TICKER_STRIP, ...TICKER_STRIP].map((item, i) => {
            const isPos = item.includes('+');
            return (
              <span key={i} style={{
                fontSize: '9px', letterSpacing: '1px', marginRight: '32px',
                color: isPos ? 'var(--accent-green)' : 'var(--accent-red)',
                flexShrink: 0,
              }}>
                {item}
              </span>
            );
          })}
        </div>
      </div>

      {/* Bottom status bar */}
      <div style={{
        borderTop: '1px solid var(--border)',
        padding: '6px 32px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '1px',
        backgroundColor: 'var(--bg-primary)', flexShrink: 0,
      }}>
        <span>SOVEREIGN ANALYSIS ENGINE // MULTI-SOURCE PIPELINE // LLM SYNTHESIS</span>
        <span style={{ color: 'var(--accent-amber)', opacity: 0.5 }}>FINSIGHT © 2026</span>
      </div>

      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}

      <style>{`
        @keyframes tickerScroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes scanlineSweep {
          0%   { top: -3px; opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes dataStream {
          0%   { transform: translateY(-100vh); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0; }
        }
        @keyframes logoGlitch {
          0%   { transform: skewX(0deg) translateX(0); clip-path: inset(0 0 60% 0); }
          25%  { transform: skewX(-4deg) translateX(3px); clip-path: inset(20% 0 40% 0); }
          50%  { transform: skewX(3deg) translateX(-3px); clip-path: inset(50% 0 10% 0); }
          75%  { transform: skewX(-2deg) translateX(2px); clip-path: inset(30% 0 30% 0); }
          100% { transform: skewX(0deg) translateX(0); clip-path: inset(0 0 0 0); }
        }
      `}</style>
    </div>
  );
}

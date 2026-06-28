import React, { useState, useEffect } from 'react';

const STEPS = [
  {
    icon: '⌕',
    title: 'ENTER TICKER SYMBOL',
    body: 'Type any stock ticker (NVDA, AAPL, TSLA) into the search bar and press ENTER. Finsight accepts NYSE, NASDAQ, and NSE India symbols.',
    detail: 'TIP: Use the QUICK_ACCESS chips below the search bar for fast access to common names.',
    color: 'var(--accent-amber)',
  },
  {
    icon: '◈',
    title: 'ANALYSIS PIPELINE RUNS',
    body: 'Eight data sources are queried concurrently — SEC filings, StockTwits sentiment, Finnhub news, fundamentals, technical indicators, NSE corporate actions, and more.',
    detail: 'Each source reports LIVE, CACHED, or UNAVAILABLE. Results stream in real-time as tools complete.',
    color: 'var(--accent-blue)',
  },
  {
    icon: '⬡',
    title: 'SIGNALS & CONFLICT DETECTION',
    body: 'Bull and bear signals are extracted and cross-validated. When sources disagree, the CONFLICT PANEL flags the discrepancy with severity ratings.',
    detail: 'Conflicts are not errors — they represent genuine market ambiguity. The ConfidenceGauge reflects this.',
    color: 'var(--accent-green)',
  },
  {
    icon: '◎',
    title: 'LLM SYNTHESIS REPORT',
    body: 'All signals are synthesized into a plain-English analysis by the LLM core. Scroll the terminal view to read the full report, bull/bear breakdown, and final verdict.',
    detail: 'Use WATCHLIST to save tickers. Use SIGNALS to track your history across sessions.',
    color: '#b06efc',
  },
];

export default function TutorialModal({ onClose }) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [lineVisible, setLineVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisible(true), 30);
    setTimeout(() => setLineVisible(true), 400);
  }, []);

  const dismiss = () => {
    localStorage.setItem('finsight-tutorial-seen', '1');
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setLineVisible(false);
      setTimeout(() => { setStep(s => s + 1); setLineVisible(true); }, 150);
    } else {
      dismiss();
    }
  };

  const prev = () => {
    if (step > 0) {
      setLineVisible(false);
      setTimeout(() => { setStep(s => s - 1); setLineVisible(true); }, 150);
    }
  };

  const current = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      backgroundColor: 'rgba(6,10,18,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(3px)',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.3s ease',
    }}>
      <div style={{
        width: '480px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        position: 'relative',
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.97)',
        transition: 'transform 0.3s ease, opacity 0.3s ease',
        opacity: visible ? 1 : 0,
        fontFamily: 'var(--font-mono)',
      }}>

        {/* Amber corner brackets */}
        {[
          { top: -5, left: -5, borderTop: '2px solid var(--accent-amber)', borderLeft: '2px solid var(--accent-amber)' },
          { top: -5, right: -5, borderTop: '2px solid var(--accent-amber)', borderRight: '2px solid var(--accent-amber)' },
          { bottom: -5, left: -5, borderBottom: '2px solid var(--accent-amber)', borderLeft: '2px solid var(--accent-amber)' },
          { bottom: -5, right: -5, borderBottom: '2px solid var(--accent-amber)', borderRight: '2px solid var(--accent-amber)' },
        ].map((s, i) => (
          <div key={i} style={{ position: 'absolute', width: '12px', height: '12px', ...s }} />
        ))}

        {/* Header */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '8px', color: 'var(--accent-amber)', letterSpacing: '2px' }}>■</span>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '2px' }}>SYSTEM_INITIALIZATION</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '1px' }}>
              {String(step + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
            </span>
            <button
              onClick={dismiss}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px', fontFamily: 'var(--font-mono)' }}
              onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
              title="Close"
            >×</button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: '2px', backgroundColor: 'var(--bg-primary)', position: 'relative' }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            backgroundColor: current.color,
            transition: 'width 0.3s ease, background-color 0.3s ease',
            boxShadow: `0 0 8px ${current.color}`,
          }} />
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: '6px', padding: '14px 20px 0', justifyContent: 'center' }}>
          {STEPS.map((s, i) => (
            <div
              key={i}
              onClick={() => { setLineVisible(false); setTimeout(() => { setStep(i); setLineVisible(true); }, 150); }}
              style={{
                width: i === step ? '20px' : '6px', height: '4px',
                backgroundColor: i <= step ? current.color : 'var(--border)',
                transition: 'width 0.3s ease, background-color 0.3s ease',
                cursor: 'pointer',
                opacity: i < step ? 0.5 : 1,
              }}
            />
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: '24px 28px 20px' }}>
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '16px',
            marginBottom: '20px',
            opacity: lineVisible ? 1 : 0,
            transform: lineVisible ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.25s ease, transform 0.25s ease',
          }}>
            <div style={{
              width: '44px', height: '44px', flexShrink: 0,
              border: `1px solid ${current.color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '20px', color: current.color,
              boxShadow: `0 0 16px ${current.color}22`,
            }}>
              {current.icon}
            </div>
            <div>
              <div style={{ fontSize: '11px', color: current.color, letterSpacing: '2px', marginBottom: '8px' }}>
                {current.title}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-primary)', lineHeight: '1.7', letterSpacing: '0.3px' }}>
                {current.body}
              </div>
            </div>
          </div>

          {/* Detail line */}
          <div style={{
            borderLeft: `2px solid ${current.color}`,
            paddingLeft: '12px',
            fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.6',
            opacity: lineVisible ? 0.9 : 0,
            transition: 'opacity 0.3s ease 0.1s',
          }}>
            {current.detail}
          </div>
        </div>

        {/* Step preview strip */}
        <div style={{
          margin: '0 28px 20px',
          display: 'flex', gap: '8px',
        }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{
              flex: 1, padding: '8px 6px',
              border: `1px solid ${i === step ? current.color : 'var(--border)'}`,
              backgroundColor: i === step ? `${current.color}0d` : 'transparent',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
              onClick={() => { setLineVisible(false); setTimeout(() => { setStep(i); setLineVisible(true); }, 150); }}
            >
              <span style={{ fontSize: '12px', color: i === step ? current.color : 'var(--text-muted)', opacity: i === step ? 1 : 0.5 }}>{s.icon}</span>
              <span style={{ fontSize: '7px', letterSpacing: '0.8px', color: i === step ? current.color : 'var(--text-muted)', textAlign: 'center', opacity: i === step ? 1 : 0.5 }}>
                {s.title.split(' ').slice(0, 2).join(' ')}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <button
            onClick={dismiss}
            style={{
              background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
              fontSize: '9px', letterSpacing: '1.5px', padding: '6px 14px', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', transition: 'all 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--text-muted)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            SKIP
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            {step > 0 && (
              <button
                onClick={prev}
                style={{
                  background: 'none', border: `1px solid var(--border)`, color: 'var(--text-muted)',
                  fontSize: '9px', letterSpacing: '1.5px', padding: '6px 14px', cursor: 'pointer',
                  fontFamily: 'var(--font-mono)', transition: 'all 0.2s',
                }}
                onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--text-muted)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                ◂ PREV
              </button>
            )}
            <button
              onClick={next}
              style={{
                background: `${current.color}1a`, border: `1px solid ${current.color}`,
                color: current.color, fontSize: '9px', letterSpacing: '1.5px',
                padding: '6px 18px', cursor: 'pointer', fontFamily: 'var(--font-mono)',
                transition: 'all 0.2s',
                boxShadow: `0 0 12px ${current.color}22`,
              }}
              onMouseOver={e => { e.currentTarget.style.backgroundColor = `${current.color}33`; e.currentTarget.style.boxShadow = `0 0 20px ${current.color}44`; }}
              onMouseOut={e => { e.currentTarget.style.backgroundColor = `${current.color}1a`; e.currentTarget.style.boxShadow = `0 0 12px ${current.color}22`; }}
            >
              {step === STEPS.length - 1 ? 'INITIALIZE TERMINAL ▸' : 'NEXT ▸'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

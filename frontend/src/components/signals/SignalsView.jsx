import React, { useState, useMemo } from 'react';
import { useBriefHistory } from '../../hooks/useBriefHistory';
import SignalCard from './SignalCard';

const FILTERS = ['ALL', 'BULL', 'BEAR', 'CONFLICTS'];

// Bucket a unix-seconds timestamp into a human day-group label.
function dayLabel(ts) {
  const d = new Date(ts * 1000);
  const today = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(d)) / 86400000);
  if (diffDays <= 0) return 'TODAY';
  if (diffDays === 1) return 'YESTERDAY';
  if (diffDays < 7) return `${diffDays} DAYS AGO`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
}

export default function SignalsView({ onSelectTicker }) {
  const { briefs, loading } = useBriefHistory();
  const [filter, setFilter] = useState('ALL');

  const allSignals = useMemo(() => {
    const signals = [];
    briefs.forEach(brief => {
      const data = brief.brief_data;
      if (!data) return;
      const t = brief.created_at;

      // Signals live under .signals[] keyed by .type — NOT bull_signals/bear_signals
      (data.signals || []).forEach(s => {
        if (s.type === 'bull' || s.type === 'bear') {
          signals.push({ ...s, ticker: brief.ticker, time: t });
        }
      });
      // Conflicts are plain strings
      (data.conflicts || []).forEach(c => {
        signals.push({ type: 'conflict', text: c, ticker: brief.ticker, time: t });
      });
    });
    return signals.sort((a, b) => b.time - a.time);
  }, [briefs]);

  const counts = useMemo(() => ({
    bull: allSignals.filter(s => s.type === 'bull').length,
    bear: allSignals.filter(s => s.type === 'bear').length,
    conflict: allSignals.filter(s => s.type === 'conflict').length,
  }), [allSignals]);

  const filteredSignals = useMemo(() => {
    if (filter === 'ALL') return allSignals;
    const target = filter === 'CONFLICTS' ? 'conflict' : filter.toLowerCase();
    return allSignals.filter(s => s.type === target);
  }, [allSignals, filter]);

  // Group consecutive signals (already sorted desc) by day label
  const groups = useMemo(() => {
    const out = [];
    let current = null;
    filteredSignals.forEach(sig => {
      const label = dayLabel(sig.time);
      if (!current || current.label !== label) {
        current = { label, items: [] };
        out.push(current);
      }
      current.items.push(sig);
    });
    return out;
  }, [filteredSignals]);

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-amber)', fontSize: '24px', letterSpacing: '2px' }}>SIGNAL_FEED</h2>
          <div style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '1px', marginTop: '4px' }}>REAL-TIME_INTELLIGENCE_STREAM</div>
        </div>

        <div className="filter-bar" style={{ marginBottom: 0 }}>
          {FILTERS.map(f => (
            <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
      </div>

      {/* Stats summary */}
      <div className="signal-stats">
        <span><b style={{ color: 'var(--text-primary)' }}>{allSignals.length}</b> TOTAL</span>
        <span className="signal-stats-sep">·</span>
        <span style={{ color: 'var(--accent-green)' }}>▲ {counts.bull} BULL</span>
        <span className="signal-stats-sep">·</span>
        <span style={{ color: 'var(--accent-red)' }}>▼ {counts.bear} BEAR</span>
        <span className="signal-stats-sep">·</span>
        <span style={{ color: 'var(--accent-amber)' }}>⚡ {counts.conflict} CONFLICTS</span>
      </div>

      {loading && allSignals.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '48px', letterSpacing: '1px' }}>RETRIEVING_SIGNALS...</div>
      ) : allSignals.length === 0 ? (
        <div style={{ border: '1px dashed var(--border)', padding: '64px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '14px', marginBottom: '8px', letterSpacing: '1px' }}>NO SIGNALS RECORDED</div>
          <div style={{ fontSize: '10px', letterSpacing: '0.5px' }}>ANALYZE A TICKER IN THE TERMINAL TO GENERATE INTELLIGENCE SIGNALS</div>
        </div>
      ) : filteredSignals.length === 0 ? (
        <div style={{ border: '1px dashed var(--border)', padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '1px' }}>
          NO {filter} SIGNALS
        </div>
      ) : (
        <div className="signal-feed">
          {groups.map((group, gi) => {
            // continuous index across groups so stagger looks natural
            const offset = groups.slice(0, gi).reduce((n, g) => n + g.items.length, 0);
            return (
              <div key={group.label} className="signal-group">
                <div className="signal-group-header">
                  <span>{group.label}</span>
                  <span className="signal-group-line" />
                  <span className="signal-group-count">{group.items.length}</span>
                </div>
                {group.items.map((signal, i) => (
                  <SignalCard
                    key={`${signal.ticker}-${signal.time}-${offset + i}`}
                    signal={signal}
                    index={Math.min(offset + i, 12)}
                    onClick={() => onSelectTicker(signal.ticker)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

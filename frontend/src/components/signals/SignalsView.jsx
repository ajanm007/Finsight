import React, { useState, useMemo } from 'react';
import { useBriefHistory } from '../../hooks/useBriefHistory';
import SignalCard from './SignalCard';

export default function SignalsView({ onSelectTicker }) {
  const { briefs, loading } = useBriefHistory();
  const [filter, setFilter] = useState('ALL'); // ALL, BULL, BEAR, CONFLICTS

  const allSignals = useMemo(() => {
    const signals = [];
    briefs.forEach(brief => {
      const data = brief.brief_data;
      if (!data) return;

      // Add bull signals
      (data.bull_signals || []).forEach(s => signals.push({ ...s, type: 'bull', ticker: brief.ticker, time: brief.created_at }));
      // Add bear signals
      (data.bear_signals || []).forEach(s => signals.push({ ...s, type: 'bear', ticker: brief.ticker, time: brief.created_at }));
      // Add conflicts
      (data.conflicts || []).forEach(s => signals.push({ text: s, type: 'conflict', ticker: brief.ticker, time: brief.created_at }));
    });
    return signals.sort((a, b) => b.time - a.time);
  }, [briefs]);

  const filteredSignals = useMemo(() => {
    if (filter === 'ALL') return allSignals;
    return allSignals.filter(s => s.type.toUpperCase() === filter.replace('S', ''));
  }, [allSignals, filter]);

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-amber)', fontSize: '24px', letterSpacing: '2px' }}>SIGNAL_FEED</h2>
          <div style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '1px', marginTop: '4px' }}>REAL-TIME_INTELLIGENCE_STREAM</div>
        </div>

        <div className="filter-bar">
          {['ALL', 'BULL', 'BEAR', 'CONFLICTS'].map(f => (
            <button 
              key={f} 
              className={`filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: '1px', backgroundColor: 'var(--border)' }}></div>

      {loading && allSignals.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '48px' }}>RETRIEVING_SIGNALS...</div>
      ) : allSignals.length === 0 ? (
        <div style={{ 
          border: '1px dashed var(--border)', 
          padding: '64px', 
          textAlign: 'center', 
          color: 'var(--text-muted)'
        }}>
          <div style={{ fontSize: '14px', marginBottom: '8px' }}>NO SIGNALS RECORDED</div>
          <div style={{ fontSize: '10px' }}>ANALYZE A TICKER IN THE TERMINAL TO GENERATE INTELLIGENCE SIGNALS</div>
        </div>
      ) : (
        <div className="signal-feed">
          {filteredSignals.map((signal, i) => (
            <SignalCard 
              key={`${signal.ticker}-${signal.time}-${i}`} 
              signal={signal} 
              onClick={() => onSelectTicker(signal.ticker)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

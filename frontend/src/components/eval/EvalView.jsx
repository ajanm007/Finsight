import React, { useState } from 'react';
import { useEvalData } from '../../hooks/useEvalData';

export default function EvalView() {
  const { stats, details, loading, error, refresh, runEval } = useEvalData();
  const [filter, setFilter] = useState('ALL');

  if (loading && !stats) {
    return <div className="view-container" style={{ textAlign: 'center', padding: '100px' }}>INITIALIZING_EVAL_STREAM...</div>;
  }

  const filteredDetails = details.filter(item => {
    if (filter === 'ALL') return true;
    if (filter === 'CORRECT') return item.is_correct === 1;
    if (filter === 'INCORRECT') return item.is_correct === 0;
    if (filter === 'PENDING') return item.eval_status === 'pending';
    return true;
  });

  return (
    <div className="view-container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-amber)', fontSize: '24px', letterSpacing: '2px', marginBottom: '4px' }}>SIGNAL_LEADERBOARD</h2>
          <div style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '1px' }}>ACCURACY_METRICS_AND_PERFORMANCE_AUDIT</div>
        </div>
        <button 
          onClick={runEval}
          className="filter-btn" 
          style={{ background: 'rgba(212, 149, 15, 0.1)', color: 'var(--accent-amber)', border: '1px solid rgba(212, 149, 15, 0.3)' }}
        >
          FORCE_EVALUATION_JOB
        </button>
      </header>

      {/* Aggregate Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '40px' }}>
        <StatCard label="TOTAL_BRIEFS" value={stats?.summary?.total_briefs} />
        <StatCard label="OVERALL_ACCURACY" value={`${stats?.summary?.accuracy_pct}%`} color="var(--accent-amber)" />
        <StatCard label="CORRECT_SIGNALS" value={stats?.summary?.correct} color="#2ea87a" />
        <StatCard label="INCORRECT_SIGNALS" value={stats?.summary?.incorrect} color="#c94040" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '32px' }}>
        {/* Per-Ticker Accuracy */}
        <section>
          <h3 className="section-title">TICKER_PERFORMANCE</h3>
          <div className="fs-card" style={{ padding: '0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '12px' }}>TICKER</th>
                  <th style={{ padding: '12px' }}>SIGNALS</th>
                  <th style={{ padding: '12px' }}>ACCURACY</th>
                </tr>
              </thead>
              <tbody>
                {stats?.tickers?.map(t => (
                  <tr key={t.ticker} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{t.ticker}</td>
                    <td style={{ padding: '12px' }}>{t.total_signals}</td>
                    <td style={{ padding: '12px', color: getAccuracyColor(t.accuracy) }}>{t.accuracy}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Signal History */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="section-title" style={{ margin: 0 }}>SIGNAL_HISTORY</h3>
            <div className="filter-bar" style={{ marginBottom: 0 }}>
              {['ALL', 'CORRECT', 'INCORRECT', 'PENDING'].map(f => (
                <button 
                  key={f} 
                  className={`filter-btn ${filter === f ? 'active' : ''}`}
                  onClick={() => setFilter(f)}
                  style={{ fontSize: '9px', padding: '4px 8px' }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredDetails.map(item => (
              <div key={item.id} className="fs-card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `3px solid ${getStatusColor(item)}` }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '14px', letterSpacing: '1px' }}>{item.ticker}</span>
                    <span style={{ 
                      fontSize: '9px', 
                      padding: '2px 6px', 
                      borderRadius: '2px',
                      background: item.net_signal === 'bullish' ? 'rgba(46, 168, 122, 0.1)' : 'rgba(201, 64, 64, 0.1)',
                      color: item.net_signal === 'bullish' ? '#2ea87a' : '#c94040'
                    }}>
                      {item.net_signal.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {new Date(item.created_at * 1000).toLocaleDateString()} // PRICE_ENTRY: ${item.price_at_brief?.toFixed(2)}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  {item.eval_status === 'pending' ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '1px' }}>HOLDING_PERIOD...</div>
                  ) : item.eval_status === 'skipped' ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>SKIPPED</div>
                  ) : (
                    <>
                      <div style={{ fontSize: '14px', fontWeight: 'bold', color: item.is_correct ? '#2ea87a' : '#c94040' }}>
                        {item.is_correct ? 'PASSED' : 'FAILED'}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        5D_OUTCOME: ${item.price_5d_later?.toFixed(2)}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'var(--text-primary)' }) {
  return (
    <div className="fs-card" style={{ padding: '20px' }}>
      <div style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '2px', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 'bold', color, fontFamily: 'var(--font-display)' }}>{value}</div>
    </div>
  );
}

function getAccuracyColor(acc) {
  if (acc >= 60) return '#2ea87a';
  if (acc >= 40) return 'var(--accent-amber)';
  return '#c94040';
}

function getStatusColor(item) {
  if (item.eval_status === 'pending') return 'var(--border)';
  if (item.eval_status === 'skipped') return '#5a5850';
  return item.is_correct ? '#2ea87a' : '#c94040';
}

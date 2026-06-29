import { useState } from 'react';
import { useEvalData } from '../../hooks/useEvalData';
import './eval.css';

function accuracyColor(acc) {
  if (acc >= 60) return '#2ea87a';
  if (acc >= 40) return 'var(--accent-amber)';
  return '#c94040';
}

export default function EvalView() {
  const { stats, details, loading, error, refresh, runEval } = useEvalData();
  const [filter, setFilter] = useState('ALL');
  const [running, setRunning] = useState(false);

  if (loading && !stats) {
    return <div className="view-container" style={{ textAlign: 'center', padding: '100px', letterSpacing: '1px' }}>INITIALIZING_EVAL_STREAM...</div>;
  }

  const summary = stats?.summary || {};
  const accuracy = Number(summary.accuracy_pct) || 0;
  const tickers = stats?.tickers || [];

  const handleRun = async () => {
    setRunning(true);
    try { await runEval(); } finally { setRunning(false); }
  };

  const filteredDetails = details.filter(item => {
    if (filter === 'ALL') return true;
    if (filter === 'CORRECT') return item.eval_status !== 'pending' && item.eval_status !== 'skipped' && item.is_correct === 1;
    if (filter === 'INCORRECT') return item.eval_status !== 'pending' && item.eval_status !== 'skipped' && item.is_correct === 0;
    if (filter === 'PENDING') return item.eval_status === 'pending';
    return true;
  });

  return (
    <div className="view-container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-amber)', fontSize: '24px', letterSpacing: '2px', marginBottom: '4px' }}>SIGNAL_LEADERBOARD</h2>
          <div style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '1px' }}>ACCURACY_METRICS_AND_PERFORMANCE_AUDIT</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={refresh} className="filter-btn">REFRESH</button>
          <button
            onClick={handleRun}
            className="filter-btn"
            disabled={running}
            style={{ background: 'rgba(232, 168, 56, 0.1)', color: 'var(--accent-amber)', border: '1px solid rgba(232, 168, 56, 0.35)', opacity: running ? 0.5 : 1 }}
          >
            {running ? 'EVALUATING...' : 'FORCE_EVALUATION_JOB'}
          </button>
        </div>
      </header>

      {error && (
        <div style={{ border: '1px solid rgba(231,76,60,0.4)', color: 'var(--accent-red)', padding: '12px 16px', fontSize: '11px', letterSpacing: '0.5px' }}>
          ⚠ {error}
        </div>
      )}

      {/* Aggregate stats */}
      <div className="eval-stats">
        <StatCard label="TOTAL_BRIEFS" value={summary.total_briefs ?? '—'} index={0} />
        <StatCard label="OVERALL_ACCURACY" value={`${accuracy}%`} color={accuracyColor(accuracy)} bar={accuracy} index={1} />
        <StatCard label="CORRECT_SIGNALS" value={summary.correct ?? 0} color="#2ea87a" index={2} />
        <StatCard label="INCORRECT_SIGNALS" value={summary.incorrect ?? 0} color="#c94040" index={3} />
      </div>

      <div className="eval-body">
        {/* Per-ticker accuracy */}
        <section>
          <h3 className="eval-section-title">TICKER_PERFORMANCE</h3>
          <div className="eval-card">
            {tickers.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '1px' }}>NO_TICKER_DATA</div>
            ) : (
              tickers.map(t => {
                const acc = Number(t.accuracy) || 0;
                const col = accuracyColor(acc);
                return (
                  <div key={t.ticker} className="eval-ticker-row">
                    <div>
                      <div className="eval-ticker-name">{t.ticker}</div>
                      <div className="eval-ticker-meta">{t.total_signals} SIG</div>
                    </div>
                    <div className="eval-ticker-bar-track">
                      <div className="eval-ticker-bar-fill" style={{ width: `${acc}%`, backgroundColor: col }} />
                    </div>
                    <div className="eval-ticker-acc" style={{ color: col }}>{acc}%</div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Signal history */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <h3 className="eval-section-title" style={{ margin: 0, flex: '0 0 auto' }}>SIGNAL_HISTORY</h3>
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

          {filteredDetails.length === 0 ? (
            <div style={{ border: '1px dashed var(--border)', padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '1px' }}>
              NO {filter} SIGNALS
            </div>
          ) : (
            <div className="eval-history">
              {filteredDetails.map((item, i) => <HistoryRow key={item.id} item={item} index={Math.min(i, 12)} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'var(--text-primary)', bar, index = 0 }) {
  return (
    <div className="eval-stat" style={{ borderTopColor: color !== 'var(--text-primary)' ? color : 'var(--border)', animationDelay: `${index * 60}ms` }}>
      <div className="eval-stat-label">{label}</div>
      <div className="eval-stat-value" style={{ color }}>{value}</div>
      {typeof bar === 'number' && (
        <div className="eval-stat-bar">
          <div className="eval-stat-bar-fill" style={{ width: `${Math.max(0, Math.min(100, bar))}%`, backgroundColor: color }} />
        </div>
      )}
    </div>
  );
}

function HistoryRow({ item, index }) {
  const isBull = item.net_signal?.includes('bull');
  const isBear = item.net_signal?.includes('bear');
  const sigColor = isBull ? '#2ea87a' : isBear ? '#c94040' : 'var(--accent-amber)';
  const sigBg = isBull ? 'rgba(46,168,122,0.1)' : isBear ? 'rgba(201,64,64,0.1)' : 'rgba(232,168,56,0.1)';

  const status = item.eval_status;
  const isPending = status === 'pending';
  const isSkipped = status === 'skipped';
  const correct = !isPending && !isSkipped && item.is_correct === 1;
  const rowClass = isPending ? 'pending' : isSkipped ? 'skipped' : correct ? 'correct' : 'incorrect';

  const priceMove = (item.price_at_brief && item.price_5d_later)
    ? ((item.price_5d_later - item.price_at_brief) / item.price_at_brief) * 100
    : null;

  return (
    <div className={`eval-history-row ${rowClass}`} style={{ animationDelay: `${index * 40}ms` }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
          <span style={{ fontWeight: 'bold', fontSize: '14px', letterSpacing: '1px' }}>{item.ticker}</span>
          <span className="eval-pill" style={{ background: sigBg, color: sigColor, borderColor: sigColor + '55' }}>
            {(item.net_signal || 'NEUTRAL').toUpperCase().replace(/_/g, ' ')}
          </span>
        </div>
        <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
          {new Date(item.created_at * 1000).toLocaleDateString()} &nbsp;//&nbsp; ENTRY ${item.price_at_brief?.toFixed(2) ?? '—'}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {isPending ? (
          <div style={{ color: 'var(--accent-amber)', fontSize: '10px', letterSpacing: '1px' }}>◷ HOLDING_PERIOD</div>
        ) : isSkipped ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '1px' }}>SKIPPED</div>
        ) : (
          <>
            <div className="eval-outcome" style={{ color: correct ? '#2ea87a' : '#c94040' }}>
              {correct ? '✓ PASSED' : '✗ FAILED'}
            </div>
            <div className="eval-outcome-sub">
              5D ${item.price_5d_later?.toFixed(2) ?? '—'}
              {priceMove !== null && (
                <span style={{ color: priceMove >= 0 ? '#2ea87a' : '#c94040', marginLeft: '6px' }}>
                  {priceMove >= 0 ? '+' : ''}{priceMove.toFixed(1)}%
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

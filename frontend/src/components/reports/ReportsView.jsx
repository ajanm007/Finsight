import { useState, useMemo, useEffect } from 'react';
import { useBriefHistory } from '../../hooks/useBriefHistory';
import { generateMarkdown, downloadFile } from '../../utils/markdownExport';
import { printReport } from '../../utils/printReport';
import { printCompareReport } from '../../utils/printCompareReport';
import { extractSynthesis } from '../../utils/synthesis';
import './reports.css';

export default function ReportsView() {
  const { briefs, loading, fetchById } = useBriefHistory();
  const [selectedBrief, setSelectedBrief] = useState(null);
  const [fullBrief, setFullBrief]         = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [filter, setFilter]               = useState('ALL');
  const [search, setSearch]               = useState('');
  const [compareMode, setCompareMode]     = useState(false);
  const [compareIds, setCompareIds]       = useState(new Set());
  const [printLog, setPrintLog]           = useState(() => {
    try { return JSON.parse(localStorage.getItem('finsight_print_log') || '{}'); }
    catch { return {}; }
  });

  useEffect(() => {
    if (!selectedBrief || compareMode) return;
    setLoadingDetail(true);
    setFullBrief(null);
    fetchById(selectedBrief.id).then(data => {
      setFullBrief(data);
      setLoadingDetail(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBrief?.id, compareMode]);

  const filteredBriefs = useMemo(() => {
    let list = briefs;
    if (filter !== 'ALL') list = list.filter(b => b.net_signal?.includes(filter.toLowerCase().replace('ish', '')));
    if (search) list = list.filter(b => b.ticker.includes(search.toUpperCase()));
    return list;
  }, [briefs, filter, search]);

  // Briefs selected for comparison (full objects from list, which include brief_data)
  const compareBriefs = useMemo(
    () => briefs.filter(b => compareIds.has(b.id)),
    [briefs, compareIds]
  );

  const toggleCompareId = (id) => {
    setCompareIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleExitCompare = () => {
    setCompareMode(false);
    setCompareIds(new Set());
  };

  const handleExportMd = () => {
    if (!fullBrief) return;
    const md = generateMarkdown(fullBrief);
    const filename = `FINSIGHT_${fullBrief.ticker}_${new Date(fullBrief.created_at * 1000).toISOString().split('T')[0]}.md`;
    downloadFile(md, filename, 'text/markdown');
  };

  const handlePrint = () => {
    printReport(fullBrief);
    setTimeout(() => {
      try { setPrintLog(JSON.parse(localStorage.getItem('finsight_print_log') || '{}')); } catch { /* ignore */ }
    }, 200);
  };

  const bd          = fullBrief?.brief_data || {};
  const bullSignals = bd.signals?.filter(s => s.type === 'bull') || [];
  const bearSignals = bd.signals?.filter(s => s.type === 'bear') || [];
  const conflicts   = bd.conflicts || [];
  const dataSources = fullBrief?.sources_snapshot || bd.data_availability || {};
  const confidence  = fullBrief ? Math.round(fullBrief.confidence || 0) : null;
  const isBull      = fullBrief?.net_signal?.includes('bull');
  const isBear      = fullBrief?.net_signal?.includes('bear');
  const verdictText  = fullBrief ? (fullBrief.net_signal || 'NEUTRAL').toUpperCase().replace(/_/g, ' ') : '';
  const verdictColor = isBull ? 'var(--accent-green)' : isBear ? '#c94040' : 'var(--text-muted)';
  const verdictBg    = isBull ? 'rgba(46,204,113,0.06)' : isBear ? 'rgba(201,64,64,0.06)' : 'rgba(232,168,56,0.04)';
  const verdictBorder= isBull ? 'rgba(46,204,113,0.2)'  : isBear ? 'rgba(201,64,64,0.2)'  : 'rgba(232,168,56,0.2)';

  return (
    <div className="view-container reports-layout">

      {/* ── Sidebar ── */}
      <div className="reports-sidebar">
        <div className="reports-sidebar-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-amber)', fontSize: '18px', letterSpacing: '1px' }}>
                REPORTS
              </h2>
              <div style={{ color: 'var(--text-muted)', fontSize: '9px', letterSpacing: '1px', marginTop: '4px' }}>
                ANALYSIS_VAULT — {briefs.length} RECORDS
              </div>
            </div>
            <button
              className={`filter-btn ${compareMode ? 'active' : ''}`}
              style={{ fontSize: '9px', padding: '4px 8px', marginTop: '2px' }}
              onClick={() => compareMode ? handleExitCompare() : setCompareMode(true)}
            >
              {compareMode ? 'EXIT' : 'COMPARE'}
            </button>
          </div>

          {/* Compare mode status bar */}
          {compareMode && (
            <div style={{
              marginTop: '10px', padding: '8px 10px',
              background: 'rgba(232,168,56,0.08)', border: '1px solid rgba(232,168,56,0.2)',
              fontSize: '9px', color: 'var(--accent-amber)', letterSpacing: '1px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span>{compareIds.size === 0 ? 'SELECT 2+ REPORTS' : `${compareIds.size} SELECTED`}</span>
              {compareIds.size > 0 && (
                <button onClick={() => setCompareIds(new Set())}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '9px', fontFamily: 'var(--font-mono)' }}>
                  CLEAR
                </button>
              )}
            </div>
          )}
        </div>

        <div className="reports-sidebar-filters">
          <input type="text" placeholder="SEARCH_TICKER..." value={search}
            onChange={e => setSearch(e.target.value.toUpperCase())} className="reports-search" />
          <div className="filter-bar" style={{ marginBottom: 0 }}>
            {['ALL', 'BULLISH', 'BEARISH'].map(f => (
              <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`}
                style={{ fontSize: '9px', padding: '4px 8px' }} onClick={() => setFilter(f)}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="reports-sidebar-list">
          {loading && briefs.length === 0 ? (
            <div style={{ padding: '24px', color: 'var(--text-muted)', fontSize: '11px' }}>LOADING_VAULT...</div>
          ) : filteredBriefs.length === 0 ? (
            <div style={{ padding: '24px', color: 'var(--text-muted)', fontSize: '11px' }}>
              {briefs.length === 0 ? 'VAULT_EMPTY' : 'NO_MATCH'}
            </div>
          ) : filteredBriefs.map(b => {
            const isSelected  = !compareMode && selectedBrief?.id === b.id;
            const isComparing = compareMode && compareIds.has(b.id);
            const sc = b.net_signal?.includes('bull') ? 'var(--accent-green)' : b.net_signal?.includes('bear') ? '#c94040' : 'var(--text-muted)';
            const printed = printLog[b.id];

            return (
              <div key={b.id}
                onClick={() => compareMode ? toggleCompareId(b.id) : setSelectedBrief(b)}
                className={`reports-sidebar-item ${isSelected ? 'active' : ''} ${isComparing ? 'comparing' : ''}`}
                style={{ borderLeftColor: isComparing ? 'var(--accent-amber)' : isSelected ? 'var(--accent-amber)' : sc }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {compareMode && (
                      <div style={{
                        width: '12px', height: '12px', border: `1px solid ${isComparing ? 'var(--accent-amber)' : 'var(--border)'}`,
                        background: isComparing ? 'var(--accent-amber)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        {isComparing && <span style={{ fontSize: '8px', color: 'var(--bg-primary)', fontWeight: 'bold', lineHeight: 1 }}>✓</span>}
                      </div>
                    )}
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '13px', letterSpacing: '1px' }}>
                      {b.ticker}
                    </span>
                  </div>
                  <span style={{ fontSize: '9px', color: sc, fontWeight: 'bold', letterSpacing: '1px' }}>
                    {b.net_signal?.includes('bull') ? '▲' : b.net_signal?.includes('bear') ? '▼' : '○'} {b.net_signal?.toUpperCase().replace(/_/g, ' ')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                    {new Date(b.created_at * 1000).toLocaleDateString()}
                  </span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{Math.round(b.confidence)}%</span>
                    {b.price_at_brief > 0 && (
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>${b.price_at_brief.toFixed(2)}</span>
                    )}
                    {printed && (
                      <span style={{ fontSize: '9px', color: 'rgba(232,168,56,0.5)' }} title={`Printed ${timeAgo(printed.ts)}`}>⎙</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Main Panel ── */}
      <div className="reports-main">

        {/* ── Compare mode panel ── */}
        {compareMode ? (
          compareIds.size < 2 ? (
            <div className="reports-empty-state">
              <div className="reports-empty-ascii">
                {'[ COMPARE MODE ]'}<br />{'────────────────'}<br />
                {'SELECT 2+ REPORTS'}<br />{'────────────────'}
              </div>
              <div style={{ fontSize: '11px', letterSpacing: '2px', color: 'var(--text-muted)' }}>
                CLICK REPORTS IN THE SIDEBAR TO SELECT THEM
              </div>
            </div>
          ) : (
            <ComparePanel briefs={compareBriefs} onPrint={() => printCompareReport(compareBriefs)} />
          )

        /* ── Single report panel ── */
        ) : !selectedBrief ? (
          <div className="reports-empty-state">
            <div className="reports-empty-ascii">
              {'[ ANALYSIS VAULT ]'}<br />{'──────────────────'}<br />
              {'  SELECT  REPORT  '}<br />{'──────────────────'}
            </div>
            <div style={{ fontSize: '11px', letterSpacing: '2px', color: 'var(--text-muted)' }}>
              SELECT_REPORT_FOR_PREVIEW
            </div>
          </div>
        ) : loadingDetail ? (
          <div className="reports-empty-state">
            <div style={{ fontSize: '11px', letterSpacing: '2px', color: 'var(--text-muted)' }}>
              DECRYPTING_REPORT_DATA...
            </div>
          </div>
        ) : fullBrief ? (
          <div className="report-preview">
            <div className="report-doc-header">
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px' }}>
                <span className="report-doc-ticker">{fullBrief.ticker}</span>
                <span className="report-doc-subtitle">EQUITY_INTELLIGENCE_REPORT</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {printLog[fullBrief.id] && (
                  <span style={{ fontSize: '9px', color: 'rgba(232,168,56,0.5)', letterSpacing: '1px' }}>
                    ⎙ {timeAgo(printLog[fullBrief.id].ts)}
                  </span>
                )}
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.2)', letterSpacing: '1px' }}>ID:{fullBrief.id}</span>
                <button onClick={handlePrint} className="filter-btn" style={{ fontSize: '9px', padding: '4px 10px', background: 'rgba(232,168,56,0.1)', borderColor: 'rgba(232,168,56,0.4)', color: 'var(--accent-amber)' }}>PRINT PDF</button>
                <button onClick={handleExportMd} className="filter-btn" style={{ fontSize: '9px', padding: '4px 10px' }}>EXPORT MD</button>
              </div>
            </div>

            <div className="report-verdict-banner" style={{ background: verdictBg, borderColor: verdictBorder }}>
              <div className="report-verdict-main">
                <span className="report-verdict-arrow" style={{ color: verdictColor }}>{isBull ? '▲' : isBear ? '▼' : '○'}</span>
                <span className="report-verdict-text" style={{ color: verdictColor }}>{verdictText}</span>
              </div>
              <div className="report-verdict-divider" style={{ background: verdictBorder }} />
              <div className="report-verdict-stat">
                <div className="report-verdict-stat-label">CONFIDENCE</div>
                <div className="report-verdict-stat-value" style={{ color: 'var(--accent-amber)' }}>{confidence}%</div>
                <div className="report-conf-bar-track"><div className="report-conf-bar-fill" style={{ width: `${confidence}%` }} /></div>
              </div>
              <div className="report-verdict-divider" style={{ background: verdictBorder }} />
              <div className="report-verdict-stat">
                <div className="report-verdict-stat-label">BULL</div>
                <div className="report-verdict-stat-value" style={{ color: 'var(--accent-green)' }}>{bullSignals.length}</div>
              </div>
              <div className="report-verdict-stat">
                <div className="report-verdict-stat-label">BEAR</div>
                <div className="report-verdict-stat-value" style={{ color: '#c94040' }}>{bearSignals.length}</div>
              </div>
              {conflicts.length > 0 && <>
                <div className="report-verdict-divider" style={{ background: verdictBorder }} />
                <div className="report-verdict-stat">
                  <div className="report-verdict-stat-label">CONFLICTS</div>
                  <div className="report-verdict-stat-value" style={{ color: 'var(--accent-amber)' }}>{conflicts.length}</div>
                </div>
              </>}
              {fullBrief.price_at_brief > 0 && <>
                <div className="report-verdict-divider" style={{ background: verdictBorder }} />
                <div className="report-verdict-stat">
                  <div className="report-verdict-stat-label">PRICE AT ANALYSIS</div>
                  <div className="report-verdict-stat-value" style={{ color: 'var(--text-primary)' }}>${fullBrief.price_at_brief.toFixed(2)}</div>
                </div>
              </>}
            </div>

            <div className="report-body">
              {bd.brief_text && (
                <div className="report-section">
                  <div className="report-section-title">ANALYST SYNTHESIS</div>
                  <div className="report-synthesis">{extractSynthesis(bd.brief_text)}</div>
                </div>
              )}
              {bullSignals.length > 0 && (
                <div className="report-section">
                  <div className="report-section-title">BULL CASE — {bullSignals.length} SIGNALS</div>
                  <div className="report-signal-list">
                    {bullSignals.map((s, i) => <SignalRow key={i} signal={s} />)}
                  </div>
                </div>
              )}
              {bearSignals.length > 0 && (
                <div className="report-section">
                  <div className="report-section-title">BEAR CASE — {bearSignals.length} SIGNALS</div>
                  <div className="report-signal-list">
                    {bearSignals.map((s, i) => <SignalRow key={i} signal={s} />)}
                  </div>
                </div>
              )}
              {conflicts.length > 0 && (
                <div className="report-section">
                  <div className="report-section-title">SIGNAL CONFLICTS — {conflicts.length}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {conflicts.map((c, i) => <div key={i} className="report-conflict-card">⚠ {c}</div>)}
                  </div>
                </div>
              )}
              {Object.keys(dataSources).length > 0 && (
                <div className="report-section">
                  <div className="report-section-title">DATA SOURCES</div>
                  <div className="report-sources-grid">
                    {Object.entries(dataSources).map(([tool, info]) => <DataSourceChip key={tool} tool={tool} info={info} />)}
                  </div>
                </div>
              )}
            </div>

            <div className="report-footer">
              FINSIGHT_SOVEREIGN_TERMINAL // REPORT_{fullBrief.id} // {new Date(fullBrief.created_at * 1000).toLocaleDateString()}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Compare Panel ──────────────────────────────────────────────────
function ComparePanel({ briefs, onPrint }) {
  const [expanded, setExpanded] = useState({});
  const toggleExpand = id => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const metrics = [
    { label: 'VERDICT',          fn: b => {
      const isBull = b.net_signal?.includes('bull');
      const isBear = b.net_signal?.includes('bear');
      const c = isBull ? 'var(--accent-green)' : isBear ? '#c94040' : 'var(--text-muted)';
      const arrow = isBull ? '▲' : isBear ? '▼' : '○';
      return <span style={{ color: c, fontWeight: 'bold', fontSize: '11px' }}>{arrow} {(b.net_signal || 'NEUTRAL').toUpperCase().replace(/_/g, ' ')}</span>;
    }},
    { label: 'CONFIDENCE',       fn: b => {
      const conf = Math.round(b.confidence || 0);
      return <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 'bold', color: 'var(--accent-amber)' }}>{conf}%</div>
        <div style={{ height: '2px', background: 'var(--border)', marginTop: '4px', width: '60px' }}>
          <div style={{ height: '100%', background: 'var(--accent-amber)', width: `${conf}%` }} />
        </div>
      </div>;
    }},
    { label: 'BULL SIGNALS',     fn: b => <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 'bold', color: 'var(--accent-green)' }}>{b.brief_data?.signals?.filter(s => s.type === 'bull').length || 0}</span> },
    { label: 'BEAR SIGNALS',     fn: b => <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 'bold', color: '#c94040' }}>{b.brief_data?.signals?.filter(s => s.type === 'bear').length || 0}</span> },
    { label: 'CONFLICTS',        fn: b => { const n = (b.brief_data?.conflicts || []).length; return <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 'bold', color: n > 0 ? 'var(--accent-amber)' : 'var(--text-muted)' }}>{n}</span>; }},
    { label: 'PRICE AT ANALYSIS',fn: b => <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{b.price_at_brief > 0 ? `$${b.price_at_brief.toFixed(2)}` : '—'}</span> },
    { label: 'ANALYZED',         fn: b => <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{new Date(b.created_at * 1000).toLocaleDateString()}</span> },
  ];

  return (
    <div className="compare-panel">
      {/* Header */}
      <div className="compare-header">
        <div>
          <div style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-amber)', fontSize: '18px', letterSpacing: '2px', marginBottom: '4px' }}>
            COMPARATIVE ANALYSIS
          </div>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '2px' }}>
            {briefs.map(b => b.ticker).join(' · ')} — {briefs.length} TICKERS
          </div>
        </div>
        <button
          className="filter-btn"
          style={{ background: 'rgba(232,168,56,0.1)', borderColor: 'rgba(232,168,56,0.4)', color: 'var(--accent-amber)' }}
          onClick={onPrint}
        >
          PRINT COMBINED PDF
        </button>
      </div>

      {/* Comparison table */}
      <div className="compare-table-wrap">
        <table className="compare-table">
          <thead>
            <tr>
              <th className="compare-th compare-th-label">METRIC</th>
              {briefs.map(b => {
                const isBull = b.net_signal?.includes('bull');
                const isBear = b.net_signal?.includes('bear');
                const c = isBull ? 'var(--accent-green)' : isBear ? '#c94040' : 'var(--text-muted)';
                return (
                  <th key={b.id} className="compare-th" style={{ borderBottom: `2px solid ${c}` }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: c, letterSpacing: '2px' }}>{b.ticker}</div>
                    <div style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '1px', marginTop: '2px' }}>
                      {new Date(b.created_at * 1000).toLocaleDateString()}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {metrics.map(({ label, fn }) => (
              <tr key={label} className="compare-tr">
                <td className="compare-td-label">{label}</td>
                {briefs.map(b => (
                  <td key={b.id} className="compare-td">{fn(b)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Individual synthesis blocks */}
      <div className="compare-syntheses">
        <div className="report-section-title" style={{ marginBottom: '16px' }}>ANALYST SYNTHESIS — BY TICKER</div>
        <div className="compare-synthesis-grid" style={{ gridTemplateColumns: `repeat(${briefs.length}, 1fr)` }}>
          {briefs.map(b => {
            const isBull = b.net_signal?.includes('bull');
            const isBear = b.net_signal?.includes('bear');
            const c = isBull ? 'var(--accent-green)' : isBear ? '#c94040' : 'var(--text-muted)';
            return (
              <div key={b.id} className="compare-synthesis-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '10px', borderBottom: `1px solid ${c}` }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: c, letterSpacing: '2px' }}>{b.ticker}</span>
                  <span style={{ fontSize: '9px', color: c, letterSpacing: '1px' }}>{Math.round(b.confidence)}% conf</span>
                </div>
                <div style={{ fontSize: '11px', lineHeight: 1.7, color: 'var(--text-primary)', overflow: 'hidden', maxHeight: expanded[b.id] ? 'none' : '120px', position: 'relative' }}>
                  {extractSynthesis(b.brief_data?.brief_text) || 'No synthesis available.'}
                  {!expanded[b.id] && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '32px', background: 'linear-gradient(transparent, var(--bg-secondary))' }} />
                  )}
                </div>
                {(extractSynthesis(b.brief_data?.brief_text)?.length || 0) > 300 && (
                  <button onClick={() => toggleExpand(b.id)} style={{ marginTop: '6px', background: 'none', border: 'none', color: 'var(--accent-amber)', fontSize: '9px', fontFamily: 'var(--font-mono)', letterSpacing: '1px', cursor: 'pointer', padding: 0 }}>
                    {expanded[b.id] ? '▲ COLLAPSE' : '▼ READ MORE'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────────
function SignalRow({ signal }) {
  const isBull = signal.type === 'bull';
  const c = isBull ? 'var(--accent-green)' : '#c94040';
  const validSrcs = (signal.sources || []).filter(s => s.label && s.label !== 'undefined' && s.value != null);
  return (
    <div className="report-signal-row" style={{ borderLeftColor: c }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
        <span style={{ fontSize: '11px', fontWeight: 'bold', color: c, letterSpacing: '0.8px' }}>
          {isBull ? '▲' : '▼'} {signal.title}
        </span>
        <span style={{ fontSize: '8px', color: signal.status === 'available' ? 'var(--accent-green)' : 'var(--accent-amber)', letterSpacing: '1px' }}>
          {signal.status?.toUpperCase()}
        </span>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.5 }}>{signal.description}</div>
      {validSrcs.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
          {validSrcs.map((src, i) => (
            <span key={i} className="report-source-badge">
              {src.label}: {src.value}{src.threshold ? ` / ${src.threshold}` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DataSourceChip({ tool, info }) {
  const status = info?.status || 'UNAVAILABLE';
  const color = status === 'AVAILABLE' ? 'var(--accent-green)' : status === 'CACHED' ? 'var(--accent-amber)' : '#3a4455';
  const dot = status === 'AVAILABLE' ? '●' : status === 'CACHED' ? '◐' : '○';
  const name = tool.replace(/^fetch_|^compute_|^get_/i, '').replace(/_/g, ' ').toUpperCase();
  return (
    <div className="report-data-chip">
      <span style={{ color, fontSize: '10px' }}>{dot}</span>
      <span className="report-data-chip-name">{name}</span>
    </div>
  );
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

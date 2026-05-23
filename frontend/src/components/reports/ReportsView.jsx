import React, { useState, useEffect } from 'react';
import { useBriefHistory } from '../../hooks/useBriefHistory';
import { generateMarkdown, downloadFile } from '../../utils/markdownExport';
import './reports.css';

export default function ReportsView() {
  const { briefs, loading, fetchById } = useBriefHistory();
  const [selectedBrief, setSelectedBrief] = useState(null);
  const [fullBrief, setFullBrief] = useState(null);

  useEffect(() => {
    if (selectedBrief) {
      fetchById(selectedBrief.id).then(setFullBrief);
    }
  }, [selectedBrief, fetchById]);

  const handleExportMd = () => {
    if (!fullBrief) return;
    const md = generateMarkdown(fullBrief);
    const filename = `FINSIGHT_${fullBrief.ticker}_${new Date(fullBrief.created_at * 1000).toISOString().split('T')[0]}.md`;
    downloadFile(md, filename, 'text/markdown');
  };

  return (
    <div className="view-container" style={{ flexDirection: 'row', gap: '0', margin: '-24px' }}>
      {/* Sidebar List */}
      <div style={{ width: '280px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-amber)', fontSize: '18px', letterSpacing: '1px' }}>REPORTS</h2>
          <div style={{ color: 'var(--text-muted)', fontSize: '9px', letterSpacing: '1px', marginTop: '4px' }}>AVAILABLE_ANALYSIS_VAULT</div>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && briefs.length === 0 ? (
            <div style={{ padding: '24px', color: 'var(--text-muted)', fontSize: '11px' }}>LOADING_VAULT...</div>
          ) : briefs.length === 0 ? (
            <div style={{ padding: '24px', color: 'var(--text-muted)', fontSize: '11px' }}>VAULT_EMPTY</div>
          ) : (
            briefs.map(b => (
              <div 
                key={b.id} 
                onClick={() => setSelectedBrief(b)}
                style={{ 
                  padding: '16px 24px', 
                  borderBottom: '1px solid var(--border)', 
                  cursor: 'pointer',
                  backgroundColor: selectedBrief?.id === b.id ? 'rgba(232, 168, 56, 0.05)' : 'transparent',
                  borderLeft: selectedBrief?.id === b.id ? '3px solid var(--accent-amber)' : '3px solid transparent'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{b.ticker}</span>
                  <span style={{ fontSize: '10px', color: b.net_signal === 'bullish' ? 'var(--accent-green)' : 'var(--accent-red)' }}>{b.net_signal.toUpperCase()}</span>
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>{new Date(b.created_at * 1000).toLocaleDateString()}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Preview */}
      <div style={{ flex: 1, backgroundColor: 'var(--bg-primary)', overflowY: 'auto', padding: '48px' }}>
        {!selectedBrief ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '48px' }}>📄</div>
            <div style={{ fontSize: '11px', letterSpacing: '2px' }}>SELECT_REPORT_FOR_PREVIEW</div>
          </div>
        ) : !fullBrief ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>DECRYPTING_REPORT_DATA...</div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '24px' }}>
              <button onClick={() => window.print()} className="filter-btn">PRINT_PDF</button>
              <button onClick={handleExportMd} className="filter-btn">EXPORT_MD</button>
            </div>

            <div className="report-preview">
              <div className="report-watermark">FINSIGHT</div>
              
              <div className="report-section" style={{ borderBottom: '2px solid var(--accent-amber)', paddingBottom: '24px', marginBottom: '48px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '32px', color: 'var(--accent-amber)', margin: 0 }}>{fullBrief.ticker}</h1>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '2px' }}>EQUITY_INTELLIGENCE_REPORT</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: 'bold' }}>ID: {fullBrief.id}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{new Date(fullBrief.created_at * 1000).toLocaleString()}</div>
                  </div>
                </div>
              </div>

              <div className="report-section">
                <div className="report-section-title">EXECUTIVE_SUMMARY</div>
                <div style={{ display: 'flex', gap: '48px', alignItems: 'center' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>BIAS_VERDICT</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: fullBrief.net_signal === 'bullish' ? 'var(--accent-green)' : 'var(--accent-red)' }}>{fullBrief.net_signal.toUpperCase()}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>CONFIDENCE</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{Math.round(fullBrief.confidence * 100)}%</div>
                  </div>
                  <div style={{ flex: 1, fontSize: '13px', lineHeight: 1.6, fontStyle: 'italic' }}>
                    {fullBrief.brief_data?.brief_text?.substring(0, 200)}...
                  </div>
                </div>
              </div>

              <div className="report-section">
                <div className="report-section-title">BULL_CASE_SIGNALS</div>
                {fullBrief.brief_data?.bull_signals?.map((s, i) => (
                  <div key={i} style={{ marginBottom: '12px', paddingLeft: '16px', borderLeft: '2px solid var(--accent-green)' }}>
                    <div style={{ fontSize: '12px' }}>{s.text}</div>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>SOURCE: {s.source?.toUpperCase()}</div>
                  </div>
                ))}
              </div>

              <div className="report-section">
                <div className="report-section-title">BEAR_CASE_SIGNALS</div>
                {fullBrief.brief_data?.bear_signals?.map((s, i) => (
                  <div key={i} style={{ marginBottom: '12px', paddingLeft: '16px', borderLeft: '2px solid var(--accent-red)' }}>
                    <div style={{ fontSize: '12px' }}>{s.text}</div>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '4px' }}>SOURCE: {s.source?.toUpperCase()}</div>
                  </div>
                ))}
              </div>

              {fullBrief.brief_data?.conflicts?.length > 0 && (
                <div className="report-section">
                  <div className="report-section-title">DETECTED_SIGNAL_CONFLICTS</div>
                  {fullBrief.brief_data.conflicts.map((c, i) => (
                    <div key={i} style={{ padding: '12px', backgroundColor: 'rgba(232, 168, 56, 0.05)', border: '1px solid var(--accent-amber)', fontSize: '12px', marginBottom: '8px' }}>
                      ⚠ {c}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 'auto', paddingTop: '48px', fontSize: '9px', color: 'var(--text-muted)', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
                FINSIGHT_TERMINAL_GEN_2 // ENCRYPTED_OUTPUT // SYSTEM_VERSION_4.0.1
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

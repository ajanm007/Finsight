import React, { useEffect } from 'react';
import TickerHeader from './TickerHeader';
import BullBearPanel from './BullBearPanel';
import ConflictPanel from './ConflictPanel';
import BullCaseScore from './BullCaseScore';
import ConfidenceGauge from './ConfidenceGauge';
import TechIndicators from './TechIndicators';
import PriceChart from './PriceChart';
import InfraHealth from './InfraHealth';
import { useAnalysis } from '../../hooks/useAnalysis';

export default function Dashboard({ ticker, status, toolStates, brief, error, onSearch }) {
  // Hook usage removed here as it is now lifted to App.jsx

  // Merge final brief results with live tool results for incremental rendering
  const liveResults = {
    ...(brief?.tool_results || {}),
    fetch_price_data: toolStates.fetch_price_data?.result || brief?.tool_results?.fetch_price_data,
    compute_technicals: toolStates.compute_technicals?.result || brief?.tool_results?.compute_technicals,
  };

  return (
    <div className="dashboard-grid">
      {/* Main Content Column */}
      <div className="dashboard-main" style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
        {status === 'connecting' && (
          <div style={{ color: 'var(--accent-amber)', fontSize: '14px', margin: 'auto', textAlign: 'center' }}>
            <div style={{ animation: 'pulse 1.5s infinite', letterSpacing: '2px' }}>CONNECTING TO SOVEREIGN SECURE TERMINAL...</div>
          </div>
        )}
        
        {status === 'error' && (
          <div className="view-container" style={{ alignItems: 'center', justifyContent: 'center', padding: '48px', textAlign: 'center' }}>
            <div style={{ 
              width: '64px', 
              height: '64px', 
              backgroundColor: 'rgba(231, 76, 60, 0.1)', 
              border: '1px solid var(--accent-red)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              color: 'var(--accent-red)',
              marginBottom: '24px'
            }}>
              ⚠
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontSize: '24px', letterSpacing: '2px', marginBottom: '16px' }}>PIPELINE_FAILURE</h2>
            <div style={{ maxWidth: '500px', color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, marginBottom: '32px' }}>
              The agentic pipeline encountered a critical error while analyzing <span style={{ color: 'var(--accent-amber)' }}>{ticker}</span>. 
              {error || 'Connection to analysis stream lost.'}
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <button 
                onClick={() => onSearch(ticker, true)}
                className="filter-btn active"
                style={{ padding: '12px 24px' }}
              >
                RETRY_ANALYSIS
              </button>
              <button 
                onClick={() => onSearch('NVDA')}
                className="filter-btn"
                style={{ padding: '12px 24px' }}
              >
                LOAD_STABLE_ASSET
              </button>
            </div>

            <div style={{ marginTop: '48px', paddingTop: '32px', borderTop: '1px solid var(--border)', width: '100%', maxWidth: '400px' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '16px', letterSpacing: '1px' }}>QUICK_NAVIGATION</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                {['AAPL', 'TSLA', 'MSFT', 'GOOGL'].map(t => (
                  <span 
                    key={t} 
                    onClick={() => onSearch(t)}
                    style={{ fontSize: '11px', color: 'var(--text-primary)', cursor: 'pointer', border: '1px solid var(--border)', padding: '4px 8px' }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {(status === 'running' && !brief) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', opacity: 0.7, animation: 'pulse 2s infinite' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ width: '200px', height: '40px', backgroundColor: 'rgba(255,255,255,0.05)' }}></div>
              <div style={{ width: '100px', height: '40px', backgroundColor: 'rgba(255,255,255,0.05)' }}></div>
            </div>
            <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border)' }}></div>
            <div style={{ width: '100%', height: '80px', backgroundColor: 'rgba(255,255,255,0.03)' }}></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ height: '300px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: '100px', height: '14px', backgroundColor: 'rgba(255,255,255,0.05)' }}></div>
                </div>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ width: '100%', height: '40px', backgroundColor: 'rgba(255,255,255,0.03)' }}></div>
                  <div style={{ width: '100%', height: '40px', backgroundColor: 'rgba(255,255,255,0.03)' }}></div>
                </div>
              </div>
              <div style={{ height: '300px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: '100px', height: '14px', backgroundColor: 'rgba(255,255,255,0.05)' }}></div>
                </div>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ width: '100%', height: '40px', backgroundColor: 'rgba(255,255,255,0.03)' }}></div>
                  <div style={{ width: '100%', height: '40px', backgroundColor: 'rgba(255,255,255,0.03)' }}></div>
                </div>
              </div>
            </div>
            
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', padding: '12px 24px', backgroundColor: 'rgba(255,165,0,0.05)', border: '1px solid rgba(255,165,0,0.2)', borderRadius: '2px' }}>
                <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,165,0,0.2)', borderTopColor: 'var(--accent-amber)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <div style={{ color: 'var(--accent-amber)', letterSpacing: '2px', fontSize: '10px', fontWeight: 'bold' }}>AGENT PIPELINE EXECUTING</div>
              </div>
            </div>
            <style dangerouslySetInnerHTML={{__html: `@keyframes spin { 100% { transform: rotate(360deg); } } @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 0.8; } 100% { opacity: 0.5; } }`}} />
          </div>
        )}

        {brief && (
          <>
            <TickerHeader brief={brief} priceData={brief.tool_results?.fetch_price_data} />
            
            <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '8px 0' }}></div>

            {/* Bias Verdict Card */}
            <div style={{ 
              backgroundColor: 'rgba(255,255,255,0.02)', 
              border: '1px solid var(--border)', 
              padding: '16px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: '2px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase' }}>AGENT BIAS VERDICT</div>
                  <div style={{ 
                    fontSize: '8px', 
                    padding: '2px 6px', 
                    borderRadius: '10px', 
                    backgroundColor: brief.llm_generated ? 'rgba(0,255,255,0.05)' : 'rgba(255,165,0,0.05)',
                    color: brief.llm_generated ? 'var(--accent-blue)' : 'var(--accent-amber)',
                    border: `1px solid ${brief.llm_generated ? 'rgba(0,255,255,0.1)' : 'rgba(255,165,0,0.1)'}`,
                    letterSpacing: '1px',
                    fontWeight: 'bold'
                  }}>
                    {brief.llm_generated ? 'LLM_SYNTHESIS' : 'SOVEREIGN_DATA_ENGINE'}
                  </div>
                </div>
                <div style={{ 
                  color: brief.bias?.includes('BULLISH') ? 'var(--accent-green)' : brief.bias?.includes('BEARISH') ? 'var(--accent-red)' : 'var(--accent-amber)', 
                  fontSize: '24px', 
                  fontWeight: 'bold', 
                  letterSpacing: '1px',
                  fontFamily: 'var(--font-display)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  {brief.bias || 'NEUTRAL'}
                  <button 
                    onClick={() => onSearch && onSearch(brief.ticker, true)}
                    title="Bypass all cached data and re-fetch live from all sources"
                    style={{ 
                      background: 'rgba(255,255,255,0.03)', 
                      border: '1px solid var(--border)', 
                      color: 'var(--text-muted)', 
                      fontSize: '8px', 
                      padding: '4px 8px', 
                      cursor: 'pointer',
                      borderRadius: '2px',
                      textTransform: 'uppercase',
                      transition: 'all 0.2s',
                      fontWeight: 'bold',
                      letterSpacing: '0.5px'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--text-muted)'; e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
                  >
                    ↻ REFRESH LIVE DATA
                  </button>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '9px', letterSpacing: '1px' }}>PROBABILITY</div>
                <div style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: 'bold' }}>{brief.confidence?.bull_case_score}%</div>
              </div>
            </div>
            
            <BullBearPanel brief={brief} />
            <ConflictPanel conflicts={brief.conflicts} />

            {/* Empty space filler / Summary card */}
            {!brief.conflicts?.length && (
              <div style={{ 
                border: '1px dashed var(--border)', 
                padding: '32px', 
                textAlign: 'center', 
                color: 'var(--text-muted)',
                fontSize: '11px',
                letterSpacing: '1px',
                textTransform: 'uppercase'
              }}>
                <div style={{ marginBottom: '8px' }}>--- CROSS-VALIDATION CLEAR ---</div>
                <div>NO CRITICAL SIGNAL CONTRADICTIONS DETECTED IN CURRENT PIPELINE EXECUTION</div>
              </div>
            )}

            {/* LLM Synthesis Summary */}
            {brief.brief_text && (
              <div style={{ 
                marginTop: '16px',
                padding: '24px', 
                backgroundColor: 'rgba(255,255,255,0.02)', 
                borderLeft: '3px solid var(--accent-amber)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                lineHeight: 1.6,
                letterSpacing: '0.5px',
                whiteSpace: 'pre-wrap'
              }}>
                <div style={{ color: 'var(--accent-amber)', fontSize: '10px', fontWeight: 'bold', marginBottom: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  AGENT SYNTHESIS LOG
                </div>
                {brief.brief_text}
              </div>
            )}

            {/* Data Summary Box */}
            <div style={{ 
              marginTop: 'auto',
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border)',
              padding: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '10px',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              <div>
                <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>DATA SUMMARY</span>
                <span style={{ margin: '0 8px' }}>|</span>
                TOTAL LATENCY: {brief.total_latency_ms}ms
                <span style={{ margin: '0 8px' }}>|</span>
                SOURCES: {brief.confidence?.sources_available} / {brief.confidence?.sources_total} LIVE
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {Object.entries(brief.data_availability || {}).map(([tool, data]) => (
                  <div key={tool} style={{ 
                    padding: '2px 6px', 
                    border: '1px solid rgba(255,255,255,0.05)',
                    backgroundColor: data.status === 'AVAILABLE' ? 'rgba(46, 204, 113, 0.1)' : 
                                   data.status === 'CACHED' ? 'rgba(241, 196, 15, 0.1)' : 'rgba(231, 76, 60, 0.1)',
                    color: data.status === 'AVAILABLE' ? 'var(--accent-green)' : 
                           data.status === 'CACHED' ? 'var(--accent-amber)' : 'var(--accent-red)'
                  }}>
                    {tool.replace('fetch_', '').replace('compute_', '').replace('run_', '').substring(0, 3)}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right Side Column */}
      <div className="dashboard-side" style={{ 
        borderLeft: '1px solid var(--border)', 
        paddingLeft: '24px', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '32px',
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 100px)',
        paddingBottom: '40px'
      }}>
        <TechIndicators toolResults={liveResults} />
        <PriceChart toolResults={liveResults} />
        
        {brief && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto' }}>
            <BullCaseScore score={brief.confidence?.bull_case_score} />
            <ConfidenceGauge confidence={brief.confidence} />
            <InfraHealth toolStates={toolStates} brief={brief} hideTitle={false} />
          </div>
        )}
      </div>
    </div>
  );
}


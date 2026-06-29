import { useEffect, useState, useRef } from 'react';
import { extractSynthesis } from '../../utils/synthesis';

function SynthesisPanel({ text }) {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);
  const textRef = useRef(text);

  useEffect(() => {
    indexRef.current = 0;
    setDisplayed('');
    textRef.current = text;
    const tick = () => {
      if (indexRef.current < textRef.current.length) {
        indexRef.current += 1;
        setDisplayed(textRef.current.slice(0, indexRef.current));
        setTimeout(tick, 28);
      }
    };
    setTimeout(tick, 28);
  }, [text]);

  return (
    <div style={{
      marginTop: '16px', padding: '24px',
      backgroundColor: 'rgba(255,255,255,0.02)',
      borderLeft: '3px solid var(--accent-amber)',
    }}>
      <div style={{ color: 'var(--accent-amber)', fontSize: '10px', fontWeight: 'bold', marginBottom: '12px', letterSpacing: '1px' }}>
        AGENT SYNTHESIS LOG
      </div>
      <div style={{ color: 'var(--text-primary)', fontSize: '12px', lineHeight: 1.7, letterSpacing: '0.5px', whiteSpace: 'pre-wrap' }}>
        {displayed}
        {displayed.length < text.length && (
          <span style={{ display: 'inline-block', width: '7px', height: '13px', backgroundColor: 'var(--accent-amber)', marginLeft: '2px', animation: 'cursorBlink 0.7s step-end infinite', verticalAlign: 'text-bottom' }} />
        )}
      </div>
      <style>{`@keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}
import TickerHeader from './TickerHeader';
import BullBearPanel from './BullBearPanel';
import ConflictPanel from './ConflictPanel';
import BullCaseScore from './BullCaseScore';
import ConfidenceGauge from './ConfidenceGauge';
import TechIndicators from './TechIndicators';
import PriceChart from './PriceChart';
import InfraHealth from './InfraHealth';
import Tooltip from '../common/Tooltip';
import PipelineLoader from './PipelineLoaderCinematic';

export default function Dashboard({ ticker, status, toolStates, brief, error, onSearch }) {
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const liveResults = {
    ...(brief?.tool_results || {}),
    fetch_price_data: toolStates.fetch_price_data?.result || brief?.tool_results?.fetch_price_data,
    compute_technicals: toolStates.compute_technicals?.result || brief?.tool_results?.compute_technicals,
  };

  const isLoading = !brief && status !== 'done' && status !== 'error';

  return (
    <div className="dashboard-grid" style={{
      ...(isLoading ? { gridTemplateColumns: '1fr', gap: 0 } : {}),
      ...(!isLoading ? { gridTemplateColumns: rightCollapsed ? '1fr 0px' : '1fr 320px', transition: 'grid-template-columns 0.3s ease' } : {}),
      position: 'relative',
    }}>
      {/* Main Content Column */}
      <div className="dashboard-main" style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, position: 'relative' }}>
        {/* Expand button — only shown when right panel is collapsed */}
        {rightCollapsed && !isLoading && (
          <button
            onClick={() => setRightCollapsed(false)}
            style={{
              position: 'absolute', top: 0, right: 0,
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRight: 'none', color: 'var(--accent-amber)',
              fontSize: '9px', letterSpacing: '1px', padding: '4px 10px',
              cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.2s',
              zIndex: 10,
            }}
            onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(232,168,56,0.08)'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
          >
            ‹ PANEL
          </button>
        )}
        {(status === 'connecting' || (status === 'running' && !brief)) && (
          <PipelineLoader ticker={ticker} toolStates={toolStates} status={status} />
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


        {brief && (
          <>
            <TickerHeader brief={brief} priceData={brief.tool_results?.fetch_price_data} />
            
            <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '8px 0' }}></div>

            {/* Bias Verdict Card */}
            {(() => {
              const isBullish = brief.bias?.includes('BULLISH');
              const isBearish = brief.bias?.includes('BEARISH');
              const biasColor = isBullish ? 'var(--accent-green)' : isBearish ? 'var(--accent-red)' : 'var(--accent-amber)';
              const biasBg = isBullish ? 'rgba(46,204,113,0.05)' : isBearish ? 'rgba(231,76,60,0.05)' : 'rgba(232,168,56,0.05)';
              return (
                <div style={{
                  backgroundColor: biasBg,
                  border: '1px solid var(--border)',
                  borderLeft: `4px solid ${biasColor}`,
                  padding: '20px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '9px', letterSpacing: '2px' }}>
                        <Tooltip text="The system's bottom-line call after weighing all signals. STRONGLY BULLISH means evidence aligned cleanly. MILDLY BULLISH means there's some friction — a few signals cut the other way. NEUTRAL means no clear edge was found." width={260}>
                          AGENT BIAS VERDICT
                        </Tooltip>
                      </div>
                      <div style={{
                        fontSize: '8px', padding: '2px 6px',
                        backgroundColor: brief.llm_generated ? 'rgba(0,255,255,0.05)' : 'rgba(255,165,0,0.05)',
                        color: brief.llm_generated ? 'var(--accent-blue)' : 'var(--accent-amber)',
                        border: `1px solid ${brief.llm_generated ? 'rgba(0,255,255,0.15)' : 'rgba(255,165,0,0.15)'}`,
                        letterSpacing: '1px', fontWeight: 'bold',
                      }}>
                        {brief.llm_generated ? 'LLM_SYNTHESIS' : 'SOVEREIGN_DATA_ENGINE'}
                      </div>
                    </div>
                    <div style={{
                      color: biasColor,
                      fontSize: '34px',
                      fontWeight: 'bold',
                      letterSpacing: '2px',
                      fontFamily: 'var(--font-display)',
                      textShadow: `0 0 30px ${biasColor}33`,
                      display: 'flex', alignItems: 'center', gap: '16px',
                    }}>
                      {brief.bias || 'NEUTRAL'}
                      <button
                        onClick={() => onSearch && onSearch(brief.ticker, true)}
                        title="Bypass all cached data and re-fetch live from all sources"
                        style={{
                          background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                          color: 'var(--text-muted)', fontSize: '8px', padding: '4px 10px',
                          cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s',
                          fontWeight: 'bold', letterSpacing: '0.5px', fontFamily: 'var(--font-mono)',
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--text-muted)'; e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
                      >
                        ↻ REFRESH
                      </button>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '9px', letterSpacing: '1px', marginBottom: '6px' }}>
                      <Tooltip text="Bull Case Score — how strong the 'buy' argument is, out of 100. Computed purely from data, not generated by AI. 80+ = strong bullish evidence. 50 = no clear view. Capped at 75 when signals conflict." width={240}>
                        PROBABILITY
                      </Tooltip>
                    </div>
                    <div style={{ color: biasColor, fontSize: '36px', fontWeight: 'bold', fontFamily: 'var(--font-display)', letterSpacing: '1px' }}>
                      {brief.confidence?.bull_case_score}<span style={{ fontSize: '18px', opacity: 0.7 }}>%</span>
                    </div>
                  </div>
                </div>
              );
            })()}
            
            <BullBearPanel brief={brief} />
            <ConflictPanel conflicts={brief.conflicts} />

            {/* LLM Synthesis Summary */}
            {brief.brief_text && <SynthesisPanel text={extractSynthesis(brief.brief_text)} />}

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
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {Object.entries(brief.data_availability || {}).map(([tool, data]) => {
                  const label = tool.replace('fetch_', '').replace('compute_', '').replace('run_', '').replace(/_/g, ' ').toUpperCase();
                  const isLive = data.status === 'AVAILABLE';
                  const isCached = data.status === 'CACHED';
                  return (
                    <div key={tool} style={{
                      padding: '3px 8px', fontSize: '8px', letterSpacing: '0.8px',
                      border: `1px solid ${isLive ? 'rgba(46,204,113,0.2)' : isCached ? 'rgba(232,168,56,0.2)' : 'rgba(231,76,60,0.2)'}`,
                      backgroundColor: isLive ? 'rgba(46,204,113,0.07)' : isCached ? 'rgba(232,168,56,0.07)' : 'rgba(231,76,60,0.07)',
                      color: isLive ? 'var(--accent-green)' : isCached ? 'var(--accent-amber)' : 'var(--accent-red)',
                      display: 'flex', alignItems: 'center', gap: '5px',
                    }}>
                      <span style={{ fontSize: '6px' }}>{isLive ? '●' : isCached ? '◐' : '○'}</span>
                      {label}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right Side Column — hidden during load */}
      {(brief || status === 'done' || status === 'error') && <div className="dashboard-side" style={{
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
        overflowY: rightCollapsed ? 'hidden' : 'auto',
        overflow: rightCollapsed ? 'hidden' : 'auto',
        maxHeight: 'calc(100vh - 100px)',
        paddingBottom: '120px',
        position: 'relative',
        width: rightCollapsed ? 0 : '320px',
        minWidth: rightCollapsed ? 0 : '320px',
        transition: 'width 0.3s ease, min-width 0.3s ease, padding 0.3s ease',
        paddingLeft: rightCollapsed ? 0 : '24px',
      }}>
        <div style={{ opacity: rightCollapsed ? 0 : 1, transition: 'opacity 0.2s ease', pointerEvents: rightCollapsed ? 'none' : 'auto' }}>

        {/* Section: Market Data — header doubles as collapse toggle */}
        <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '2px', padding: '0 0 10px', borderBottom: '1px solid var(--border)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--accent-amber)', fontSize: '7px' }}>■</span>
            MARKET DATA
          </div>
          <button
            onClick={() => setRightCollapsed(c => !c)}
            style={{
              background: 'none', border: '1px solid var(--border)', color: 'var(--accent-amber)',
              fontSize: '9px', letterSpacing: '1px', padding: '2px 8px', cursor: 'pointer',
              fontFamily: 'var(--font-mono)', transition: 'all 0.2s',
            }}
            onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(232,168,56,0.08)'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
            title="Collapse panel"
          >
            › COLLAPSE
          </button>
        </div>
        <TechIndicators toolResults={liveResults} />
        <PriceChart toolResults={liveResults} />

        {brief && <>
          {/* Section: Signal Strength */}
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '2px', padding: '24px 0 10px', borderBottom: '1px solid var(--border)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--accent-amber)', fontSize: '7px' }}>■</span>
            SIGNAL STRENGTH
          </div>
          <BullCaseScore score={brief.confidence?.bull_case_score} />
          <ConfidenceGauge confidence={brief.confidence} />

          {/* Section: Infrastructure */}
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '2px', padding: '24px 0 10px', borderBottom: '1px solid var(--border)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--accent-amber)', fontSize: '7px' }}>■</span>
            PIPELINE HEALTH
          </div>
          <InfraHealth toolStates={toolStates} brief={brief} hideTitle={true} />
        </>}
        </div>
      </div>}
    </div>
  );
}


import React from 'react';

const TOOLS = [
  { id: 'fetch_price_data', label: 'YFINANCE' },
  { id: 'fetch_news', label: 'TAVILY NEWS' },
  { id: 'fetch_sec_filing', label: 'SEC EDGAR' },
  { id: 'compute_technicals', label: 'TECHNICALS' },
  { id: 'run_sentiment', label: 'FINBERT LLM' } // We don't have Groq status separate, use sentiment
];

export default function InfraHealth({ toolStates, brief, hideTitle }) {
  return (
    <div style={{ marginTop: hideTitle ? '0' : '32px', paddingTop: hideTitle ? '0' : '32px', borderTop: hideTitle ? 'none' : '1px solid var(--border)' }}>
      {!hideTitle && (
        <div style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', letterSpacing: '1px', fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold' }}>
          <span>☷</span> INFRASTRUCTURE HEALTH
        </div>
      )}
      {hideTitle && (
        <div style={{ color: 'var(--text-muted)', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 'bold', textAlign: 'center', marginBottom: '12px' }}>
          PIPELINE STATUS
        </div>
      )}
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {TOOLS.map(tool => {
          // If we have a brief, use the final status from data_availability
          // Otherwise, use the live SSE state
          let state = 'idle';
          let status = '';
          let latency = 0;
          let color = 'var(--text-muted)';
          let textStr = '';
          
          if (brief && brief.data_availability) {
            const finalState = brief.data_availability[tool.id];
            if (finalState) {
              status = finalState.status;
              latency = finalState.latency_ms || 0;
              state = 'done';
              
              if (status === 'AVAILABLE') {
                color = 'var(--accent-green)';
                textStr = `LIVE / ${latency}MS`;
              } else if (status === 'CACHED') {
                color = 'var(--accent-amber)';
                textStr = `CACHED / ${latency}MS`;
              } else {
                color = 'var(--accent-red)';
                textStr = `FAILED / TIMEOUT`;
              }
            }
          } else if (toolStates && toolStates[tool.id]) {
            const liveState = toolStates[tool.id];
            state = liveState.state;
            status = liveState.status;
            latency = liveState.latency_ms || 0;
            
            if (state === 'pending') {
              color = 'var(--accent-amber)';
              textStr = `PENDING / --`;
            } else if (state === 'running') {
              color = 'var(--accent-green)';
              textStr = `FETCHING... / --`;
            } else if (state === 'done') {
              if (status === 'CACHED') {
                color = 'var(--accent-amber)';
                textStr = `CACHED / ${latency}MS / DONE`;
              } else {
                color = 'var(--accent-green)';
                textStr = `LIVE / ${latency}MS / DONE`;
              }
            } else if (state === 'failed') {
              color = 'var(--accent-red)';
              textStr = `FAILED`;
            } else {
              color = 'var(--text-muted)';
              textStr = `IDLE`;
            }
          } else {
            color = 'var(--text-muted)';
            textStr = `IDLE`;
          }

          return (
            <div key={tool.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '6px', height: '6px', backgroundColor: color, animation: state === 'running' ? 'pulse 1s infinite' : 'none' }}></div>
                <div style={{ color: 'var(--text-primary)', fontSize: '11px', fontWeight: 'bold', letterSpacing: '1px' }}>{tool.label}</div>
              </div>
              <div style={{ color: color, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {textStr}
              </div>
            </div>
          );
        })}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}} />
    </div>
  );
}

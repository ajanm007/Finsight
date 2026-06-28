import React from 'react';
import Tooltip from '../common/Tooltip';

export default function TechIndicators({ toolResults }) {
  const tech = toolResults?.compute_technicals || {};
  
  // If tool is not even in toolResults or hasn't returned a result yet, return a skeleton or null
  if (!tech.rsi && !tech.macd) {
    return (
      <div style={{ opacity: 0.3, pointerEvents: 'none' }}>
        <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', letterSpacing: '1px', fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold' }}>
          <span>⚏</span> TECHNICAL INDICATORS (LOADING...)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {[1,2,3,4].map(i => <div key={i} className="panel panel-body" style={{ height: '80px', backgroundColor: 'rgba(255,255,255,0.02)' }}></div>)}
        </div>
      </div>
    );
  }
  
  if (tech.status === 'UNAVAILABLE') {
    return <div style={{ color: 'var(--accent-red)', fontSize: '10px', letterSpacing: '1px' }}>! TECHNICAL DATA UNAVAILABLE</div>;
  }

  const rsi = tech.rsi?.value;
  const rsiInterp = tech.rsi?.interpretation || 'PENDING';
  const rsiColor = rsiInterp === 'overbought' ? 'var(--accent-amber)' : (rsiInterp === 'oversold' ? 'var(--accent-green)' : 'var(--text-primary)');
  
  const macdVal = tech.macd?.macd;
  const macdInterp = tech.macd?.interpretation || 'PENDING';
  const macdColor = macdInterp === 'bullish' ? 'var(--accent-green)' : (macdInterp === 'bearish' ? 'var(--accent-red)' : 'var(--text-muted)');
  const macdStr = macdVal !== undefined ? (macdVal >= 0 ? `+${Number(macdVal).toFixed(2)}` : `${Number(macdVal).toFixed(2)}`) : '--';
  
  const ma50 = tech.moving_averages?.ma_50;
  const ma200 = tech.moving_averages?.ma_200;

  return (
    <div>
      <div style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', letterSpacing: '1px', fontSize: '12px', textTransform: 'uppercase', fontWeight: 'bold' }}>
        <span>⚏</span> TECHNICAL INDICATORS
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        
        {/* RSI */}
        <div className="panel panel-body" style={{ padding: '16px', borderTop: `2px solid ${rsiColor}` }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px' }}>
            <Tooltip text="Relative Strength Index. Scores 0–100. Above 70 = the stock has been bought heavily and may be due a pullback (overbought). Below 30 = it's been sold hard and may bounce (oversold). 30–70 is normal.">
              RSI (14)
            </Tooltip>
          </div>
          <div style={{ color: rsiColor, fontSize: '24px', fontWeight: 'bold', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>
            {rsi !== undefined ? Number(rsi).toFixed(1) : '--'}
          </div>
          <div style={{ color: rsiColor, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 'bold' }}>
            {rsiInterp}
          </div>
        </div>
        
        {/* MACD */}
        <div className="panel panel-body" style={{ padding: '16px', borderTop: `2px solid ${macdColor}` }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px' }}>
            <Tooltip text="Moving Average Convergence Divergence. A momentum indicator. Positive (bullish crossover) means upward momentum is building. Negative (bearish crossover) means it's fading. Think of it as a speedometer for price direction.">
              MACD
            </Tooltip>
          </div>
          <div style={{ color: macdColor, fontSize: '24px', fontWeight: 'bold', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>
            {macdStr}
          </div>
          <div style={{ color: macdColor, fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 'bold' }}>
            {macdInterp.toUpperCase()} X
          </div>
        </div>

        
        {/* MA 50 */}
        <div className="panel panel-body" style={{ padding: '16px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px' }}>
            <Tooltip text="50-day Moving Average — the average closing price over the last 50 trading days. If the current price is above this line, the stock is in a short-to-medium term uptrend. Below it = recent weakness.">
              MA 50
            </Tooltip>
          </div>
          <div style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: 'bold', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>
            {ma50 ? `$${Number(ma50).toFixed(1)}` : '—'}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>
            {ma50 ? (tech.moving_averages?.price_vs_50ma || 'CALCULATING...') : 'UNAVAILABLE'}
          </div>
        </div>
        
        {/* MA 200 */}
        <div className="panel panel-body" style={{ padding: '16px' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '1px', marginBottom: '8px' }}>
            <Tooltip text="200-day Moving Average — the big-picture health check. Above it = the stock is in a long-term uptrend. Below it = long-term downtrend. One of the most widely watched lines in professional finance." width={240}>
              MA 200
            </Tooltip>
          </div>
          <div style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: 'bold', fontFamily: 'var(--font-display)', marginBottom: '4px' }}>
            {ma200 ? `$${Number(ma200).toFixed(1)}` : '—'}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '9px', letterSpacing: '1px', textTransform: 'uppercase' }}>
            {ma200 ? (tech.moving_averages?.price_vs_200ma || 'CALCULATING...') : 'UNAVAILABLE'}
          </div>
        </div>
        
      </div>
    </div>
  );
}

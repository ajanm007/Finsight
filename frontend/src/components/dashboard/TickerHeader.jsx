import React, { useState, useEffect } from 'react';

function isMarketOpen() {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return false;
  const totalMin = utcHour * 60 + utcMin;
  return totalMin >= 870 && totalMin < 1230; // 14:30–21:00 UTC = NYSE hours
}

export default function TickerHeader({ brief, priceData }) {
  const [timeAgo, setTimeAgo] = useState('0S AGO');
  const [marketOpen, setMarketOpen] = useState(isMarketOpen());

  useEffect(() => {
    if (!brief?.created_at) return;
    const updateTime = () => {
      const elapsed = Math.floor(Date.now() / 1000 - brief.created_at);
      if (elapsed < 60) setTimeAgo(`${elapsed}S AGO`);
      else setTimeAgo(`${Math.floor(elapsed / 60)}M ${elapsed % 60}S AGO`);
    };
    updateTime();
    const id = setInterval(updateTime, 1000);
    return () => clearInterval(id);
  }, [brief?.created_at]);

  useEffect(() => {
    const id = setInterval(() => setMarketOpen(isMarketOpen()), 60000);
    return () => clearInterval(id);
  }, []);

  if (!brief) return null;

  const currentPrice = brief.current_price || priceData?.current_price || 0;

  let pctChangeStr = '+0.00%';
  let isPositive = true;
  let volume = null;

  if (priceData?.data?.length >= 2) {
    const data = priceData.data;
    const last = data[data.length - 1];
    const prev = data[data.length - 2];
    const change = last.close - prev.close;
    const pct = (change / prev.close) * 100;
    isPositive = pct >= 0;
    pctChangeStr = `${isPositive ? '+' : ''}${pct.toFixed(2)}%`;
    if (last.volume) {
      volume = last.volume >= 1_000_000
        ? `${(last.volume / 1_000_000).toFixed(1)}M`
        : `${(last.volume / 1_000).toFixed(0)}K`;
    }
  }

  const changeColor = isPositive ? 'var(--accent-green)' : 'var(--accent-red)';

  return (
    <div className="sticky-header" style={{
      borderBottom: '1px solid var(--border)',
      paddingBottom: '16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>

        {/* Left — ticker + company */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontSize: '36px', margin: 0, lineHeight: 1,
              color: 'var(--text-primary)', letterSpacing: '2px',
            }}>
              {brief.ticker}
            </h1>
            <div style={{
              backgroundColor: isPositive ? 'rgba(46,204,113,0.1)' : 'rgba(231,76,60,0.1)',
              color: changeColor,
              padding: '4px 10px',
              border: `1px solid ${isPositive ? 'rgba(46,204,113,0.25)' : 'rgba(231,76,60,0.25)'}`,
              fontSize: '13px', fontWeight: 'bold', letterSpacing: '0.5px',
            }}>
              {pctChangeStr}
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              fontSize: '8px', letterSpacing: '1.5px',
              color: marketOpen ? 'var(--accent-green)' : 'var(--text-muted)',
              border: `1px solid ${marketOpen ? 'rgba(46,204,113,0.2)' : 'var(--border)'}`,
              padding: '3px 8px',
            }}>
              <div style={{
                width: '5px', height: '5px', borderRadius: '50%',
                backgroundColor: marketOpen ? 'var(--accent-green)' : 'var(--text-muted)',
                animation: marketOpen ? 'pulse 2s infinite' : 'none',
              }} />
              {marketOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
            </div>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.5px',
          }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '11px' }}>
              {brief.company_name || brief.ticker}
            </span>
            {brief.exchange && (
              <>
                <span style={{ color: 'var(--border)' }}>|</span>
                <span style={{ letterSpacing: '1px' }}>{brief.exchange}</span>
              </>
            )}
            {volume && (
              <>
                <span style={{ color: 'var(--border)' }}>|</span>
                <span>VOL {volume}</span>
              </>
            )}
            <span style={{ color: 'var(--border)' }}>|</span>
            <span style={{ color: 'var(--accent-amber)', letterSpacing: '1px' }}>
              UPDATED {timeAgo}
            </span>
          </div>
        </div>

        {/* Right — price */}
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: '38px', fontWeight: 'bold',
            color: 'var(--text-primary)', lineHeight: 1, marginBottom: '6px',
            letterSpacing: '1px',
          }}>
            ${currentPrice.toFixed(2)}
          </div>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '2px' }}>
            REAL-TIME QUOTE
          </div>
        </div>

      </div>
    </div>
  );
}

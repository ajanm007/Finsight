import React, { useState, useEffect } from 'react';

export default function TickerHeader({ brief, priceData }) {
  const [timeAgo, setTimeAgo] = useState('0S AGO');

  useEffect(() => {
    if (!brief?.created_at) return;
    
    const updateTime = () => {
      const elapsed = Math.floor(Date.now() / 1000 - brief.created_at);
      if (elapsed < 60) {
        setTimeAgo(`${elapsed}S AGO`);
      } else {
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        setTimeAgo(`${mins}M ${secs}S AGO`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [brief?.created_at]);

  if (!brief) return null;
  
  const currentPrice = brief.current_price || (priceData && priceData.current_price) || 0;
  
  // Calculate fake % change if we have price data
  let pctChangeStr = "+0.00%";
  let isPositive = true;
  
  if (priceData && priceData.data && priceData.data.length >= 2) {
    const data = priceData.data;
    const change = data[data.length - 1].close - data[data.length - 2].close;
    const pctChange = (change / data[data.length - 2].close) * 100;
    isPositive = pctChange >= 0;
    pctChangeStr = `${isPositive ? '+' : ''}${pctChange.toFixed(2)}%`;
  }

  return (
    <div className="sticky-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '36px', margin: 0, lineHeight: 1 }}>{brief.ticker}</h1>
          <div style={{ 
            backgroundColor: isPositive ? '#1a2b21' : '#2a1515', 
            color: isPositive ? 'var(--accent-green)' : 'var(--accent-red)', 
            padding: '4px 8px', 
            border: `1px solid ${isPositive ? '#2ecc7133' : '#e74c3c33'}`,
            fontSize: '14px'
          }}>
            {pctChangeStr}
          </div>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'flex', gap: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{brief.company_name || brief.ticker}</span>
          {brief.exchange && <><span>|</span><span>{brief.exchange}</span></>}
          <span>|</span>
          <span style={{ color: 'var(--accent-amber)' }}>UPDATED {timeAgo}</span>
        </div>
      </div>
      
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--text-primary)', lineHeight: 1, marginBottom: '8px' }}>
          ${currentPrice.toFixed(2)}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '1px' }}>
          REAL-TIME QUOTE
        </div>
      </div>
    </div>
  );
}


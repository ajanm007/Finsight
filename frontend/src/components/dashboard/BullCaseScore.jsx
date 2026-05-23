import React, { useEffect, useState } from 'react';

export default function BullCaseScore({ score }) {
  const [width, setWidth] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setWidth(score || 0);
    }, 200);
    return () => clearTimeout(timer);
  }, [score]);

  const getColor = (val) => {
    if (val < 40) return 'var(--accent-red)';
    if (val < 60) return 'var(--accent-amber)';
    return 'var(--accent-green)';
  };

  return (
    <div style={{ position: 'relative', height: '100px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '1px', backgroundColor: 'var(--border)' }}></div>
      <div style={{ position: 'absolute', top: '-6px', left: '50%', transform: 'translateX(-50%)', padding: '0 12px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
        BULL CASE STRENGTH
      </div>

      <div style={{ width: '100%', marginTop: '16px', padding: '0 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '1px' }}>SIGNAL POWER</span>
          <span style={{ color: getColor(width), fontSize: '16px', fontWeight: 'bold', fontFamily: 'var(--font-display)' }}>{width}%</span>
        </div>
        
        <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
          <div 
            style={{ 
              width: `${width}%`, 
              height: '100%', 
              backgroundColor: getColor(width),
              transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: `0 0 10px ${getColor(width)}`
            }} 
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '8px' }}>BEARISH</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '8px' }}>NEUTRAL</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '8px' }}>BULLISH</span>
        </div>
      </div>
    </div>
  );
}

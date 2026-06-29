import { useEffect, useState } from 'react';
import Tooltip from '../common/Tooltip';

export default function ConfidenceGauge({ confidence }) {
  const [value, setValue] = useState(0);
  
  const targetValue = confidence?.model_confidence ?? confidence?.score_pct ?? 0;
  
  useEffect(() => {
    // Animate gauge fill
    const timer = setTimeout(() => {
      setValue(targetValue);
    }, 100);
    return () => clearTimeout(timer);
  }, [targetValue]);

  // Circle properties
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  const getColor = (val) => {
    if (val < 50) return 'var(--accent-red)';
    if (val < 75) return 'var(--accent-amber)';
    return 'var(--accent-green)';
  };

  return (
    <div style={{ position: 'relative', height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: '30px' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '1px', backgroundColor: 'var(--border)' }}></div>
      <div style={{ position: 'absolute', top: '-6px', left: '50%', transform: 'translateX(-50%)', padding: '0 12px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
        <Tooltip text="How certain the system is in its own reading — separate from whether the verdict is bullish or bearish. Low confidence means data was stale, sources conflicted, or key feeds were unavailable. Treat low-confidence briefs with more skepticism." width={250}>
          MODEL CONFIDENCE
        </Tooltip>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', marginTop: '20px' }}>
        <svg width="110" height="110" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke={getColor(value)}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1.5s ease-in-out', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
          />
        </svg>
        
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: getColor(value), fontFamily: 'var(--font-display)', lineHeight: 1 }}>
            {value}%
          </div>
        </div>
      </div>
      
      <div style={{ textAlign: 'center', marginTop: '8px', color: 'var(--text-muted)', fontSize: '8px', letterSpacing: '1px', textTransform: 'uppercase' }}>
        SYSTEM CERTAINTY | AGENT v4.2
      </div>
    </div>
  );
}


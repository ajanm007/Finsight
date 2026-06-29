import { useState, useEffect } from 'react';

export default function StatusBar({ brief }) {
  const [timestamp, setTimestamp] = useState('');
  const conflicts = brief?.conflicts || [];
  const hasConflicts = conflicts.length > 0;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimestamp(`UTC-0 : ${now.toISOString().split('T')[1]}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 50); // Fast update for ms
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="statusbar" style={{ justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
        <span style={{ color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '8px', height: '8px', border: '1px solid var(--accent-green)' }}></div>
          SYSTEM_OK
        </span>
        
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>|</span>
          <span>MEM: 14.2GB / 64GB</span>
        </span>

        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>|</span>
          <div style={{ width: '6px', height: '6px', backgroundColor: 'var(--text-muted)' }}></div>
          <div style={{ 
            backgroundColor: hasConflicts ? 'var(--accent-amber)' : 'var(--accent-green)', 
            color: 'black', 
            padding: '0 4px', 
            fontWeight: 'bold',
            fontSize: '10px'
          }}>
            {hasConflicts ? 'ALERT' : 'READY'}
          </div>
          <span style={{ color: hasConflicts ? 'var(--accent-amber)' : 'var(--accent-green)', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px' }}>
            {hasConflicts ? `SIGNAL_CONFLICT_DET_0x${conflicts.length}` : 'DATA_STREAMS_SYNCED'}
          </span>
        </span>
      </div>
      
      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{timestamp}</div>
    </div>
  );
}


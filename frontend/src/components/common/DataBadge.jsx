export default function DataBadge({ status }) {
  if (!status) return null;
  
  if (status === 'AVAILABLE') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', backgroundColor: '#1a2b21', color: 'var(--accent-green)', padding: '2px 6px', border: '1px solid #2ecc7133' }}>
        <span>✓</span> LIVE
      </div>
    );
  }
  
  if (status === 'CACHED') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', backgroundColor: '#2a2215', color: 'var(--accent-amber)', padding: '2px 6px', border: '1px solid #e8a83833' }}>
        <span>⚠</span> CACHED
      </div>
    );
  }
  
  if (status === 'UNAVAILABLE' || status === 'FAILED') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', backgroundColor: '#2a1515', color: 'var(--accent-red)', padding: '2px 6px', border: '1px solid #e74c3c33' }}>
        <span>✗</span> UNAVAILABLE
      </div>
    );
  }
  
  return null;
}

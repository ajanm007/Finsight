import React, { useState } from 'react';

export default function WatchlistCard({ 
  item, 
  onSelect, 
  onRemove, 
  isEditMode, 
  onUpdateNotes,
  onDragStart,
  onDragOver,
  onDrop
}) {
  const [notes, setNotes] = useState(item.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const isUp = (item.price_at_brief || 0) > 0; // Simple mock or actual logic

  const handleNotesBlur = async () => {
    if (notes !== item.notes) {
      setIsSaving(true);
      await onUpdateNotes(item.ticker, notes);
      setIsSaving(false);
    }
  };

  return (
    <div 
      className={`watchlist-card ${isEditMode ? 'edit-mode' : ''}`} 
      onClick={isEditMode ? null : onSelect}
      draggable={isEditMode}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {isEditMode && (
        <div className="drag-handle">⠿</div>
      )}

      <button className="remove-btn" onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}>✕</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)', letterSpacing: '1px' }}>{item.ticker}</div>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>SOVEREIGN_ASSET</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: isUp ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            ${item.price_at_brief?.toFixed(2) || '---'}
          </div>
          <div style={{ fontSize: '10px', color: isUp ? 'var(--accent-green)' : 'var(--accent-red)' }}>
            {isUp ? '▲' : '▼'} 2.41%
          </div>
        </div>
      </div>

      <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '4px 0' }}></div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '1px' }}>AGENT_VERDICT</div>
          <div style={{ 
            fontSize: '11px', 
            fontWeight: 'bold', 
            color: item.net_signal === 'bullish' ? 'var(--accent-green)' : item.net_signal === 'bearish' ? 'var(--accent-red)' : 'var(--accent-amber)'
          }}>
            {item.net_signal?.toUpperCase() || 'NO_DATA'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '1px' }}>CONFIDENCE</div>
          <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
            {item.confidence ? `${Math.round(item.confidence * 100)}%` : '---'}
          </div>
        </div>
      </div>

      <div style={{ marginTop: '8px' }}>
        <div style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '1px', marginBottom: '4px' }}>RESEARCH_NOTES</div>
        <textarea 
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder="ADD_RESEARCH_NOTES..."
          disabled={!isEditMode && !item.notes}
          style={{ 
            width: '100%', 
            background: 'rgba(0,0,0,0.2)', 
            border: isEditMode ? '1px solid var(--border)' : '1px solid transparent',
            color: 'var(--text-primary)',
            fontSize: '10px',
            fontFamily: 'var(--font-mono)',
            padding: '4px',
            resize: 'none',
            height: '40px',
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
        />
        {isSaving && <div style={{ fontSize: '8px', color: 'var(--accent-amber)', textAlign: 'right' }}>SAVING...</div>}
      </div>

      {item.last_analyzed && (
        <div style={{ fontSize: '8px', color: 'var(--text-muted)', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          LAST_SYNC: {new Date(item.last_analyzed * 1000).toLocaleString()}
        </div>
      )}
    </div>
  );
}

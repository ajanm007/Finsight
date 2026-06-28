import React, { useState, useEffect } from 'react';

export default function WatchlistCard({
  item,
  index = 0,
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
  const [barVisible, setBarVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBarVisible(true), 120 + index * 60);
    return () => clearTimeout(t);
  }, [index]);

  const handleNotesBlur = async () => {
    if (notes !== item.notes) {
      setIsSaving(true);
      await onUpdateNotes(item.ticker, notes);
      setIsSaving(false);
    }
  };

  const signal = item.net_signal;
  const signalColor = signal?.includes('bull')
    ? 'var(--accent-green)'
    : signal?.includes('bear')
    ? 'var(--accent-red)'
    : 'var(--text-muted)';

  const confidence = item.confidence != null ? Math.round(item.confidence) : null;

  // Freshness derived from last_analyzed
  const now = Date.now() / 1000;
  const age = item.last_analyzed ? now - item.last_analyzed : null;
  const freshnessLabel = !age
    ? 'NO_DATA'
    : age < 3600
    ? 'FRESH'
    : age < 86400
    ? 'RECENT'
    : 'STALE';
  const freshnessColor = !age
    ? 'var(--text-muted)'
    : age < 3600
    ? 'var(--accent-green)'
    : age < 86400
    ? 'var(--accent-amber)'
    : '#c94040';

  const timeAgo = !item.last_analyzed
    ? null
    : age < 60
    ? `${Math.floor(age)}s ago`
    : age < 3600
    ? `${Math.floor(age / 60)}m ago`
    : age < 86400
    ? `${Math.floor(age / 3600)}h ago`
    : `${Math.floor(age / 86400)}d ago`;

  const signalClass = signal?.includes('bull') ? 'bullish' : signal?.includes('bear') ? 'bearish' : 'neutral';

  return (
    <div
      className={`watchlist-card ${signalClass} ${isEditMode ? 'edit-mode' : ''}`}
      style={{ animationDelay: `${index * 0.06}s` }}
      onClick={isEditMode ? null : onSelect}
      draggable={isEditMode}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Amber scan line sweeps down on hover */}
      <div className="card-scan-line" />

      {isEditMode && <div className="drag-handle">⠿</div>}

      {/* Remove button */}
      <button
        className="remove-btn"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
      >
        DEQUEUE ✕
      </button>

      {/* Header: ticker + freshness */}
      <div className="wc-header">
        <div>
          <div className="wc-ticker">{item.ticker}</div>
          <div style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '1.5px', marginTop: '3px' }}>
            SOVEREIGN_ASSET
          </div>
        </div>
        <div className="wc-freshness" style={{ color: freshnessColor }}>
          <span
            className={`wc-fresh-dot${freshnessLabel === 'FRESH' ? ' pulsing' : ''}`}
            style={{ backgroundColor: freshnessColor, color: freshnessColor }}
          />
          {freshnessLabel}
        </div>
      </div>

      <div className="wc-divider" />

      {/* Price + Verdict */}
      <div className="wc-stats">
        <div>
          <div className="wc-label">PRICE_AT_ANALYSIS</div>
          <div className="wc-price">
            {item.price_at_brief ? `$${item.price_at_brief.toFixed(2)}` : '———'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="wc-label">VERDICT</div>
          <div className="wc-verdict" style={{ color: signalColor }}>
            {signal?.includes('bull') ? '▲' : signal?.includes('bear') ? '▼' : '○'} {signal?.toUpperCase().replace(/_/g, ' ') || 'NEUTRAL'}
          </div>
        </div>
      </div>

      {/* Confidence bar */}
      {confidence !== null && (
        <div>
          <div className="wc-bar-header">
            <span className="wc-label">CONFIDENCE</span>
            <span className="wc-bar-value" style={{ color: signalColor }}>{confidence}%</span>
          </div>
          <div className="wc-bar-track">
            <div
              className="wc-bar-fill"
              style={{
                width: barVisible ? `${confidence}%` : '0%',
                backgroundColor: signalColor,
              }}
            />
          </div>
        </div>
      )}

      {/* Notes — visible in edit mode or when notes exist */}
      {(isEditMode || item.notes) && (
        <div>
          <div className="wc-label" style={{ marginBottom: '4px' }}>RESEARCH_NOTES</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="ADD_RESEARCH_NOTES..."
            disabled={!isEditMode}
            className="wc-notes"
            style={{ borderColor: isEditMode ? 'var(--border)' : 'transparent' }}
            onClick={(e) => e.stopPropagation()}
          />
          {isSaving && (
            <div style={{ fontSize: '8px', color: 'var(--accent-amber)', textAlign: 'right', marginTop: '2px' }}>
              SAVING...
            </div>
          )}
        </div>
      )}

      {/* Footer: last sync time */}
      <div className="wc-footer">
        <div className="wc-label" style={{ marginBottom: 0 }}>
          {timeAgo ? `LAST_SYNC: ${timeAgo}` : 'NEVER_ANALYZED'}
        </div>
        {!isEditMode && (
          <div style={{ fontSize: '8px', color: 'rgba(232,168,56,0.4)', letterSpacing: '1px', fontFamily: 'var(--font-mono)' }}>
            CLICK_TO_ANALYZE →
          </div>
        )}
      </div>
    </div>
  );
}

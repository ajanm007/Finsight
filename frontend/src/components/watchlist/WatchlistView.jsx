import { useState, useMemo } from 'react';
import { useWatchlist } from '../../hooks/useWatchlist';
import WatchlistCard from './WatchlistCard';

const FILTERS = ['ALL', 'BULLISH', 'BEARISH', 'STALE'];

export default function WatchlistView({ onSelectTicker }) {
  const { watchlist, loading, addTicker, removeTicker, updateNotes, reorderWatchlist } = useWatchlist();
  const [input, setInput] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggedTicker, setDraggedTicker] = useState(null);
  const [filter, setFilter] = useState('ALL');

  const handleAdd = (e) => {
    e.preventDefault();
    if (input.trim()) {
      addTicker(input.trim().toUpperCase());
      setInput('');
    }
  };

  const handleDragStart = (ticker) => setDraggedTicker(ticker);
  const handleDragOver = (e) => e.preventDefault();

  const handleDrop = (targetTicker) => {
    if (draggedTicker === targetTicker) return;
    const newOrder = [...watchlist.map(item => item.ticker)];
    const draggedIdx = newOrder.indexOf(draggedTicker);
    const targetIdx = newOrder.indexOf(targetTicker);
    newOrder.splice(draggedIdx, 1);
    newOrder.splice(targetIdx, 0, draggedTicker);
    reorderWatchlist(newOrder);
    setDraggedTicker(null);
  };

  const stats = useMemo(() => ({
    total: watchlist.length,
    bullish: watchlist.filter(i => i.net_signal?.includes('bull')).length,
    bearish: watchlist.filter(i => i.net_signal?.includes('bear')).length,
    unanalyzed: watchlist.filter(i => !i.last_analyzed).length,
  }), [watchlist]);

  const now = Date.now() / 1000;
  const filteredList = useMemo(() => {
    if (filter === 'ALL') return watchlist;
    if (filter === 'BULLISH') return watchlist.filter(i => i.net_signal?.includes('bull'));
    if (filter === 'BEARISH') return watchlist.filter(i => i.net_signal?.includes('bear'));
    if (filter === 'STALE') return watchlist.filter(i => !i.last_analyzed || (now - i.last_analyzed) > 86400);
    return watchlist;
  }, [watchlist, filter, now]);

  return (
    <div className="view-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-amber)', fontSize: '24px', letterSpacing: '2px', marginBottom: '8px' }}>
            WATCHLIST
          </h2>
          {/* Stats line */}
          <div className="watchlist-stats">
            <div className="watchlist-stat-item" style={{ color: 'var(--text-muted)' }}>
              <div className="watchlist-stat-dot" style={{ backgroundColor: 'var(--text-muted)' }} />
              {stats.total} TRACKED
            </div>
            {stats.bullish > 0 && (
              <div className="watchlist-stat-item" style={{ color: 'var(--accent-green)' }}>
                <div className="watchlist-stat-dot" style={{ backgroundColor: 'var(--accent-green)' }} />
                {stats.bullish} BULLISH
              </div>
            )}
            {stats.bearish > 0 && (
              <div className="watchlist-stat-item" style={{ color: '#c94040' }}>
                <div className="watchlist-stat-dot" style={{ backgroundColor: '#c94040' }} />
                {stats.bearish} BEARISH
              </div>
            )}
            {stats.unanalyzed > 0 && (
              <div className="watchlist-stat-item" style={{ color: 'var(--text-muted)' }}>
                <div className="watchlist-stat-dot" style={{ backgroundColor: 'var(--text-muted)' }} />
                {stats.unanalyzed} UNANALYZED
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`filter-btn ${isEditMode ? 'active' : ''}`}
            style={{ height: '36px' }}
          >
            {isEditMode ? 'SAVE_CHANGES' : 'EDIT_WATCHLIST'}
          </button>

          <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="ADD_TICKER..."
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              style={{ width: '140px', fontSize: '12px' }}
            />
            <button
              type="submit"
              style={{
                backgroundColor: 'var(--accent-amber)',
                border: 'none',
                color: 'var(--bg-primary)',
                padding: '0 16px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '1px',
              }}
            >
              + ADD
            </button>
          </form>
        </div>
      </div>

      {/* Filter + divider row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="filter-bar" style={{ marginBottom: 0 }}>
          {FILTERS.map(f => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '1px' }}>
          {filteredList.length} / {stats.total} ASSETS
        </div>
      </div>

      <div style={{ height: '1px', backgroundColor: 'var(--border)', marginTop: '-8px' }} />

      {/* Content */}
      {loading && watchlist.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '64px', fontSize: '11px', letterSpacing: '2px' }}>
          INITIALIZING_WATCHLIST...
        </div>
      ) : watchlist.length === 0 ? (
        <div className="watchlist-empty">
          <div className="watchlist-empty-ascii">
            {'[ SOVEREIGN WATCHLIST — EMPTY ]'}<br />
            {'────────────────────────────────'}<br />
            {'  NO ASSETS UNDER SURVEILLANCE  '}<br />
            {'────────────────────────────────'}
          </div>
          <div style={{ fontSize: '13px', letterSpacing: '1px', color: 'var(--text-muted)' }}>
            NO ASSETS TRACKED
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(90,101,119,0.6)', letterSpacing: '1px' }}>
            USE THE INPUT ABOVE TO ADD TICKERS TO YOUR SOVEREIGN WATCHLIST
          </div>
        </div>
      ) : filteredList.length === 0 ? (
        <div style={{ border: '1px dashed var(--border)', padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '1px' }}>
          NO ASSETS MATCH FILTER: {filter}
        </div>
      ) : (
        <div className="watchlist-grid">
          {filteredList.map((item, i) => (
            <WatchlistCard
              key={item.ticker}
              item={item}
              index={i}
              isEditMode={isEditMode}
              onSelect={() => onSelectTicker(item.ticker)}
              onRemove={() => removeTicker(item.ticker)}
              onUpdateNotes={updateNotes}
              onDragStart={() => handleDragStart(item.ticker)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(item.ticker)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

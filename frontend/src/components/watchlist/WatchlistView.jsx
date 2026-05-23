import React, { useState } from 'react';
import { useWatchlist } from '../../hooks/useWatchlist';
import WatchlistCard from './WatchlistCard';

export default function WatchlistView({ onSelectTicker }) {
  const { watchlist, loading, addTicker, removeTicker, updateNotes, reorderWatchlist } = useWatchlist();
  const [input, setInput] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggedTicker, setDraggedTicker] = useState(null);

  const handleAdd = (e) => {
    e.preventDefault();
    if (input.trim()) {
      addTicker(input.trim().toUpperCase());
      setInput('');
    }
  };

  const handleDragStart = (ticker) => {
    setDraggedTicker(ticker);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

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

  return (
    <div className="view-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-amber)', fontSize: '24px', letterSpacing: '2px' }}>WATCHLIST</h2>
          <div style={{ color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '1px', marginTop: '4px' }}>MONITORING_{watchlist.length}_ASSETS</div>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
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
              onChange={(e) => setInput(e.target.value)}
              style={{ width: '160px', fontSize: '12px' }}
            />
            <button type="submit" style={{ 
              backgroundColor: 'var(--accent-amber)', 
              border: 'none', 
              color: 'var(--bg-primary)', 
              padding: '0 16px', 
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)'
            }}>
              ADD
            </button>
          </form>
        </div>
      </div>

      <div style={{ height: '1px', backgroundColor: 'var(--border)' }}></div>

      {loading && watchlist.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '48px' }}>INITIALIZING_WATCHLIST...</div>
      ) : watchlist.length === 0 ? (
        <div style={{ 
          border: '1px dashed var(--border)', 
          padding: '64px', 
          textAlign: 'center', 
          color: 'var(--text-muted)'
        }}>
          <div style={{ fontSize: '14px', marginBottom: '8px' }}>NO ASSETS TRACKED</div>
          <div style={{ fontSize: '10px' }}>USE THE INPUT ABOVE TO ADD TICKERS TO YOUR SOVEREIGN WATCHLIST</div>
        </div>
      ) : (
        <div className="watchlist-grid">
          {watchlist.map(item => (
            <WatchlistCard 
              key={item.ticker} 
              item={item} 
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

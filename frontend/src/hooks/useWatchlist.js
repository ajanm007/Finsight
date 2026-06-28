import { useState, useEffect, useCallback } from 'react';
import { API_BASE, getAuthHeaders } from '../api/client';

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchWatchlist = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/watchlist`, {
        headers: { ...(await getAuthHeaders()) },
      });
      if (!response.ok) throw new Error('Failed to fetch watchlist');
      const data = await response.json();
      setWatchlist(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const addTicker = async (ticker, notes = "") => {
    try {
      const response = await fetch(`${API_BASE}/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({ ticker, notes }),
      });
      if (!response.ok) throw new Error('Failed to add ticker');
      await fetchWatchlist(); // Refresh
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  const removeTicker = async (ticker) => {
    try {
      const response = await fetch(`${API_BASE}/watchlist/${ticker}`, {
        method: 'DELETE',
        headers: { ...(await getAuthHeaders()) },
      });
      if (!response.ok) throw new Error('Failed to remove ticker');
      // Optimistic update
      setWatchlist(prev => prev.filter(item => item.ticker !== ticker));
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  const updateNotes = async (ticker, notes) => {
    try {
      const response = await fetch(`${API_BASE}/watchlist/${ticker}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({ notes }),
      });
      if (!response.ok) throw new Error('Failed to update notes');
      
      setWatchlist(prev => prev.map(item => 
        item.ticker === ticker ? { ...item, notes } : item
      ));
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  const reorderWatchlist = async (tickerOrders) => {
    // Optimistic update
    const originalWatchlist = [...watchlist];
    const ordered = tickerOrders.map(ticker => 
      watchlist.find(item => item.ticker === ticker)
    ).filter(Boolean);
    
    setWatchlist(ordered);

    try {
      const response = await fetch(`${API_BASE}/watchlist/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({ ticker_orders: tickerOrders }),
      });
      if (!response.ok) throw new Error('Failed to reorder watchlist');
      return true;
    } catch (err) {
      setError(err.message);
      setWatchlist(originalWatchlist); // Rollback
      return false;
    }
  };

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  return { 
    watchlist, 
    loading, 
    error, 
    addTicker, 
    removeTicker, 
    updateNotes,
    reorderWatchlist,
    refresh: fetchWatchlist 
  };
}

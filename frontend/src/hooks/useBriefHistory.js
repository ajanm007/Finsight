import { useState, useEffect, useCallback } from 'react';
import { API_BASE, getAuthHeaders } from '../api/client';

export function useBriefHistory() {
  const [briefs, setBriefs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchHistory = useCallback(async (limit = 50) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/briefs/history?limit=${limit}`, {
        headers: { ...(await getAuthHeaders()) },
      });
      if (!response.ok) throw new Error('Failed to fetch brief history');
      const data = await response.json();
      setBriefs(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchForTicker = async (ticker, limit = 20) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/briefs/${ticker}/all?limit=${limit}`, {
        headers: { ...(await getAuthHeaders()) },
      });
      if (!response.ok) throw new Error(`Failed to fetch history for ${ticker}`);
      const data = await response.json();
      return data;
    } catch (err) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchById = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/briefs/id/${id}`, {
        headers: { ...(await getAuthHeaders()) },
      });
      if (!response.ok) throw new Error('Brief not found');
      return await response.json();
    } catch (err) {
      setError(err.message);
      return null;
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { briefs, loading, error, refresh: fetchHistory, fetchForTicker, fetchById };
}

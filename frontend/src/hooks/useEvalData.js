import { useState, useEffect, useCallback } from 'react';
import { API_BASE, getAuthHeaders } from '../api/client';

export function useEvalData() {
  const [stats, setStats] = useState(null);
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const [statsRes, detailsRes] = await Promise.all([
        fetch(`${API_BASE}/eval/leaderboard`, { headers: { ...authHeaders } }),
        fetch(`${API_BASE}/eval/details`, { headers: { ...authHeaders } })
      ]);

      if (!statsRes.ok || !detailsRes.ok) throw new Error('NETWORK_UPLINK_FAILURE');

      const statsData = await statsRes.json();
      const detailsData = await detailsRes.json();

      setStats(statsData);
      setDetails(detailsData);
      setError(null);
    } catch (err) {
      console.error('Eval fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const runEval = async () => {
    try {
      await fetch(`${API_BASE}/eval/run`, {
        method: 'POST',
        headers: { ...(await getAuthHeaders()) },
      });
      await fetchData();
    } catch (err) {
      console.error('Manual eval trigger failed:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { stats, details, loading, error, refresh: fetchData, runEval };
}

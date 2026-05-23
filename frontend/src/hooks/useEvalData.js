import { useState, useEffect, useCallback } from 'react';

export function useEvalData() {
  const [stats, setStats] = useState(null);
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, detailsRes] = await Promise.all([
        fetch('http://localhost:8000/eval/leaderboard'),
        fetch('http://localhost:8000/eval/details')
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
      await fetch('http://localhost:8000/eval/run', { method: 'POST' });
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

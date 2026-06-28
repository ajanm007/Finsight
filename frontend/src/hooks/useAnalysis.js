import { useState, useCallback } from 'react';
import { API_BASE, getAccessToken } from '../api/client';

export function useAnalysis() {
  const [status, setStatus] = useState('idle'); // idle, connecting, running, done, error
  const [toolStates, setToolStates] = useState({
    fetch_price_data: { state: 'idle' },
    compute_technicals: { state: 'idle' },
    fetch_news: { state: 'idle' },
    run_sentiment: { state: 'idle' },
    fetch_sec_filing: { state: 'idle' },
  });
  const [brief, setBrief] = useState(null);
  const [error, setError] = useState(null);

  const startAnalysis = useCallback((ticker, refresh = false) => {
    setStatus('connecting');
    setBrief(null);
    setError(null);
    
    // Reset tools to pending
    setToolStates({
      fetch_price_data: { state: 'pending' },
      compute_technicals: { state: 'pending' },
      fetch_news: { state: 'pending' },
      run_sentiment: { state: 'pending' },
      fetch_sec_filing: { state: 'pending' },
    });

    let eventSource = null;
    let cancelled = false;

    // Token must be retrieved before opening the stream. EventSource cannot
    // send headers, so the Supabase access token is passed as a query param.
    (async () => {
      const token = await getAccessToken();
      if (cancelled) return;

      const params = new URLSearchParams();
      if (refresh) params.set('refresh', 'true');
      if (token) params.set('token', token);
      const query = params.toString();
      const url = `${API_BASE}/stream/${ticker}${query ? `?${query}` : ''}`;
      eventSource = new EventSource(url);

      eventSource.addEventListener('status', (e) => {
        setStatus('running');
        const data = JSON.parse(e.data);
        setToolStates((prev) => ({
          ...prev,
          [data.tool]: {
            state: data.state, // pending, running, done, failed
            status: data.status, // AVAILABLE, CACHED, UNAVAILABLE
            latency_ms: data.latency_ms,
            error: data.error,
            result: data.result // Incremental data for live updates
          }
        }));
      });

      eventSource.addEventListener('brief', (e) => {
        const parsed = JSON.parse(e.data);
        setBrief(parsed.data);
      });

      eventSource.addEventListener('error', (e) => {
        // Application-level error event from the backend (e.g. invalid ticker, 401 auth).
        // Distinct from the connection-level onerror handler below.
        try {
          const data = JSON.parse(e.data);
          if (data && data.message) {
            setError(data.message);
            setStatus('error');
            eventSource.close();
          }
        } catch {
          // Not a JSON payload — let onerror handle transport failures.
        }
      });

      eventSource.addEventListener('done', () => {
        setStatus((prev) => (prev === 'error' ? prev : 'done'));
        eventSource.close();
      });

      eventSource.onerror = (err) => {
        console.error("SSE Error:", err);
        // Only set error if we haven't received a brief yet. A 401 (logged out /
        // expired token) surfaces here as a connection failure, not a silent hang.
        setStatus(prev => prev === 'running' || prev === 'connecting' ? 'error' : prev);
        setError("Connection to analysis stream lost.");
        eventSource.close();
      };
    })();

    return () => {
      cancelled = true;
      if (eventSource) eventSource.close();
    };
  }, []);

  return { status, toolStates, brief, error, startAnalysis };
}

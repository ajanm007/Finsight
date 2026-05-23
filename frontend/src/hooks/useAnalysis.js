import { useState, useCallback } from 'react';

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

    const url = `/stream/${ticker}${refresh ? '?refresh=true' : ''}`;
    const eventSource = new EventSource(url);

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

    eventSource.addEventListener('done', () => {
      setStatus('done');
      eventSource.close();
    });

    eventSource.onerror = (err) => {
      console.error("SSE Error:", err);
      // Only set error if we haven't received a brief yet
      setStatus(prev => prev === 'running' || prev === 'connecting' ? 'error' : prev);
      setError("Connection to analysis stream lost.");
      eventSource.close();
    };

    return () => eventSource.close();
  }, []);

  return { status, toolStates, brief, error, startAnalysis };
}

import { useState, useEffect } from 'react';
import { API_BASE, getAuthHeaders } from '../api/client';

/**
 * Debounced symbol-search hook. Fires a GET /search?q= after 300ms of inactivity.
 * Returns an empty array immediately when query is shorter than 2 characters.
 */
export function useSymbolSearch(query) {
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(
          `${API_BASE}/search?q=${encodeURIComponent(query)}`,
          { headers, signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.results || []);
        }
      } catch (e) {
        if (e.name !== 'AbortError') setSuggestions([]);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return suggestions;
}

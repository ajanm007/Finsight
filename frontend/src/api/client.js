import { supabase } from '../supabase';

export const API_BASE = import.meta.env.VITE_API_URL || '';

// Returns the Authorization header for the current Supabase session,
// or an empty object when logged out (callers degrade gracefully; backend 401s).
export async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Returns the current Supabase access token (or null when logged out).
// Used by the SSE EventSource which cannot send headers.
export async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

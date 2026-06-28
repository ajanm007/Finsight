// Extracts the clean consultant-style conclusion from the raw LLM brief_text.
//
// The backend prompt makes the model emit a scaffolded document:
//   BULL CASE\n- ...\nBEAR CASE\n- ...\nSIGNAL CONFLICTS\n- ...\nAGENT VERDICT\n- ...
// The BULL/BEAR/CONFLICTS sections are already rendered as structured signal
// cards elsewhere in the UI, so showing the raw scaffold again is redundant and
// reads as "template text". This pulls out just the AGENT VERDICT prose.
//
// Works for both new and historical briefs (pure parse, no DB migration).
// Falls back to the full text if no verdict marker is present (e.g. fallback
// briefs generated while the LLM was unavailable).
export function extractSynthesis(briefText) {
  if (!briefText || typeof briefText !== 'string') return '';
  const text = briefText.trim();

  const idx = text.search(/AGENT\s+VERDICT/i);
  if (idx !== -1) {
    const after = text.slice(idx).replace(/AGENT\s+VERDICT\s*[:\-—]?\s*/i, '');
    const cleaned = after
      .split('\n')
      .map(l => l.replace(/^\s*[-•*]\s*/, '').trim())
      .filter(Boolean)
      .join(' ')
      .trim();
    if (cleaned.length > 0) return cleaned;
  }
  return text;
}

import React, { useState, useEffect, useRef } from 'react';
import { useSymbolSearch } from '../../hooks/useSymbolSearch';

export default function TopBar({ ticker, onSearch, status, onOpenSettings, onOpenHelp }) {
  const [input, setInput] = useState('');
  const [time, setTime] = useState('');
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const blurTimer = useRef(null);
  const suggestions = useSymbolSearch(input);

  useEffect(() => setHighlightIdx(-1), [suggestions]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toISOString().split('T')[1].split('.')[0]);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSelect = (symbol) => {
    setDropdownOpen(false);
    setInput('');
    onSearch(symbol);
  };

  const handleKeyDown = (e) => {
    if (dropdownOpen && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIdx(i => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIdx(i => Math.max(i - 1, -1));
        return;
      }
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        return;
      }
      if (e.key === 'Enter' && highlightIdx >= 0) {
        handleSelect(suggestions[highlightIdx].symbol);
        return;
      }
    }
    if (e.key === 'Enter' && input.trim()) {
      handleSelect(input.trim().toUpperCase());
    }
  };

  const handleFocus = () => {
    clearTimeout(blurTimer.current);
    setDropdownOpen(true);
  };

  const handleBlur = () => {
    blurTimer.current = setTimeout(() => setDropdownOpen(false), 150);
  };

  const showDropdown = dropdownOpen && suggestions.length > 0;

  return (
    <div className="topbar" style={{ display: 'flex', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
        <div style={{ color: 'var(--accent-amber)', fontSize: '18px', fontWeight: 'bold', fontFamily: 'var(--font-display)', letterSpacing: '2px' }}>
          FINSIGHT
        </div>

        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }}>🔍</span>
          <input
            type="text"
            placeholder="SEARCH_TICKER..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={{ paddingLeft: '36px', width: '240px', backgroundColor: 'var(--bg-secondary)' }}
          />
          {showDropdown && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderTop: 'none',
              marginTop: '1px',
            }}>
              {suggestions.map((s, i) => (
                <div
                  key={s.symbol}
                  onMouseDown={() => handleSelect(s.symbol)}
                  onMouseEnter={() => setHighlightIdx(i)}
                  onMouseLeave={() => setHighlightIdx(-1)}
                  style={{
                    padding: '7px 12px',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'baseline', gap: '10px',
                    backgroundColor: i === highlightIdx ? 'rgba(232,168,56,0.08)' : 'transparent',
                    borderLeft: `2px solid ${i === highlightIdx ? 'var(--accent-amber)' : 'transparent'}`,
                  }}
                >
                  <span style={{ color: 'var(--accent-amber)', fontSize: '12px', fontWeight: 'bold', minWidth: '56px', fontFamily: 'var(--font-mono)' }}>
                    {s.symbol}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.description}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-muted)', fontSize: '12px' }}>
          <span>ANALYSIS</span>
          {ticker && (
            <>
              <span style={{ color: 'var(--accent-amber)', borderBottom: '2px solid var(--accent-amber)', paddingBottom: '22px', marginBottom: '-22px' }}>{ticker}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '6px', height: '6px', backgroundColor: status === 'running' ? 'var(--accent-amber)' : status === 'error' ? 'var(--accent-red)' : 'var(--accent-green)', borderRadius: '50%' }}></div>
                V4.1_{status === 'running' ? 'ANALYZING' : status === 'error' ? 'ERROR' : 'LIVE'}_{time}
              </span>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', color: 'var(--text-muted)', alignItems: 'center' }}>
        <span
          style={{ cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', border: '1px solid rgba(255,165,0,0.3)', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-amber)', opacity: 0.7 }}
          onClick={onOpenHelp}
          title="Plain English Guide"
        >?</span>
        <span style={{ cursor: 'pointer' }} onClick={onOpenSettings}>⚙</span>
        <span style={{ cursor: 'pointer' }}>👤</span>
      </div>
    </div>
  );
}

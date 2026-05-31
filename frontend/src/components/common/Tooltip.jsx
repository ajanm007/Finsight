import React, { useState, useRef, useEffect } from 'react';

/**
 * Hover/focus tooltip. Wrap any element and pass a `text` prop.
 * Positions itself above by default, flips to below if near viewport top.
 *
 * Usage:
 *   <Tooltip text="RSI measures recent buy/sell pressure on a 0-100 scale.">
 *     <span>RSI (14)</span>
 *   </Tooltip>
 */
export default function Tooltip({ text, children, width = 220 }) {
  const [visible, setVisible] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (visible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setFlipped(rect.top < 120);
    }
  }, [visible]);

  return (
    <span
      ref={triggerRef}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'help' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      tabIndex={0}
    >
      {children}

      {/* ? badge */}
      <span style={{
        marginLeft: '5px',
        fontSize: '8px',
        color: 'var(--accent-amber)',
        opacity: 0.5,
        fontWeight: 'bold',
        lineHeight: 1,
        userSelect: 'none',
      }}>?</span>

      {visible && (
        <span style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          ...(flipped
            ? { top: 'calc(100% + 8px)' }
            : { bottom: 'calc(100% + 8px)' }
          ),
          width: `${width}px`,
          backgroundColor: '#0f0f12',
          border: '1px solid rgba(255, 165, 0, 0.4)',
          borderLeft: '2px solid var(--accent-amber)',
          color: 'var(--text-primary)',
          fontSize: '11px',
          lineHeight: 1.6,
          padding: '10px 12px',
          zIndex: 9999,
          pointerEvents: 'none',
          boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
          fontFamily: 'var(--font-mono, monospace)',
          letterSpacing: '0.2px',
          whiteSpace: 'normal',
          textTransform: 'none',
          fontWeight: 'normal',
        }}>
          <span style={{
            display: 'block',
            color: 'var(--accent-amber)',
            fontSize: '8px',
            letterSpacing: '1.5px',
            fontWeight: 'bold',
            marginBottom: '5px',
            textTransform: 'uppercase',
          }}>
            PLAIN ENGLISH
          </span>
          {text}
        </span>
      )}
    </span>
  );
}

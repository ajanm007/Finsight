import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';

const styles = `
  html, body, #root {
    height: 100%;
    margin: 0;
    padding: 0;
  }
  .fs-root {
    background: #0a0a0c;
    min-height: 100vh;
    height: 100%;
    display: flex;
    position: relative;
    overflow: hidden;
    font-family: 'Courier New', monospace;
    color: #e8e6df;
  }
  .fs-grid-bg {
    position: absolute; inset: 0; pointer-events: none;
    background-image:
      linear-gradient(rgba(212,149,15,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(212,149,15,0.04) 1px, transparent 1px);
    background-size: 40px 40px;
  }
  .fs-left-panel {
    width: 200px; flex-shrink: 0;
    border-right: 1px solid rgba(255,255,255,0.06);
    padding: 32px 24px;
    display: flex; flex-direction: column; justify-content: space-between;
    position: relative;
  }
  .fs-right-panel {
    width: 180px; flex-shrink: 0;
    border-left: 1px solid rgba(255,255,255,0.06);
    padding: 32px 24px;
    display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between;
    position: relative;
  }
  .fs-center-panel {
    flex: 1;
    display: flex; align-items: center; justify-content: center;
    padding: 40px 32px;
  }
  .fs-logo-row { display: flex; align-items: center; gap: 10px; margin-bottom: 32px; }
  .fs-logo-icon {
    width: 28px; height: 28px;
    background: #111116;
    border: 1px solid #d4950f;
    border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .fs-logo-hex {
    width: 11px; height: 12px;
    background: #d4950f;
    clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
  }
  .fs-logo-name { font-size: 16px; letter-spacing: 5px; color: #d4950f; }
  .fs-meta-label { font-size: 9px; color: #5a5850; letter-spacing: 2px; line-height: 2.2; text-transform: uppercase; }
  .fs-vertical-tag {
    position: absolute; bottom: 32px;
    writing-mode: vertical-rl;
    font-size: 8px; letter-spacing: 2px; color: #5a5850; text-transform: uppercase;
  }
  .fs-heading { font-size: 18px; letter-spacing: 6px; text-transform: uppercase; color: #e8e6df; margin-bottom: 10px; font-weight: bold; }
  .fs-heading-line { width: 80px; height: 1px; background: #d4950f; margin-bottom: 36px; box-shadow: 0 0 10px rgba(212, 149, 15, 0.4); }
  .fs-field { margin-bottom: 24px; }
  .fs-field-label { font-size: 10px; letter-spacing: 2px; color: #7a7870; margin-bottom: 12px; display: block; text-transform: uppercase; }
  .fs-field-input {
    width: 100%; background: transparent;
    border: none; border-bottom: 1px solid rgba(255,255,255,0.08);
    color: #e8e6df; font-family: 'Courier New', monospace;
    font-size: 15px; padding: 10px 0;
    outline: none; transition: border-color 0.2s, box-shadow 0.2s;
  }
  .fs-field-input:focus { border-bottom-color: #d4950f; box-shadow: 0 1px 0 #d4950f; }
  .fs-field-input::placeholder { color: #3a3830; letter-spacing: 1px; }
  .fs-mfa-box {
    border: 1px solid rgba(212, 149, 15, 0.15);
    background: rgba(212, 149, 15, 0.02);
    padding: 20px;
    display: grid; grid-template-columns: auto 1fr; gap: 24px;
    align-items: center;
    margin-bottom: 36px;
    box-shadow: inset 0 0 20px rgba(0,0,0,0.2);
  }
  .fs-biometric-container {
    position: relative;
    width: 64px; height: 78px;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
    border: 1px solid rgba(212, 149, 15, 0.3);
    background: #000;
  }
  .fs-scanner-line {
    position: absolute;
    width: 100%; height: 3px;
    background: #d4950f;
    box-shadow: 0 0 20px #d4950f;
    z-index: 2;
    top: 0;
    animation: fsVerticalScan 3s ease-in-out infinite;
  }
  .fs-mfa-text { 
    font-size: 10px; color: #8a8880; line-height: 1.8; letter-spacing: 0.8px; text-transform: uppercase; 
  }
  .fs-error { color: #c94040; font-size: 11px; text-align: center; letter-spacing: 1px; margin-bottom: 24px; font-weight: bold; }
  .fs-form-frame {
    width: 100%; max-width: 420px;
    padding: 48px;
    background: rgba(255, 255, 255, 0.01);
    border: 1px solid rgba(255, 255, 255, 0.03);
    box-shadow: 0 0 40px rgba(0,0,0,0.4);
    position: relative;
  }
  .fs-form-frame::before {
    content: ''; position: absolute; top: -1px; left: -1px; width: 20px; height: 20px;
    border-top: 1px solid #d4950f; border-left: 1px solid #d4950f;
  }
  .fs-form-frame::after {
    content: ''; position: absolute; bottom: -1px; right: -1px; width: 20px; height: 20px;
    border-bottom: 1px solid #d4950f; border-right: 1px solid #d4950f;
  }
  .fs-cta-btn {
    width: 100%; padding: 12px;
    background: transparent;
    border: 1px solid #7a5408;
    color: #d4950f;
    font-family: 'Courier New', monospace; font-size: 10px; letter-spacing: 3px;
    cursor: pointer; 
    transition: color 0.3s, border-color 0.3s;
    text-transform: uppercase;
    position: relative;
    overflow: hidden;
    z-index: 1;
  }
  .fs-cta-btn::before {
    content: '';
    position: absolute;
    top: 100%;
    left: 0;
    width: 100%;
    height: 100%;
    background: #d4950f;
    transition: top 0.4s cubic-bezier(0.23, 1, 0.32, 1);
    z-index: -1;
  }
  .fs-cta-btn:hover:not(:disabled) { 
    color: #0a0a0c;
    border-color: #d4950f; 
    font-weight: bold;
  }
  .fs-cta-btn:hover:not(:disabled)::before {
    top: 0;
  }
  .fs-cta-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .fs-cta-btn.granted { border-color: #2ea87a; color: #2ea87a; }
  .fs-link-row { display: flex; justify-content: center; gap: 24px; margin-top: 20px; }
  .fs-link-btn {
    background: none; border: none; color: #5a5850;
    font-family: 'Courier New', monospace; font-size: 8px; letter-spacing: 1px;
    cursor: pointer; text-transform: uppercase; padding: 0;
  }
  .fs-link-btn:hover { color: #d4950f; }
  .fs-status-row { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
  .fs-biometric-line {
    width: 100%; height: 1px; background: #d4950f;
    opacity: 0.3; margin-bottom: 6px;
    animation: fsScan 2.5s ease-in-out infinite;
  }
  .fs-status-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #2ea87a;
    animation: fsPulse 2s infinite;
  }
  @keyframes fsPulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(46,168,122,0.4); }
    50% { opacity: 0.8; box-shadow: 0 0 0 4px rgba(46,168,122,0); }
  }
  @keyframes fsVerticalScan {
    0%, 100% { top: 0%; opacity: 0.2; }
    50% { top: 100%; opacity: 0.8; }
  }
`;

export default function Login({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [accessCode, setAccessCode] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [granted, setGranted] = useState(false);
  const [error, setError] = useState('');
  const [time, setTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async () => {
    if (loading || granted) return;
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        // Sign in with Email and Access Key
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email,
          password: accessCode, 
        });

        if (authError) throw authError;
        setGranted(true);
      } else {
        // Sign up with Email and Proposed Key
        const { data, error: authError } = await supabase.auth.signUp({
          email: email,
          password: accessCode, // Proposed Key as password
          options: {
            emailRedirectTo: `${window.location.origin}`,
          },
        });

        if (authError) throw authError;
        
        setIsLogin(true);
        setAccessCode('');
        setEmail('');
        setError('VERIFICATION_LINK_SENT — check your email');
      }
    } catch (err) {
      setError(err.message.toUpperCase().replace(/ /g, '_'));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setAccessCode('');
    setEmail('');
  };

  const btnLabel = granted
    ? 'ACCESS GRANTED'
    : loading
      ? 'INITIATING HANDSHAKE...'
      : isLogin
        ? 'ESTABLISH CONNECTION'
        : 'REQUEST PROVISIONING';

  return (
    <>
      <style>{styles}</style>
      <div className="fs-root">
        <div className="fs-grid-bg" />

        {/* Left Panel */}
        <aside className="fs-left-panel">
          <div>
            <div className="fs-logo-row">
              <div className="fs-logo-icon">
                <div className="fs-logo-hex" />
              </div>
              <span className="fs-logo-name">FINSIGHT</span>
            </div>
            <div className="fs-meta-label">
              SOVEREIGN FINANCIAL TERMINAL<br />
              INSTITUTIONAL LIQUIDITY GATE<br />
              NODE_ID: FS-990-ALPHA<br />
              SUPABASE_UPLINK: ACTIVE
            </div>
          </div>
          <div className="fs-meta-label">
            © 2026 FINSIGHT GLOBAL CAPITAL<br />
            TIER 1 ENCRYPTION ACTIVE
          </div>
          <div className="fs-vertical-tag" style={{ left: 0, paddingRight: '8px' }}>SECURITY LAYER 04</div>
        </aside>

        {/* Center Panel */}
        <main className="fs-center-panel">
          <div className="fs-form-frame">
            <div className="fs-heading">{isLogin ? 'Access Identity' : 'Register Node'}</div>
            <div className="fs-heading-line" />

            <div className="fs-field">
              <label className="fs-field-label">{isLogin ? 'OPERATOR_EMAIL' : 'UPLINK_EMAIL'}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="name@domain.terminal"
                className="fs-field-input"
                autoFocus={isLogin}
              />
            </div>

            <div className="fs-field">
              <label className="fs-field-label">{isLogin ? 'ACCESS_KEY' : 'PROPOSED_KEY'}</label>
              <input
                type="password"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isLogin ? '••••••••' : 'CIPHER_SEQUENCE'}
                className="fs-field-input"
                style={{ letterSpacing: '4px' }}
                autoFocus={!isLogin}
              />
            </div>

            <div className="fs-mfa-box">
              <div className="fs-biometric-container">
                <div className="fs-scanner-line" />
                <svg viewBox="0 0 100 120" fill="none" stroke="#d4950f" strokeWidth="2" strokeLinecap="round" width="60" height="66" style={{ opacity: 0.8 }}>
                  <ellipse cx="50" cy="60" rx="5" ry="6" strokeDasharray="3.5 1.7 10.4 0.7 6.9 1.4" strokeDashoffset="0.3" />
                  <ellipse cx="50" cy="60" rx="9" ry="11" strokeDasharray="6.3 3.2 18.9 1.3 12.6 2.5" strokeDashoffset="63" />
                  <ellipse cx="50" cy="60" rx="13" ry="16" strokeDasharray="9.2 4.6 27.5 1.8 18.3 3.7" strokeDashoffset="91" />
                  <ellipse cx="50" cy="60" rx="17" ry="21" strokeDasharray="12 6 36 2.4 24 4.8" strokeDashoffset="119" />
                  <ellipse cx="50" cy="60" rx="21" ry="26" strokeDasharray="14.8 7.4 44.5 3 29.7 5.9" strokeDashoffset="147" />
                  <ellipse cx="50" cy="60" rx="25" ry="31" strokeDasharray="17.7 8.8 53.1 3.5 35.4 7.1" strokeDashoffset="175" />
                  <ellipse cx="50" cy="60" rx="29" ry="36" strokeDasharray="20.5 10.3 61.6 4.1 41.1 8.2" strokeDashoffset="203" />
                  <ellipse cx="50" cy="60" rx="33" ry="41" strokeDasharray="23.4 11.7 70.1 4.7 46.8 9.4" strokeDashoffset="231" />
                </svg>
              </div>
              <div className="fs-mfa-text">
                MULTI-FACTOR AUTHENTICATION REQUIRED FOR LEVEL 4 CLEARANCE.
                ENSURE BIOMETRIC SENSORS ARE CALIBRATED BEFORE ESTABLISHING UPLINK.
              </div>
            </div>

            {error && <div className="fs-error">⚠ {error}</div>}

            <button
              onClick={handleSubmit}
              disabled={loading || granted}
              className={`fs-cta-btn${granted ? ' granted' : ''}`}
            >
              {btnLabel}
            </button>

            <div className="fs-link-row">
              <button onClick={toggleMode} className="fs-link-btn">
                {isLogin ? 'REGISTER_NEW_NODE' : 'BACK_TO_GATE'}
              </button>
              <button className="fs-link-btn" style={{ opacity: 0.4 }}>
                LOST_ENCRYPTION
              </button>
            </div>
          </div>
        </main>

        {/* Right Panel */}
        <aside className="fs-right-panel">
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <span style={{ fontSize: '9px', color: '#d4950f' }}>●</span>
              <span style={{ fontSize: '9px', color: '#5a5850' }}>{time}</span>
            </div>
            <div style={{ marginBottom: '32px' }}>
              <div className="fs-meta-label" style={{ marginBottom: '6px' }}>SYSTEM_STATUS</div>
              <div className="fs-status-row">
                <div className="fs-status-dot" />
                <span style={{ fontSize: '10px', color: '#2ea87a', letterSpacing: '2px' }}>SECURE</span>
              </div>
            </div>
            <div style={{ marginBottom: '32px' }}>
              <div className="fs-meta-label" style={{ marginBottom: '4px' }}>LATENCY</div>
              <div style={{ fontSize: '10px', color: '#e8e6df', letterSpacing: '1px' }}>1.2MS / HKG-892</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginBottom: '6px' }}>
              <div style={{ width: '12px', height: '1px', background: '#d4950f' }} />
              <span className="fs-meta-label">PROTOCOL</span>
            </div>
            <div style={{ fontSize: '10px', color: '#e8e6df', letterSpacing: '1px' }}>AES-256-GCM</div>
          </div>
          <div className="fs-vertical-tag" style={{ right: 0, paddingLeft: '8px' }}>ENCRYPTED SESSION</div>
        </aside>
      </div>
    </>
  );
}
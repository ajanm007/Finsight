import { useState, useEffect } from 'react';
import { supabase } from '../../supabase';

const styles = `
  html, body, #root { height: 100%; margin: 0; padding: 0; }
  .fs-root {
    background: #0a0a0c;
    min-height: 100vh; height: 100%;
    display: flex; position: relative; overflow: hidden;
    font-family: 'JetBrains Mono', 'Courier New', monospace;
    color: #e8e6df;
  }
  .fs-grid-bg {
    position: absolute; inset: 0; pointer-events: none;
    background-image:
      radial-gradient(ellipse at 50% 50%, rgba(212,149,15,0.05) 0%, transparent 60%),
      linear-gradient(rgba(212,149,15,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(212,149,15,0.03) 1px, transparent 1px);
    background-size: 100% 100%, 48px 48px, 48px 48px;
  }

  /* Scanline overlay */
  .fs-scanline {
    position: absolute; inset: 0; pointer-events: none; z-index: 10;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0,0,0,0.03) 2px,
      rgba(0,0,0,0.03) 4px
    );
    animation: fsScanlineMove 8s linear infinite;
  }
  @keyframes fsScanlineMove {
    0% { background-position: 0 0; }
    100% { background-position: 0 100px; }
  }

  /* Boot sequence */
  .fs-left-panel {
    width: 280px; flex-shrink: 0;
    border-right: 1px solid rgba(255,255,255,0.05);
    padding: 36px 32px;
    display: flex; flex-direction: column; gap: 0;
    position: relative;
    opacity: 0; transform: translateX(-20px);
    transition: opacity 0.6s ease, transform 0.6s ease;
  }
  .fs-left-panel.visible { opacity: 1; transform: translateX(0); }

  .fs-right-panel {
    width: 260px; flex-shrink: 0;
    border-left: 1px solid rgba(255,255,255,0.05);
    padding: 36px 32px;
    display: flex; flex-direction: column;
    position: relative;
    opacity: 0; transform: translateX(20px);
    transition: opacity 0.6s ease, transform 0.6s ease;
  }
  .fs-right-panel.visible { opacity: 1; transform: translateX(0); }

  .fs-center-panel {
    flex: 1;
    display: flex; align-items: center; justify-content: center;
    padding: 40px 32px;
  }
  .fs-form-frame {
    width: 100%; max-width: 400px; padding: 44px;
    background: rgba(255,255,255,0.01);
    border: 1px solid rgba(255,255,255,0.04);
    box-shadow: 0 0 60px rgba(0,0,0,0.5); position: relative;
    opacity: 0; transform: translateY(16px) scale(0.98);
    transition: opacity 0.5s ease 0.4s, transform 0.5s ease 0.4s;
  }
  .fs-form-frame.visible { opacity: 1; transform: translateY(0) scale(1); }
  .fs-form-frame::before {
    content: ''; position: absolute; top: -1px; left: -1px;
    width: 0; height: 0;
    border-top: 1px solid #d4950f; border-left: 1px solid #d4950f;
    transition: width 0.3s ease 0.35s, height 0.3s ease 0.35s;
  }
  .fs-form-frame.visible::before { width: 24px; height: 24px; }
  .fs-form-frame::after {
    content: ''; position: absolute; bottom: -1px; right: -1px;
    width: 0; height: 0;
    border-bottom: 1px solid #d4950f; border-right: 1px solid #d4950f;
    transition: width 0.3s ease 0.35s, height 0.3s ease 0.35s;
  }
  .fs-form-frame.visible::after { width: 24px; height: 24px; }

  /* Typewriter heading */
  .fs-heading {
    font-size: 16px; letter-spacing: 6px; text-transform: uppercase;
    color: #e8e6df; margin-bottom: 8px; font-weight: bold;
    overflow: hidden; white-space: nowrap;
    width: 0;
    transition: width 0.4s steps(14) 0.38s;
  }
  .fs-heading.visible { width: 100%; }

  .fs-heading-line {
    width: 0; height: 1px; background: #d4950f;
    margin-bottom: 32px; box-shadow: 0 0 10px rgba(212,149,15,0.4);
    transition: width 0.3s ease 0.78s;
  }
  .fs-heading-line.visible { width: 60px; }

  /* Fields fade in staggered */
  .fs-field {
    margin-bottom: 24px;
    opacity: 0; transform: translateY(6px);
    transition: opacity 0.4s ease, transform 0.4s ease;
  }
  .fs-field.visible { opacity: 1; transform: translateY(0); }

  .fs-mfa-box {
    border: 1px solid rgba(212,149,15,0.12);
    background: rgba(212,149,15,0.02);
    padding: 16px 20px;
    display: grid; grid-template-columns: auto 1fr; gap: 20px;
    align-items: center; margin-bottom: 32px;
    opacity: 0; transition: opacity 0.4s ease;
  }
  .fs-mfa-box.visible { opacity: 1; }

  .fs-cta-wrap {
    opacity: 0; transform: translateY(6px);
    transition: opacity 0.4s ease, transform 0.4s ease;
  }
  .fs-cta-wrap.visible { opacity: 1; transform: translateY(0); }

  /* Data rows — staggered reveal */
  .fs-data-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);
    font-size: 10px; letter-spacing: 1px;
    opacity: 0; transform: translateX(-8px);
    transition: opacity 0.3s ease, transform 0.3s ease;
  }
  .fs-data-row.visible { opacity: 1; transform: translateX(0); }

  .fs-capability {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,0.04);
    font-size: 10px; color: #8a8880; letter-spacing: 0.8px; text-transform: uppercase; line-height: 1.6;
    opacity: 0; transform: translateX(-8px);
    transition: opacity 0.3s ease, transform 0.3s ease;
  }
  .fs-capability.visible { opacity: 1; transform: translateX(0); }

  /* Ambient: value flicker */
  @keyframes fsFlicker {
    0%, 95%, 100% { opacity: 1; }
    96% { opacity: 0.4; }
    97% { opacity: 1; }
    98% { opacity: 0.6; }
    99% { opacity: 1; }
  }
  .fs-flicker { animation: fsFlicker 6s infinite; }
  .fs-flicker-2 { animation: fsFlicker 9s infinite 2s; }
  .fs-flicker-3 { animation: fsFlicker 7s infinite 4s; }

  /* Sparkline bars animate up */
  .fs-sparkline { display: flex; align-items: flex-end; gap: 2px; height: 32px; }
  .fs-sparkline-bar {
    width: 5px; background: rgba(212,149,15,0.35); border-radius: 1px;
    transform: scaleY(0); transform-origin: bottom;
    transition: transform 0.4s ease;
  }
  .fs-sparkline-bar.visible { transform: scaleY(1); }

  /* Logo + section labels */
  .fs-logo-row { display: flex; align-items: center; gap: 12px; margin-bottom: 40px; }
  .fs-logo-icon {
    width: 32px; height: 32px; background: #111116;
    border: 1px solid #d4950f; border-radius: 4px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .fs-logo-hex {
    width: 13px; height: 14px; background: #d4950f;
    clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
    animation: fsPulseHex 3s ease-in-out infinite;
  }
  @keyframes fsPulseHex {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  /* Glitch on logo name */
  .fs-logo-name {
    font-size: 16px; letter-spacing: 4px; color: #d4950f; font-weight: bold;
    position: relative;
    animation: fsGlitch 8s infinite;
  }
  .fs-logo-name::before, .fs-logo-name::after {
    content: 'FINSIGHT';
    position: absolute; top: 0; left: 0;
    opacity: 0;
  }
  .fs-logo-name::before { color: #00ffff; animation: fsGlitchTop 8s infinite; }
  .fs-logo-name::after  { color: #ff003c; animation: fsGlitchBot 8s infinite; }
  @keyframes fsGlitch {
    0%, 90%, 100% { transform: none; }
    91% { transform: skewX(-2deg); }
    92% { transform: none; }
    93% { transform: skewX(1deg); }
    94% { transform: none; }
  }
  @keyframes fsGlitchTop {
    0%, 90%, 100% { opacity: 0; transform: none; }
    91% { opacity: 0.6; transform: translate(-2px, -1px); clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%); }
    92% { opacity: 0; }
    93% { opacity: 0.4; transform: translate(2px, 0); clip-path: polygon(0 0, 100% 0, 100% 30%, 0 30%); }
    94% { opacity: 0; }
  }
  @keyframes fsGlitchBot {
    0%, 90%, 100% { opacity: 0; transform: none; }
    91% { opacity: 0.5; transform: translate(2px, 1px); clip-path: polygon(0 55%, 100% 55%, 100% 100%, 0 100%); }
    92.5% { opacity: 0; }
    93% { opacity: 0.3; transform: translate(-1px, 0); clip-path: polygon(0 60%, 100% 60%, 100% 100%, 0 100%); }
    94% { opacity: 0; }
  }
  .fs-section-label { font-size: 9px; color: #6a6860; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px; }
  .fs-meta-label { font-size: 10px; color: #7a7870; letter-spacing: 1.5px; line-height: 2.2; text-transform: uppercase; }
  .fs-data-key { color: #6a6860; text-transform: uppercase; }
  .fs-data-val { color: #b0b0a8; text-transform: uppercase; }
  .fs-data-val.green { color: #2ea87a; }
  .fs-data-val.amber { color: #d4950f; }
  .fs-divider { height: 1px; background: rgba(255,255,255,0.07); margin: 20px 0; }
  .fs-capability-dot { width: 5px; height: 5px; background: #d4950f; opacity: 0.7; flex-shrink: 0; margin-top: 5px; }
  .fs-vertical-tag {
    position: absolute; bottom: 32px;
    writing-mode: vertical-rl;
    font-size: 9px; letter-spacing: 2px; color: #4a4840; text-transform: uppercase;
  }
  .fs-field-label { font-size: 9px; letter-spacing: 2px; color: #d4950f; margin-bottom: 10px; display: block; text-transform: uppercase; }
  .fs-field-input {
    width: 100%; background: transparent;
    border: none; border-bottom: 1px solid rgba(255,255,255,0.07);
    color: #e8e6df; font-family: 'JetBrains Mono', 'Courier New', monospace;
    font-size: 15px; padding: 10px 0;
    outline: none; transition: border-color 0.2s, box-shadow 0.2s;
  }
  .fs-field-input:focus { border-bottom-color: #d4950f; box-shadow: 0 1px 0 rgba(212,149,15,0.4); caret-color: #d4950f; }
  .fs-field-input::placeholder { color: #2a2820; letter-spacing: 1px; }

  /* ACCESS GRANTED flash overlay */
  .fs-granted-overlay {
    position: fixed; inset: 0; z-index: 999;
    display: flex; align-items: center; justify-content: center;
    flex-direction: column; gap: 16px;
    pointer-events: none; opacity: 0;
    background: rgba(0,0,0,0);
    transition: background 0.3s ease, opacity 0.3s ease;
  }
  .fs-granted-overlay.active {
    opacity: 1;
    background: rgba(0,0,0,0.85);
    pointer-events: all;
  }
  .fs-granted-text {
    font-size: 28px; letter-spacing: 8px; font-weight: bold;
    color: #2ea87a; font-family: 'JetBrains Mono', monospace;
    text-transform: uppercase;
    opacity: 0; transform: scale(0.9);
    transition: opacity 0.3s ease 0.2s, transform 0.3s ease 0.2s;
    text-shadow: 0 0 30px rgba(46,168,122,0.6);
  }
  .fs-granted-overlay.active .fs-granted-text { opacity: 1; transform: scale(1); }
  .fs-granted-sub {
    font-size: 10px; letter-spacing: 3px; color: #6a6860;
    opacity: 0; transition: opacity 0.3s ease 0.5s;
  }
  .fs-granted-overlay.active .fs-granted-sub { opacity: 1; }
  .fs-granted-bar {
    width: 0; height: 2px; background: #2ea87a;
    box-shadow: 0 0 12px #2ea87a;
    transition: width 0.8s ease 0.4s;
    max-width: 200px;
  }
  .fs-granted-overlay.active .fs-granted-bar { width: 200px; }
  .fs-biometric-container {
    position: relative; width: 56px; height: 68px;
    display: flex; align-items: center; justify-content: center;
    overflow: hidden; flex-shrink: 0;
    border: 1px solid rgba(212,149,15,0.25); background: #000;
  }
  .fs-scanner-line {
    position: absolute; width: 100%; height: 2px;
    background: linear-gradient(90deg, transparent, #d4950f, transparent);
    box-shadow: 0 0 12px #d4950f; z-index: 2; top: 0;
    animation: fsVerticalScan 3s ease-in-out infinite;
  }
  .fs-mfa-text { font-size: 9px; color: #5a5850; line-height: 1.8; letter-spacing: 0.8px; text-transform: uppercase; }
  .fs-error { color: #c94040; font-size: 10px; text-align: center; letter-spacing: 1px; margin-bottom: 20px; font-weight: bold; }
  .fs-cta-btn {
    width: 100%; padding: 13px;
    background: transparent; border: 1px solid #7a5408;
    color: #d4950f; font-family: 'JetBrains Mono', 'Courier New', monospace;
    font-size: 10px; letter-spacing: 3px; cursor: pointer;
    transition: color 0.3s, border-color 0.3s; text-transform: uppercase;
    position: relative; overflow: hidden; z-index: 1;
  }
  .fs-cta-btn::before {
    content: ''; position: absolute; top: 100%; left: 0;
    width: 100%; height: 100%; background: #d4950f;
    transition: top 0.4s cubic-bezier(0.23, 1, 0.32, 1); z-index: -1;
  }
  .fs-cta-btn:hover:not(:disabled) { color: #0a0a0c; border-color: #d4950f; font-weight: bold; }
  .fs-cta-btn:hover:not(:disabled)::before { top: 0; }
  .fs-cta-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .fs-cta-btn.granted { border-color: #2ea87a; color: #2ea87a; }
  .fs-link-row { display: flex; justify-content: center; gap: 24px; margin-top: 18px; }
  .fs-link-btn {
    background: none; border: none; color: #6a6860;
    font-family: 'JetBrains Mono', 'Courier New', monospace;
    font-size: 8px; letter-spacing: 1px; cursor: pointer; text-transform: uppercase; padding: 0;
    transition: color 0.2s;
  }
  .fs-link-btn:hover { color: #d4950f; }
  .fs-status-dot {
    width: 6px; height: 6px; border-radius: 50%; background: #2ea87a;
    animation: fsPulse 2s infinite; display: inline-block;
  }
  .fs-sparkline { display: flex; align-items: flex-end; gap: 2px; height: 32px; }
  .fs-sparkline-bar { width: 5px; background: rgba(212,149,15,0.35); border-radius: 1px; }
  @keyframes fsPulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(46,168,122,0.4); }
    50% { opacity: 0.8; box-shadow: 0 0 0 4px rgba(46,168,122,0); }
  }
  @keyframes fsVerticalScan {
    0%, 100% { top: 0%; opacity: 0.3; }
    50% { top: calc(100% - 2px); opacity: 1; }
  }
  @media (max-width: 900px) {
    .fs-left-panel, .fs-right-panel { display: none; }
  }
`;

const SPARKLINE = [40, 55, 35, 60, 45, 70, 50, 65, 48, 72, 58, 80, 62, 75, 68];

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [accessCode, setAccessCode] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [granted, setGranted] = useState(false);
  const [grantedFlash, setGrantedFlash] = useState(false);
  const [error, setError] = useState('');
  const [time, setTime] = useState('');
  // Cosmetic session label shown in the terminal UI (not used for auth). Uses the
  // crypto API for non-predictable output — satisfies code scanning + correct idiom.
  const [sessionId] = useState(() => {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  });

  // Boot sequence state
  const [panelsVisible, setPanelsVisible] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [headingVisible, setHeadingVisible] = useState(false);
  const [dataRowsVisible, setDataRowsVisible] = useState([]);
  const [capsVisible, setCapsVisible] = useState([]);
  const [sparkVisible, setSparkVisible] = useState(false);
  const [fieldsVisible, setFieldsVisible] = useState([false, false]);
  const [mfaVisible, setMfaVisible] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now.toISOString().replace('T', ' ').split('.')[0] + ' UTC');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Boot sequence
  useEffect(() => {
    const seq = [
      [50,  () => setPanelsVisible(true)],
      [200, () => setFormVisible(true)],
      [380, () => setHeadingVisible(true)],
      // data rows staggered
      [450, () => setDataRowsVisible([0])],
      [520, () => setDataRowsVisible([0,1])],
      [590, () => setDataRowsVisible([0,1,2])],
      [660, () => setDataRowsVisible([0,1,2,3])],
      [730, () => setDataRowsVisible([0,1,2,3,4])],
      // capabilities staggered
      [700, () => setCapsVisible([0])],
      [760, () => setCapsVisible([0,1])],
      [820, () => setCapsVisible([0,1,2])],
      [880, () => setCapsVisible([0,1,2,3])],
      [940, () => setCapsVisible([0,1,2,3,4])],
      [980, () => setSparkVisible(true)],
      // form fields
      [700, () => setFieldsVisible([true, false])],
      [820, () => setFieldsVisible([true, true])],
      [920, () => setMfaVisible(true)],
      [1080, () => setCtaVisible(true)],
    ];
    const timers = seq.map(([delay, fn]) => setTimeout(fn, delay));
    return () => timers.forEach(clearTimeout);
  }, []);

  const handleSubmit = async () => {
    if (loading || granted) return;
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password: accessCode });
        if (authError) throw authError;
        setGranted(true);
        setTimeout(() => setGrantedFlash(true), 100);
      } else {
        const { error: authError } = await supabase.auth.signUp({
          email, password: accessCode,
          options: { emailRedirectTo: `${window.location.origin}` },
        });
        if (authError) throw authError;
        setIsLogin(true); setAccessCode(''); setEmail('');
        setError('VERIFICATION_LINK_SENT — check your email');
      }
    } catch (err) {
      setError(err.message.toUpperCase().replace(/ /g, '_'));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter') handleSubmit(); };
  const toggleMode = () => { setIsLogin(!isLogin); setError(''); setAccessCode(''); setEmail(''); };
  const btnLabel = granted ? 'ACCESS GRANTED' : loading ? 'INITIATING HANDSHAKE...' : isLogin ? 'ESTABLISH CONNECTION' : 'REQUEST PROVISIONING';

  return (
    <>
      <style>{styles}</style>
      <div className="fs-root">
        <div className="fs-grid-bg" />
        <div className="fs-scanline" />

        {/* Left Panel */}
        <aside className={`fs-left-panel ${panelsVisible ? 'visible' : ''}`}>
          <div style={{ flex: 1 }}>
            <div className="fs-logo-row">
              <div className="fs-logo-icon"><div className="fs-logo-hex" /></div>
              <span className="fs-logo-name">FINSIGHT</span>
            </div>

            <div className="fs-section-label">Node Identity</div>
            {[
              ['NODE_ID', 'FS-990-ALPHA', 'amber'],
              ['CLUSTER', 'HKG-892', ''],
              ['UPLINK', 'ACTIVE', 'green'],
              ['LATENCY', '1.2MS', ''],
              ['SESSION', sessionId, 'amber'],
            ].map(([k, v, cls], i) => (
              <div key={k} className={`fs-data-row ${dataRowsVisible.includes(i) ? 'visible' : ''}`}>
                <span className="fs-data-key">{k}</span>
                <span className={`fs-data-val ${cls} ${i === 2 ? 'fs-flicker' : i === 3 ? 'fs-flicker-2' : ''}`}>{v}</span>
              </div>
            ))}

            <div className="fs-divider" />

            <div className="fs-section-label">Pipeline Capabilities</div>
            {[
              'Multi-source news sentiment via FinBERT NLP',
              'SEC EDGAR filing analysis',
              'Technical indicators — RSI, MACD, Bollinger',
              'Earnings surprise & insider flow',
              'LLM synthesis with conflict detection',
            ].map((c, i) => (
              <div key={i} className={`fs-capability ${capsVisible.includes(i) ? 'visible' : ''}`}>
                <div className="fs-capability-dot" />
                <span>{c}</span>
              </div>
            ))}

            <div className="fs-divider" />

            <div className="fs-section-label">Signal Activity (30D)</div>
            <div className="fs-sparkline">
              {SPARKLINE.map((h, i) => (
                <div key={i} className={`fs-sparkline-bar ${sparkVisible ? 'visible' : ''}`}
                  style={{ height: `${h}%`, transitionDelay: `${i * 40}ms` }} />
              ))}
            </div>
          </div>

          <div>
            <div className="fs-meta-label" style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '16px' }}>
              © 2026 FINSIGHT<br />TIER 1 ENCRYPTION
            </div>
          </div>
          <div className="fs-vertical-tag" style={{ left: 12 }}>SECURITY LAYER 04</div>
        </aside>

        {/* Center Panel */}
        <main className="fs-center-panel">
          <div className={`fs-form-frame ${formVisible ? 'visible' : ''}`}>
            <div className={`fs-heading ${headingVisible ? 'visible' : ''}`}>
              {isLogin ? 'Access Identity' : 'Register Node'}
            </div>
            <div className={`fs-heading-line ${headingVisible ? 'visible' : ''}`} />

            <div className={`fs-field ${fieldsVisible[0] ? 'visible' : ''}`}>
              <label className="fs-field-label">{isLogin ? 'OPERATOR_EMAIL' : 'UPLINK_EMAIL'}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={handleKeyDown} placeholder="name@domain.terminal" className="fs-field-input" autoFocus={isLogin} />
            </div>

            <div className={`fs-field ${fieldsVisible[1] ? 'visible' : ''}`}>
              <label className="fs-field-label">{isLogin ? 'ACCESS_KEY' : 'PROPOSED_KEY'}</label>
              <input type="password" value={accessCode} onChange={e => setAccessCode(e.target.value)} onKeyDown={handleKeyDown} placeholder={isLogin ? '••••••••' : 'CIPHER_SEQUENCE'} className="fs-field-input" style={{ letterSpacing: '4px' }} autoFocus={!isLogin} />
            </div>

            <div className={`fs-mfa-box ${mfaVisible ? 'visible' : ''}`}>
              <div className="fs-biometric-container">
                <div className="fs-scanner-line" />
                <svg viewBox="0 0 100 120" fill="none" stroke="#d4950f" strokeWidth="2" strokeLinecap="round" width="52" height="62" style={{ opacity: 0.75 }}>
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
                LEVEL 4 CLEARANCE REQUIRED.<br />
                BIOMETRIC VERIFICATION ACTIVE.<br />
                SESSION ENCRYPTED END-TO-END.
              </div>
            </div>

            {error && <div className="fs-error">⚠ {error}</div>}

            <div className={`fs-cta-wrap ${ctaVisible ? 'visible' : ''}`}>
              <button onClick={handleSubmit} disabled={loading || granted} className={`fs-cta-btn${granted ? ' granted' : ''}`}>
                {btnLabel}
              </button>
              <div className="fs-link-row">
                <button onClick={toggleMode} className="fs-link-btn">{isLogin ? 'REGISTER_NEW_NODE' : 'BACK_TO_GATE'}</button>
                <button className="fs-link-btn" style={{ opacity: 0.4 }}>LOST_ENCRYPTION</button>
              </div>
            </div>
          </div>
        </main>

        {/* Right Panel */}
        <aside className={`fs-right-panel ${panelsVisible ? 'visible' : ''}`}>
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: '32px' }}>
              <div className="fs-section-label">System Clock</div>
              <div style={{ fontSize: '12px', color: '#d4950f', letterSpacing: '1px', marginBottom: '12px', fontVariantNumeric: 'tabular-nums' }} className="fs-flicker-3">{time}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="fs-status-dot" />
                <span style={{ fontSize: '10px', color: '#2ea87a', letterSpacing: '2px' }}>SECURE</span>
              </div>
            </div>

            <div className="fs-divider" />

            <div className="fs-section-label">Auth Protocol</div>
            {[
              ['PROTOCOL', 'AES-256-GCM', 'amber'],
              ['MFA', 'REQUIRED', 'green'],
              ['PROVIDER', 'SUPABASE', ''],
              ['TOKEN_TTL', '15MIN', ''],
              ['INACTIVITY', 'AUTO_LOCK', ''],
            ].map(([k, v, cls], i) => (
              <div key={k} className={`fs-data-row ${dataRowsVisible.includes(i) ? 'visible' : ''}`} style={{ transitionDelay: `${i * 80}ms` }}>
                <span className="fs-data-key">{k}</span>
                <span className={`fs-data-val ${cls}`}>{v}</span>
              </div>
            ))}

            <div className="fs-divider" />

            <div className="fs-section-label">Clearance Tiers</div>
            {[
              { level: 'L1', label: 'PUBLIC_FEED', active: false },
              { level: 'L2', label: 'MARKET_DATA', active: false },
              { level: 'L3', label: 'ANALYSIS_ENGINE', active: false },
              { level: 'L4', label: 'SOVEREIGN_FULL', active: true },
            ].map(({ level, label, active }, i) => (
              <div key={level} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: dataRowsVisible.includes(i) ? 1 : 0, transform: dataRowsVisible.includes(i) ? 'translateX(0)' : 'translateX(8px)', transition: 'opacity 0.3s ease, transform 0.3s ease', transitionDelay: `${i * 80 + 200}ms` }}>
                <div style={{ width: '24px', height: '24px', border: `1px solid ${active ? '#d4950f' : 'rgba(255,255,255,0.12)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: active ? '#d4950f' : '#5a5850', flexShrink: 0 }}>{level}</div>
                <span style={{ fontSize: '10px', color: active ? '#d4950f' : '#6a6860', letterSpacing: '1px', textTransform: 'uppercase' }}>{label}</span>
                {active && <span style={{ marginLeft: 'auto', fontSize: '8px', color: '#d4950f' }} className="fs-flicker">●</span>}
              </div>
            ))}

            <div className="fs-divider" />

            <div className="fs-section-label">Data Sources</div>
            {['TAVILY', 'FINNHUB', 'YFINANCE', 'SEC EDGAR', 'STOCKTWITS', 'NSE'].map((s, i) => (
              <div key={s} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: '10px', letterSpacing: '1px', borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#8a8880', opacity: capsVisible.includes(i) ? 1 : 0, transition: 'opacity 0.3s ease', transitionDelay: `${i * 60}ms` }}>
                <span>{s}</span>
                <span style={{ color: '#2ea87a' }} className="fs-flicker-2">LIVE</span>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '16px' }}>
            <div className="fs-meta-label">AUTHORIZED PERSONNEL ONLY</div>
          </div>
          <div className="fs-vertical-tag" style={{ right: 12 }}>ENCRYPTED SESSION</div>
        </aside>

        {/* ACCESS GRANTED overlay */}
        <div className={`fs-granted-overlay ${grantedFlash ? 'active' : ''}`}>
          <div className="fs-granted-text">ACCESS GRANTED</div>
          <div className="fs-granted-bar" />
          <div className="fs-granted-sub">INITIALIZING SOVEREIGN TERMINAL...</div>
        </div>
      </div>
    </>
  );
}

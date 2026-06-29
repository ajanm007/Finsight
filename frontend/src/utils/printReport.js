import { extractSynthesis } from './synthesis';

export function printReport(fullBrief) {
  const bd          = fullBrief?.brief_data || {};
  const bullSigs    = bd.signals?.filter(s => s.type === 'bull') || [];
  const bearSigs    = bd.signals?.filter(s => s.type === 'bear') || [];
  const conflicts   = bd.conflicts || [];
  const dataSources = fullBrief?.sources_snapshot || bd.data_availability || {};
  const isBull      = fullBrief.net_signal?.includes('bull');
  const isBear      = fullBrief.net_signal?.includes('bear');
  const conf        = Math.round(fullBrief.confidence || 0);
  const verdict     = (fullBrief.net_signal || 'NEUTRAL').toUpperCase().replace(/_/g, ' ');

  const AMBER  = '#c8850a';
  const GREEN  = '#1a7a45';
  const RED    = '#b03030';
  const DARK   = '#0a0e14';
  const MUTED  = '#6b7280';

  const verdictBg    = isBull ? '#f0faf4' : isBear ? '#fdf2f2' : '#fdfaf2';
  const verdictColor = isBull ? GREEN      : isBear ? RED       : AMBER;
  const verdictBorder= isBull ? '#b7e4c7'  : isBear ? '#f5c6c6' : '#f0d98a';
  const verdictArrow = isBull ? '▲' : isBear ? '▼' : '○';

  // Filter out malformed source entries (undefined label/value)
  const validSources = (sources) =>
    (sources || []).filter(s => s.label && s.value != null && s.label !== 'undefined');

  const signalRows = (signals, type) => signals.map(s => {
    const c    = type === 'bull' ? GREEN : RED;
    const srcs = validSources(s.sources);
    const inlineData = srcs.map(src =>
      `${src.label}: ${src.value}${src.threshold ? ` vs. ${src.threshold}` : ''}`
    ).join(' · ');
    return `
    <tr style="page-break-inside:avoid;">
      <td style="padding:7px 0;border-bottom:1px solid #eef0f3;vertical-align:top;width:22px;font-size:10px;color:${c};font-weight:bold;">${type === 'bull' ? '▲' : '▼'}</td>
      <td style="padding:7px 8px 7px 0;border-bottom:1px solid #eef0f3;vertical-align:top;">
        <span style="font-family:Arial,sans-serif;font-weight:700;font-size:10.5px;color:${c};letter-spacing:0.5px;">${s.title}</span>
        <span style="font-family:Georgia,serif;font-size:11px;color:#2d3748;"> — ${s.description}${inlineData ? ` <span style="color:${MUTED};font-size:9.5px;font-family:monospace;">(${inlineData})</span>` : ''}</span>
      </td>
    </tr>`;
  }).join('');

  const SOURCE_LABELS = {
    yfinance:      'TECHNICAL ANALYSIS',
    news:          'NEWS & SENTIMENT',
    sec:           'SEC FILINGS',
    sec_filing:    'SEC FILINGS',
    sec_quarterly: 'SEC QUARTERLY FILINGS',
    fundamentals:  'FUNDAMENTALS',
    analyst:       'ANALYST CONSENSUS',
    stocktwits:    'SOCIAL SENTIMENT',
    finnhub:       'MARKET DATA',
    tavily:        'NEWS & SENTIMENT',
    web:           'NEWS & SENTIMENT',
  };

  // Group all signals by source_type
  const allSignals = [...bullSigs, ...bearSigs];
  const grouped = {};
  allSignals.forEach(s => {
    const key = s.source_type || 'general';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  });

  const sourceBreakdown = Object.entries(grouped).map(([sourceType, signals]) => {
    const label = SOURCE_LABELS[sourceType] || sourceType.replace(/_/g, ' ').toUpperCase();
    const rows = signals.map(s => {
      const isBullSig = s.type === 'bull';
      const c = isBullSig ? GREEN : RED;
      const srcs = validSources(s.sources);
      const dataStr = srcs.map(src =>
        `${src.label}: ${src.value}${src.threshold ? ` (threshold: ${src.threshold})` : ''}`
      ).join('<br>');
      return `
        <tr style="page-break-inside:avoid;">
          <td style="padding:9px 12px;border-bottom:1px solid #eef0f3;vertical-align:top;font-family:Arial,sans-serif;font-weight:700;font-size:10px;color:#1a202c;width:22%;">${s.title}</td>
          <td style="padding:9px 12px;border-bottom:1px solid #eef0f3;vertical-align:top;text-align:center;width:12%;">
            <span style="font-family:Arial,sans-serif;font-weight:800;font-size:10px;color:${c};letter-spacing:0.5px;white-space:nowrap;">
              ${isBullSig ? '▲' : '▼'} ${isBullSig ? 'BULL' : 'BEAR'}
            </span>
          </td>
          <td style="padding:9px 12px;border-bottom:1px solid #eef0f3;vertical-align:top;font-family:Georgia,serif;font-size:11px;color:#2d3748;line-height:1.55;width:42%;">${s.description}</td>
          <td style="padding:9px 12px;border-bottom:1px solid #eef0f3;vertical-align:top;font-family:monospace;font-size:9px;color:${MUTED};line-height:1.7;width:24%;">${dataStr || '—'}</td>
        </tr>`;
    }).join('');

    return `
    <div style="margin-bottom:20px;page-break-inside:avoid;">
      <div style="background:#f0f2f5;border-left:3px solid ${AMBER};padding:7px 12px;font-size:8.5px;letter-spacing:2px;font-family:monospace;color:#374151;font-weight:bold;margin-bottom:0;">
        ${label}
      </div>
      <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e8eaed;border-top:none;">
        <thead>
          <tr style="background:#fafafa;">
            <th style="padding:6px 12px;text-align:left;font-size:7.5px;letter-spacing:1.5px;color:#9ca3af;font-family:monospace;border-bottom:1px solid #e2e8f0;font-weight:normal;">INDICATOR</th>
            <th style="padding:6px 12px;text-align:center;font-size:7.5px;letter-spacing:1.5px;color:#9ca3af;font-family:monospace;border-bottom:1px solid #e2e8f0;font-weight:normal;">SIGNAL</th>
            <th style="padding:6px 12px;text-align:left;font-size:7.5px;letter-spacing:1.5px;color:#9ca3af;font-family:monospace;border-bottom:1px solid #e2e8f0;font-weight:normal;">ANALYSIS</th>
            <th style="padding:6px 12px;text-align:left;font-size:7.5px;letter-spacing:1.5px;color:#9ca3af;font-family:monospace;border-bottom:1px solid #e2e8f0;font-weight:normal;">DATA POINT</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }).join('');

  const sourcesGrid = Object.entries(dataSources).map(([tool, info]) => {
    const status = info?.status || 'UNAVAILABLE';
    const color  = status === 'AVAILABLE' ? GREEN : status === 'CACHED' ? AMBER : '#ccc';
    const dot    = status === 'AVAILABLE' ? '●' : status === 'CACHED' ? '◐' : '○';
    const name   = tool.replace(/^fetch_|^compute_|^get_/i, '').replace(/_/g, ' ').toUpperCase();
    return `<span style="display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border:1px solid #e2e8f0;font-size:8.5px;font-family:monospace;background:#fff;">
      <span style="color:${color};font-size:10px;">${dot}</span>
      <span style="color:#4a5568;">${name}</span>
    </span>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>FINSIGHT — ${fullBrief.ticker} — ${new Date(fullBrief.created_at * 1000).toLocaleDateString()}</title>
  <style>
    @page { margin: 0; size: A4 portrait; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace;
      background: #f8f7f4;
      color: #1a202c;
    }

    .page-header {
      background: ${DARK};
      padding: 28px 40px 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid ${AMBER};
    }

    .ticker {
      font-family: Arial, sans-serif;
      font-size: 42px;
      font-weight: 900;
      color: ${AMBER};
      letter-spacing: 4px;
      line-height: 1;
      margin-bottom: 6px;
    }

    .report-subtitle {
      font-size: 9px;
      letter-spacing: 4px;
      color: rgba(255,255,255,0.35);
      font-family: monospace;
    }

    .header-meta {
      text-align: right;
      font-size: 9px;
      color: rgba(255,255,255,0.3);
      font-family: monospace;
      line-height: 2;
    }

    .verdict-banner {
      background: ${verdictBg};
      border-bottom: 1px solid ${verdictBorder};
      padding: 16px 40px;
      display: flex;
      align-items: center;
      gap: 32px;
    }

    .verdict-main {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .verdict-arrow {
      font-size: 28px;
      color: ${verdictColor};
      line-height: 1;
    }

    .verdict-text {
      font-family: Arial, sans-serif;
      font-size: 18px;
      font-weight: 900;
      color: ${verdictColor};
      letter-spacing: 1px;
      white-space: nowrap;
    }

    .verdict-divider {
      width: 1px;
      height: 36px;
      background: ${verdictBorder};
    }

    .verdict-stat {
      text-align: center;
    }

    .verdict-stat-label {
      font-size: 7.5px;
      color: ${MUTED};
      letter-spacing: 2px;
      margin-bottom: 3px;
      font-family: monospace;
    }

    .verdict-stat-value {
      font-family: Arial, sans-serif;
      font-weight: 800;
      font-size: 20px;
    }

    .conf-bar-wrap {
      margin-top: 4px;
      height: 3px;
      background: rgba(0,0,0,0.08);
      width: 60px;
    }

    .conf-bar-fill {
      height: 100%;
      background: ${AMBER};
      width: ${conf}%;
    }

    .body {
      padding: 32px 40px 0;
    }

    .section {
      margin-bottom: 28px;
      page-break-inside: avoid;
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 9px;
      letter-spacing: 2.5px;
      color: ${MUTED};
      margin-bottom: 14px;
      font-family: monospace;
      text-transform: uppercase;
    }

    .section-title::before {
      content: '';
      display: inline-block;
      width: 3px;
      height: 12px;
      background: ${AMBER};
      flex-shrink: 0;
    }

    .section-title::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #e2e8f0;
    }

    .synthesis {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 12.5px;
      line-height: 1.85;
      color: #2d3748;
      padding: 18px 24px;
      border-left: 4px solid ${AMBER};
      background: #fffdf7;
      border-top: 1px solid #f0e4c0;
      border-bottom: 1px solid #f0e4c0;
      border-right: 1px solid #f0e4c0;
    }

    .conflict {
      padding: 11px 16px;
      background: #fffbeb;
      border: 1px solid #f6d860;
      border-left: 3px solid ${AMBER};
      font-size: 11px;
      color: #4a3800;
      margin-bottom: 6px;
      font-family: Georgia, serif;
      line-height: 1.5;
    }

    .page-footer {
      background: ${DARK};
      margin-top: 48px;
      padding: 14px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      page-break-inside: avoid;
    }

    .footer-brand {
      font-family: Arial, sans-serif;
      font-size: 11px;
      font-weight: 900;
      color: ${AMBER};
      letter-spacing: 3px;
    }

    .footer-meta {
      font-size: 8px;
      color: rgba(255,255,255,0.25);
      font-family: monospace;
      letter-spacing: 1px;
    }
  </style>
</head>
<body>

  <!-- Dark header -->
  <div class="page-header">
    <div>
      <div class="ticker">${fullBrief.ticker}</div>
      <div class="report-subtitle">EQUITY_INTELLIGENCE_REPORT</div>
    </div>
    <div class="header-meta">
      <div>REPORT_ID: ${fullBrief.id}</div>
      <div>${new Date(fullBrief.created_at * 1000).toLocaleString()}</div>
    </div>
  </div>

  <!-- Verdict banner -->
  <div class="verdict-banner">
    <div class="verdict-main">
      <div class="verdict-arrow">${verdictArrow}</div>
      <div class="verdict-text">${verdict}</div>
    </div>
    <div class="verdict-divider"></div>
    <div class="verdict-stat">
      <div class="verdict-stat-label">CONFIDENCE</div>
      <div class="verdict-stat-value" style="color:${AMBER};">${conf}%</div>
      <div class="conf-bar-wrap"><div class="conf-bar-fill"></div></div>
    </div>
    <div class="verdict-divider"></div>
    <div class="verdict-stat">
      <div class="verdict-stat-label">BULL_SIGNALS</div>
      <div class="verdict-stat-value" style="color:${GREEN};">${bullSigs.length}</div>
    </div>
    <div class="verdict-stat">
      <div class="verdict-stat-label">BEAR_SIGNALS</div>
      <div class="verdict-stat-value" style="color:${RED};">${bearSigs.length}</div>
    </div>
    ${conflicts.length > 0 ? `
    <div class="verdict-divider"></div>
    <div class="verdict-stat">
      <div class="verdict-stat-label">CONFLICTS</div>
      <div class="verdict-stat-value" style="color:${AMBER};">${conflicts.length}</div>
    </div>` : ''}
  </div>

  <!-- Body -->
  <div class="body">

    ${bd.brief_text ? `
    <div class="section">
      <div class="section-title">ANALYST SYNTHESIS</div>
      <div class="synthesis">${extractSynthesis(bd.brief_text)}</div>
    </div>` : ''}

    ${Object.keys(grouped).length > 0 ? `
    <div class="section">
      <div class="section-title">SOURCE BREAKDOWN</div>
      ${sourceBreakdown}
    </div>` : ''}

    ${bullSigs.length > 0 ? `
    <div class="section">
      <div class="section-title">BULL CASE — ${bullSigs.length} SIGNALS</div>
      <table style="width:100%;border-collapse:collapse;">${signalRows(bullSigs, 'bull')}</table>
    </div>` : ''}

    ${bearSigs.length > 0 ? `
    <div class="section">
      <div class="section-title">BEAR CASE — ${bearSigs.length} SIGNALS</div>
      <table style="width:100%;border-collapse:collapse;">${signalRows(bearSigs, 'bear')}</table>
    </div>` : ''}

    ${conflicts.length > 0 ? `
    <div class="section">
      <div class="section-title">SIGNAL CONFLICTS — ${conflicts.length} DETECTED</div>
      ${conflicts.map(c => `<div class="conflict">⚠ ${c}</div>`).join('')}
    </div>` : ''}

    ${Object.keys(dataSources).length > 0 ? `
    <div class="section">
      <div class="section-title">DATA SOURCES</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">${sourcesGrid}</div>
    </div>` : ''}

  </div>

  <!-- Dark footer -->
  <div class="page-footer">
    <div class="footer-brand">FINSIGHT</div>
    <div class="footer-meta">REPORT_ID: ${fullBrief.id} // ${new Date(fullBrief.created_at * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} // CONFIDENTIAL</div>
  </div>

</body>
</html>`;

  // Record print in localStorage
  try {
    const log = JSON.parse(localStorage.getItem('finsight_print_log') || '{}');
    log[fullBrief.id] = { ticker: fullBrief.ticker, ts: Date.now() };
    localStorage.setItem('finsight_print_log', JSON.stringify(log));
  } catch { /* ignore */ }

  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  win.onafterprint = () => setTimeout(() => win.close(), 1500);
  setTimeout(() => win.print(), 400);
}

export function getPrintLog() {
  try {
    return JSON.parse(localStorage.getItem('finsight_print_log') || '{}');
  } catch {
    return {};
  }
}

export function getLastPrinted(briefId) {
  const log = getPrintLog();
  return log[briefId]?.ts || null;
}

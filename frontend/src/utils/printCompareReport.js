import { extractSynthesis } from './synthesis';

export function printCompareReport(briefs) {
  const AMBER = '#c8850a';
  const GREEN = '#1a7a45';
  const RED   = '#b03030';
  const DARK  = '#0a0e14';
  const MUTED = '#6b7280';

  const fmt = b => {
    const isBull = b.net_signal?.includes('bull');
    const isBear = b.net_signal?.includes('bear');
    return {
      ticker:    b.ticker,
      verdict:   (b.net_signal || 'NEUTRAL').toUpperCase().replace(/_/g, ' '),
      arrow:     isBull ? '▲' : isBear ? '▼' : '○',
      vColor:    isBull ? GREEN : isBear ? RED : MUTED,
      conf:      Math.round(b.confidence || 0),
      bull:      b.brief_data?.signals?.filter(s => s.type === 'bull').length || 0,
      bear:      b.brief_data?.signals?.filter(s => s.type === 'bear').length || 0,
      conflicts: (b.brief_data?.conflicts || []).length,
      price:     b.price_at_brief > 0 ? `$${b.price_at_brief.toFixed(2)}` : '—',
      date:      new Date(b.created_at * 1000).toLocaleDateString(),
      synthesis: extractSynthesis(b.brief_data?.brief_text) || '',
      signals:   b.brief_data?.signals || [],
      conflictList: b.brief_data?.conflicts || [],
    };
  };

  const rows = briefs.map(fmt);
  const colW = Math.floor(72 / rows.length);

  // Comparison table columns
  const thCols = rows.map(r =>
    `<th style="padding:10px 14px;text-align:center;font-family:Arial,sans-serif;font-size:16px;font-weight:900;color:${r.vColor};letter-spacing:2px;border-bottom:2px solid ${r.vColor};min-width:${colW}mm;">${r.ticker}</th>`
  ).join('');

  const makeRow = (label, fn) =>
    `<tr><td style="padding:9px 14px;font-size:8.5px;letter-spacing:1.5px;color:${MUTED};font-family:monospace;border-bottom:1px solid #eef0f3;white-space:nowrap;">${label}</td>${
      rows.map(r => `<td style="padding:9px 14px;text-align:center;border-bottom:1px solid #eef0f3;border-left:1px solid #f0f2f4;">${fn(r)}</td>`).join('')
    }</tr>`;

  const tableRows = [
    makeRow('VERDICT',       r => `<span style="font-family:Arial,sans-serif;font-weight:800;font-size:11px;color:${r.vColor};">${r.arrow} ${r.verdict}</span>`),
    makeRow('CONFIDENCE',    r => `<span style="font-family:Arial,sans-serif;font-weight:800;font-size:18px;color:${AMBER};">${r.conf}%</span><div style="margin:4px auto 0;height:3px;background:#eee;width:60px;"><div style="height:100%;background:${AMBER};width:${r.conf}%;"></div></div>`),
    makeRow('BULL SIGNALS',  r => `<span style="font-family:Arial,sans-serif;font-weight:800;font-size:18px;color:${GREEN};">${r.bull}</span>`),
    makeRow('BEAR SIGNALS',  r => `<span style="font-family:Arial,sans-serif;font-weight:800;font-size:18px;color:${RED};">${r.bear}</span>`),
    makeRow('CONFLICTS',     r => `<span style="font-family:Arial,sans-serif;font-weight:700;font-size:14px;color:${r.conflicts > 0 ? AMBER : MUTED};">${r.conflicts}</span>`),
    makeRow('PRICE AT ANALYSIS', r => `<span style="font-family:monospace;font-size:11px;color:#333;">${r.price}</span>`),
    makeRow('ANALYZED',      r => `<span style="font-family:monospace;font-size:9px;color:${MUTED};">${r.date}</span>`),
  ].join('');

  // Individual report sections
  const individualSections = rows.map(r => {
    const bullSigs = r.signals.filter(s => s.type === 'bull');
    const bearSigs = r.signals.filter(s => s.type === 'bear');

    const sigRows = (sigs, type) => sigs.map(s => {
      const c = type === 'bull' ? GREEN : RED;
      const srcs = (s.sources || []).filter(x => x.label && x.label !== 'undefined' && x.value != null);
      const inline = srcs.map(x => `${x.label}: ${x.value}${x.threshold ? ` vs. ${x.threshold}` : ''}`).join(' · ');
      return `<tr style="page-break-inside:avoid;">
        <td style="padding:7px 0;vertical-align:top;width:18px;font-size:10px;color:${c};font-weight:bold;">${type === 'bull' ? '▲' : '▼'}</td>
        <td style="padding:7px 8px 7px 0;vertical-align:top;border-bottom:1px solid #eef0f3;">
          <span style="font-family:Arial,sans-serif;font-weight:700;font-size:10px;color:${c};">${s.title}</span>
          <span style="font-family:Georgia,serif;font-size:11px;color:#2d3748;"> — ${s.description}</span>
          ${inline ? `<br><span style="font-size:8.5px;color:${MUTED};font-family:monospace;">(${inline})</span>` : ''}
        </td>
      </tr>`;
    }).join('');

    return `
    <div style="page-break-before:always;">
      <!-- Ticker header -->
      <div style="background:${DARK};padding:20px 32px;display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid ${r.vColor};">
        <div>
          <div style="font-family:Arial,sans-serif;font-size:32px;font-weight:900;color:${AMBER};letter-spacing:3px;">${r.ticker}</div>
          <div style="font-size:8px;letter-spacing:3px;color:rgba(255,255,255,0.3);font-family:monospace;">EQUITY_INTELLIGENCE_REPORT</div>
        </div>
        <div style="text-align:right;font-size:9px;color:rgba(255,255,255,0.3);font-family:monospace;line-height:1.9;">
          <div style="font-family:Arial,sans-serif;font-size:16px;font-weight:800;color:${r.vColor};">${r.arrow} ${r.verdict}</div>
          <div>CONFIDENCE: ${r.conf}% · ${r.date}</div>
        </div>
      </div>

      <div style="padding:28px 32px;">
        ${r.synthesis ? `
        <div style="margin-bottom:24px;">
          <div style="font-size:8.5px;letter-spacing:2px;color:${MUTED};font-family:monospace;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
            <span style="display:inline-block;width:3px;height:11px;background:${AMBER};"></span>ANALYST SYNTHESIS
            <span style="flex:1;height:1px;background:#e8eaed;display:inline-block;"></span>
          </div>
          <div style="font-family:Georgia,serif;font-size:12px;line-height:1.8;color:#2d3748;padding:14px 18px;border-left:4px solid ${AMBER};background:#fffdf7;">${r.synthesis}</div>
        </div>` : ''}

        ${bullSigs.length > 0 ? `
        <div style="margin-bottom:20px;">
          <div style="font-size:8.5px;letter-spacing:2px;color:${MUTED};font-family:monospace;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
            <span style="display:inline-block;width:3px;height:11px;background:${GREEN};"></span>BULL CASE — ${bullSigs.length} SIGNALS
            <span style="flex:1;height:1px;background:#e8eaed;display:inline-block;"></span>
          </div>
          <table style="width:100%;border-collapse:collapse;">${sigRows(bullSigs, 'bull')}</table>
        </div>` : ''}

        ${bearSigs.length > 0 ? `
        <div style="margin-bottom:20px;">
          <div style="font-size:8.5px;letter-spacing:2px;color:${MUTED};font-family:monospace;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
            <span style="display:inline-block;width:3px;height:11px;background:${RED};"></span>BEAR CASE — ${bearSigs.length} SIGNALS
            <span style="flex:1;height:1px;background:#e8eaed;display:inline-block;"></span>
          </div>
          <table style="width:100%;border-collapse:collapse;">${sigRows(bearSigs, 'bear')}</table>
        </div>` : ''}

        ${r.conflictList.length > 0 ? `
        <div>
          <div style="font-size:8.5px;letter-spacing:2px;color:${MUTED};font-family:monospace;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
            <span style="display:inline-block;width:3px;height:11px;background:${AMBER};"></span>SIGNAL CONFLICTS — ${r.conflictList.length}
            <span style="flex:1;height:1px;background:#e8eaed;display:inline-block;"></span>
          </div>
          ${r.conflictList.map(c => `<div style="padding:10px 14px;background:#fffbeb;border:1px solid #f6d860;border-left:3px solid ${AMBER};font-size:11px;color:#4a3800;margin-bottom:6px;font-family:Georgia,serif;">⚠ ${c}</div>`).join('')}
        </div>` : ''}
      </div>
    </div>`;
  }).join('');

  const tickers = briefs.map(b => b.ticker).join(' · ');
  const today   = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>FINSIGHT — COMPARATIVE ANALYSIS — ${tickers}</title>
  <style>
    @page { margin: 0; size: A4 portrait; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Courier New', Courier, monospace; background: #f8f7f4; color: #1a202c; }
  </style>
</head>
<body>

  <!-- Cover header -->
  <div style="background:${DARK};padding:28px 32px 22px;border-bottom:3px solid ${AMBER};">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;">
      <div>
        <div style="font-family:Arial,sans-serif;font-size:11px;font-weight:900;color:${AMBER};letter-spacing:4px;margin-bottom:8px;">FINSIGHT</div>
        <div style="font-family:Arial,sans-serif;font-size:28px;font-weight:900;color:#ffffff;letter-spacing:3px;line-height:1;text-shadow:0 0 20px rgba(255,255,255,0.15);">${tickers}</div>
        <div style="font-size:9px;letter-spacing:3px;color:rgba(255,255,255,0.3);font-family:monospace;margin-top:6px;">COMPARATIVE INTELLIGENCE ANALYSIS</div>
      </div>
      <div style="text-align:right;font-size:9px;color:rgba(255,255,255,0.25);font-family:monospace;line-height:1.9;">
        <div>${today}</div>
        <div>${briefs.length} TICKERS COMPARED</div>
      </div>
    </div>
  </div>

  <!-- Comparison table -->
  <div style="padding:32px 32px 0;">
    <div style="font-size:8.5px;letter-spacing:2px;color:${MUTED};font-family:monospace;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
      <span style="display:inline-block;width:3px;height:11px;background:${AMBER};"></span>SIDE-BY-SIDE COMPARISON
      <span style="flex:1;height:1px;background:#e2e8f0;display:inline-block;"></span>
    </div>
    <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #e2e8f0;">
      <thead>
        <tr style="background:#fafafa;">
          <th style="padding:10px 14px;text-align:left;font-size:8px;color:${MUTED};font-family:monospace;font-weight:normal;border-bottom:1px solid #e2e8f0;width:120px;">METRIC</th>
          ${thCols}
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>

  <!-- Synthesis preview on cover page -->
  <div style="padding:24px 32px 32px;">
    <div style="font-size:8.5px;letter-spacing:2px;color:${MUTED};font-family:monospace;margin-bottom:14px;display:flex;align-items:center;gap:8px;">
      <span style="display:inline-block;width:3px;height:11px;background:${AMBER};"></span>ANALYST SYNTHESIS — OVERVIEW
      <span style="flex:1;height:1px;background:#e2e8f0;display:inline-block;"></span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(${rows.length},1fr);gap:14px;">
      ${rows.map(r => `
        <div style="border:1px solid #e2e8f0;border-top:3px solid ${r.vColor};padding:14px;background:white;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <span style="font-family:Arial,sans-serif;font-size:14px;font-weight:900;color:${r.vColor};letter-spacing:2px;">${r.ticker}</span>
            <span style="font-size:9px;color:${MUTED};font-family:monospace;">${r.conf}% · ${r.arrow} ${r.verdict}</span>
          </div>
          <div style="font-family:Georgia,serif;font-size:10.5px;line-height:1.75;color:#374151;">
            ${r.synthesis ? r.synthesis.substring(0, 380) + (r.synthesis.length > 380 ? '…' : '') : 'No synthesis available.'}
          </div>
        </div>`).join('')}
    </div>
  </div>

  <!-- Individual reports -->
  ${individualSections}

  <!-- Footer -->
  <div style="background:${DARK};padding:12px 32px;display:flex;justify-content:space-between;align-items:center;margin-top:40px;">
    <div style="font-family:Arial,sans-serif;font-size:11px;font-weight:900;color:${AMBER};letter-spacing:3px;">FINSIGHT</div>
    <div style="font-size:8px;color:rgba(255,255,255,0.2);font-family:monospace;letter-spacing:1px;">
      COMPARATIVE REPORT // ${tickers} // ${today} // CONFIDENTIAL
    </div>
  </div>

</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  win.onafterprint = () => setTimeout(() => win.close(), 1500);
  setTimeout(() => win.print(), 400);
}

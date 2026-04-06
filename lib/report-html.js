function escapeHtml(value) {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
function renderList(items, emptyLabel) {
    if (items.length === 0) {
        return `<p class="empty">${escapeHtml(emptyLabel)}</p>`;
    }
    return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}
function renderTableRows(rows, emptyLabel) {
    if (rows.length === 0) {
        return `<tr><td colspan="2" class="empty-row">${escapeHtml(emptyLabel)}</td></tr>`;
    }
    return rows
        .map((row, index) => `<tr>
        <td class="col-index">${index + 1}</td>
        <td>${escapeHtml(row.description)}</td>
        <td class="col-date">${escapeHtml(row.date || "-")}</td>
      </tr>`)
        .join("");
}
function buildDefaultProgressReportHtml(input) {
    const { workspace, report } = input;
    const generatedAt = (input.generatedAt ?? new Date()).toLocaleString();
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(workspace.name)} Progress Report</title>
    <style>
      :root { --ink:#1f2a1f; --muted:#5f6e64; --line:#d9e2d8; --panel:#ffffff; --panel-soft:#f5f8f2; --accent:#2f6b47; --accent-soft:#dcebdc; --bg:#eef3ea; }
      * { box-sizing:border-box; }
      body { margin:0; font-family:Georgia, "Times New Roman", serif; color:var(--ink); background:radial-gradient(circle at top left, rgba(111,160,110,0.12), transparent 28%), linear-gradient(180deg, #f7fbf6 0%, var(--bg) 100%); }
      .page { max-width:980px; margin:0 auto; padding:40px 24px 72px; }
      .report-shell { background:var(--panel); border:1px solid var(--line); border-radius:28px; overflow:hidden; box-shadow:0 24px 60px rgba(31,42,31,0.08); }
      .hero { padding:40px 44px 28px; background:linear-gradient(135deg, rgba(47,107,71,0.08), rgba(47,107,71,0.02)), linear-gradient(180deg, #ffffff 0%, #f7fbf6 100%); border-bottom:1px solid var(--line); }
      .eyebrow { display:inline-block; padding:8px 12px; border-radius:999px; background:var(--accent-soft); color:var(--accent); font:600 11px/1.2 Arial, sans-serif; letter-spacing:0.16em; text-transform:uppercase; }
      h1 { margin:18px 0 10px; font-size:38px; line-height:1.1; }
      .subtitle { margin:0; max-width:760px; color:var(--muted); font-size:16px; line-height:1.8; }
      .meta { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:14px; margin-top:28px; }
      .meta-card { background:rgba(255,255,255,0.82); border:1px solid var(--line); border-radius:18px; padding:16px 18px; }
      .meta-label { color:var(--muted); font:600 11px/1.2 Arial, sans-serif; letter-spacing:0.14em; text-transform:uppercase; }
      .meta-value { margin-top:10px; font:700 24px/1.1 Arial, sans-serif; }
      .content { padding:28px 44px 40px; }
      .overview { padding:24px 26px; border-radius:22px; background:var(--panel-soft); border:1px solid var(--line); }
      .section-grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:18px; margin-top:22px; }
      .card { border:1px solid var(--line); border-radius:22px; padding:22px 24px; background:#fff; }
      h2 { margin:0 0 12px; font:700 18px/1.3 Arial, sans-serif; }
      p, li { font-size:15px; line-height:1.8; }
      ul { margin:0; padding-left:20px; }
      li + li { margin-top:8px; }
      .empty { margin:0; color:var(--muted); }
      .footer { margin-top:22px; padding:18px 24px 0; border-top:1px solid var(--line); color:var(--muted); font:500 12px/1.6 Arial, sans-serif; }
      @media print { body { background:#fff; } .page { padding:0; } .report-shell { box-shadow:none; border-radius:0; border:0; } }
      @media (max-width:760px) { .hero, .content { padding-left:22px; padding-right:22px; } .meta, .section-grid { grid-template-columns:1fr; } h1 { font-size:30px; } }
    </style>
  </head>
  <body>
    <div class="page">
      <article class="report-shell">
        <header class="hero">
          <div class="eyebrow">Project Progress Report</div>
          <h1>${escapeHtml(workspace.name)}</h1>
          <p class="subtitle">${escapeHtml(report.overview)}</p>
          <div class="meta">
            <div class="meta-card"><div class="meta-label">Knowledge Files</div><div class="meta-value">${workspace.fileCount}</div></div>
            <div class="meta-card"><div class="meta-label">Captured Updates</div><div class="meta-value">${workspace.updateCount}</div></div>
            <div class="meta-card"><div class="meta-label">Tracked Tasks</div><div class="meta-value">${workspace.taskCount}</div></div>
            <div class="meta-card"><div class="meta-label">Generated On</div><div class="meta-value" style="font-size:16px; line-height:1.4;">${escapeHtml(generatedAt)}</div></div>
          </div>
        </header>
        <section class="content">
          <div class="overview"><h2>Executive Overview</h2><p>${escapeHtml(report.overview)}</p></div>
          <div class="section-grid">
            <section class="card"><h2>Key Accomplishments</h2>${renderList(report.accomplishments, "No accomplishments captured yet.")}</section>
            <section class="card"><h2>Current Focus</h2>${renderList(report.currentFocus, "No focus areas captured yet.")}</section>
            <section class="card"><h2>Risks And Blockers</h2>${renderList(report.risks, "No risks surfaced from the current project context.")}</section>
            <section class="card"><h2>Recommended Next Steps</h2>${renderList(report.nextSteps, "No next steps captured yet.")}</section>
          </div>
          <section class="card" style="margin-top:18px;"><h2>Evidence Highlights</h2>${renderList(report.sourceHighlights, "No source highlights available.")}</section>
          <div class="footer">This draft is generated from the workspace knowledge base, captured updates, and tracked action items available in the project so far.</div>
        </section>
      </article>
    </div>
  </body>
</html>`;
}
function buildMonthlyProgressReportHtml(input) {
    const { workspace, report } = input;
    const generatedAt = (input.generatedAt ?? new Date()).toLocaleDateString();
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(workspace.name)} Monthly Report</title>
    <style>
      :root { --ink:#262626; --muted:#666; --line:#222; --accent:#f4d100; --paper:#fff; --soft:#fafafa; }
      * { box-sizing:border-box; }
      body { margin:0; background:#efefef; color:var(--ink); font-family:Arial, Helvetica, sans-serif; }
      .page { width:min(1100px, calc(100vw - 32px)); margin:24px auto; background:var(--paper); border:1px solid #cfcfcf; padding:24px; }
      .title-wrap { display:flex; justify-content:space-between; align-items:flex-start; gap:24px; border:1px solid var(--line); padding:20px 24px; }
      .title h1 { margin:0; font-size:34px; letter-spacing:0.04em; }
      .title .project-name { margin-top:10px; font-size:28px; color:#b10000; font-weight:700; }
      .meta-table, .data-table { width:100%; border-collapse:collapse; margin-top:18px; table-layout:fixed; }
      .meta-table th, .meta-table td, .data-table th, .data-table td { border:1px solid var(--line); padding:10px 12px; vertical-align:top; font-size:14px; line-height:1.5; }
      .meta-table th, .data-table th { background:var(--soft); text-align:left; font-weight:700; }
      .section-title { margin-top:20px; border-bottom:6px solid var(--accent); padding:10px 0 8px; font-size:22px; font-weight:700; text-transform:uppercase; }
      .section-copy { margin:14px 0 0; font-size:14px; line-height:1.7; }
      ul { margin:12px 0 0; padding-left:20px; }
      li { margin-top:8px; font-size:14px; line-height:1.6; }
      .empty { color:var(--muted); }
      .col-index { width:68px; text-align:center; }
      .col-date { width:160px; }
      .empty-row { text-align:center; color:var(--muted); }
      .footer-note { margin-top:20px; font-size:12px; color:var(--muted); }
      @media print { body { background:#fff; } .page { margin:0; width:auto; border:0; } }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="title-wrap">
        <div class="title">
          <h1>MONTHLY REPORT</h1>
          <div class="project-name">${escapeHtml(workspace.name)}</div>
        </div>
        <div style="font-size:12px; color:var(--muted);">Generated ${escapeHtml(generatedAt)}</div>
      </div>

      <table class="meta-table">
        <tr>
          <th>Report Date</th>
          <th>Prepared By</th>
          <th>Report No.</th>
          <th>Month Of</th>
        </tr>
        <tr>
          <td>${escapeHtml(report.reportDate)}</td>
          <td>${escapeHtml(report.preparedBy)}</td>
          <td>${escapeHtml(report.reportNo)}</td>
          <td>${escapeHtml(report.monthOf)}</td>
        </tr>
        <tr>
          <th colspan="3">For Queries Contact</th>
          <th>Project Associate</th>
        </tr>
        <tr>
          <td colspan="3">${report.queryContacts.length > 0 ? report.queryContacts.map((item) => escapeHtml(item)).join("<br />") : '<span class="empty">No contact details supplied.</span>'}</td>
          <td>${escapeHtml(report.projectAssociate)}</td>
        </tr>
      </table>

      <div class="section-title">Status Summary</div>
      ${report.statusSummary.length > 0 ? `<ul>${report.statusSummary.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : '<p class="section-copy empty">No status summary was generated.</p>'}

      <div class="section-title">Project Overview For The Month</div>
      <table class="data-table">
        <tr>
          <th class="col-index">S.No</th>
          <th>Description</th>
          <th class="col-date">Date</th>
        </tr>
        ${renderTableRows(report.projectOverviewRows, "No monthly project activities were added.")}
      </table>

      <div class="section-title">Other Info</div>
      <table class="data-table">
        <tr>
          <th class="col-index">S.No</th>
          <th>Description</th>
          <th class="col-date">Date</th>
        </tr>
        ${renderTableRows(report.otherInfoRows, "No additional notes were added.")}
      </table>

      <div class="section-title">General Instruction</div>
      ${report.generalInstructions.length > 0 ? `<ul>${report.generalInstructions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : '<p class="section-copy empty">No general instructions were included.</p>'}

      <div class="section-title">Evidence Highlights</div>
      ${renderList(report.sourceHighlights, "No evidence highlights available.")}

      <div class="footer-note">This report draft was generated from the workspace knowledge, updates, tasks, and the selected report template.</div>
    </div>
  </body>
</html>`;
}
export function buildWorkspaceProgressReportHtml(input) {
    if ("templateId" in input.report && input.report.templateId === "collato-monthly-report") {
        return buildMonthlyProgressReportHtml({
            workspace: input.workspace,
            report: input.report,
            generatedAt: input.generatedAt
        });
    }
    return buildDefaultProgressReportHtml({
        workspace: input.workspace,
        report: input.report,
        generatedAt: input.generatedAt
    });
}


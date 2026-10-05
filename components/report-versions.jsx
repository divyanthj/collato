"use client";
import { useEffect, useState } from "react";
import { trackDatafastGoal } from "@/lib/client-analytics";

export function ReportVersions({ workspaceSlug, report, onSelect }) {
  const [versions, setVersions] = useState([]);
  const [canApprove, setCanApprove] = useState(false);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(`/api/workspace-reports?workspaceSlug=${encodeURIComponent(workspaceSlug)}`).then(async response => { if (!response.ok) throw new Error("Could not load saved reports"); return response.json(); }).then(result => { if (active) { setVersions(result.reports); setCanApprove(result.canApprove); } }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, [workspaceSlug, report?.id]);
  useEffect(() => { setEditing(null); }, [report?.id]);
  async function save(action) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/workspace-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceSlug, id: report.id, action, report: editing }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save report");
      if (action === "approve") { onSelect(result); setVersions(previous => previous.map(item => item.id === report.id ? { ...item, state: "approved" } : item)); } else { onSelect(result); }
      trackDatafastGoal(action === "approve" ? "report_approved" : "report_saved", { source: "report", action: action === "approve" ? "accept" : "update" });
      setEditing(null); setMessage(action === "approve" ? "This version is approved." : "New draft version saved. Earlier versions are preserved.");
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  function update(key, value) { setEditing(previous => ({ ...previous, [key]: value })); }
  const fields = report ? Object.entries(report).filter(([key, value]) => !["sources", "period"].includes(key) && (["overview", "reportDate", "preparedBy", "reportNo", "monthOf", "projectAssociate"].includes(key) || Array.isArray(value) && key !== "sources")) : [];
  return <section className="glass-panel rounded-3xl p-6"><h2 className="text-xl font-semibold">Saved reports</h2><p className="mt-2 text-sm text-base-content/70">Each generation or edit creates a draft version. Administrators can approve a specific version.</p>
    <div className="mt-4 flex flex-wrap gap-2">{versions.map(version => <button type="button" className={`btn btn-sm ${version.id === report?.id ? "btn-primary" : "btn-outline"}`} key={version.id} onClick={() => onSelect(version)}>{new Date(version.createdAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC · {version.period?.start}–{version.period?.end} · {version.state}</button>)}{!versions.length && <p className="text-sm text-base-content/60">No saved reports yet.</p>}</div>
    {report?.id && <><p className="mt-4 text-sm">Period: {report.period.start}–{report.period.end} · Report date: {report.period.reportDate} · {report.state}</p><p className="mt-2 text-xs text-base-content/60">{report.coverage}</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" className="btn btn-sm" disabled={busy} onClick={() => setEditing(structuredClone(report))}>Edit a new version</button>{canApprove && report.state !== "approved" && <button type="button" className="btn btn-sm btn-primary" disabled={busy || Boolean(editing)} onClick={() => save("approve")}>Approve version</button>}{["pdf", "docx"].map(format => <a key={format} className="btn btn-sm btn-outline" href={`/api/workspace-reports/${report.id}/export?format=${format}`} onClick={() => trackDatafastGoal("report_export_requested", { source: "report", format })}>Download {format.toUpperCase()}</a>)}</div>
      <details className="mt-4 text-sm"><summary className="cursor-pointer">Evidence citations</summary><ul className="mt-2 space-y-2">{report.sources.map(source => <li key={source.ref}><a className="link" href={source.href}>[{source.ref}] {source.label}</a></li>)}</ul></details>
      {editing && <form className="mt-6 space-y-4" onSubmit={event => { event.preventDefault(); save("edit"); }}>{fields.map(([key, value]) => <div key={key}><label className="block text-sm font-medium" htmlFor={`edit-${key}`}>{key.replace(/([A-Z])/g, " $1")}</label>{Array.isArray(value) && value.some(item => typeof item === "object") ? editing[key].map((row, index) => <div className="mt-2 flex flex-wrap gap-2" key={index}><input aria-label={`${key} row ${index + 1} date`} className="input input-bordered input-sm" value={row.date} onChange={event => update(key, editing[key].map((item, i) => i === index ? { ...item, date: event.target.value } : item))} /><textarea aria-label={`${key} row ${index + 1} description`} className="textarea textarea-bordered flex-1" value={row.description} onChange={event => update(key, editing[key].map((item, i) => i === index ? { ...item, description: event.target.value } : item))} /></div>) : <textarea id={`edit-${key}`} className="textarea textarea-bordered mt-2 w-full" maxLength={15000} rows={3} value={Array.isArray(editing[key]) ? editing[key].join("\n") : editing[key]} onChange={event => update(key, Array.isArray(value) ? event.target.value.split("\n") : event.target.value)} />}</div>)}<p className="text-xs">For lists, use one item per line. Review factual claims and citations before approving.</p><button className="btn btn-primary" disabled={busy}>Save new draft version</button><button type="button" className="btn btn-ghost ml-2" onClick={() => setEditing(null)}>Cancel</button></form>}</>}
    {message && <p role="status" className="mt-4 text-sm">{message}</p>}
  </section>;
}

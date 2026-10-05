"use client";
import { useEffect, useState } from "react";
export function ReportCadence({ workspaceSlug }) {
  const [schedule, setSchedule] = useState({ cadence: "none", nextReportDate: "" });
  const [canEdit, setCanEdit] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; fetch(`/api/workspace-report-schedule?workspaceSlug=${encodeURIComponent(workspaceSlug)}`).then(async response => { if (!response.ok) throw new Error("Could not load reporting schedule"); return response.json(); }).then(result => { if (active) { setSchedule(result.schedule); setCanEdit(result.canEdit); } }).catch(error => { if (active) setMessage(error.message); }); return () => { active = false; }; }, [workspaceSlug]);
  async function save(event) {
    event.preventDefault(); setBusy(true);
    try { const response = await fetch("/api/workspace-report-schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceSlug, ...schedule }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not save schedule"); setMessage("Reporting schedule saved. Reminders appear here in the workspace."); } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  const due = schedule.nextReportDate && schedule.nextReportDate <= new Date().toISOString().slice(0, 10);
  return <div className="mt-4"><p className={`text-sm ${due ? "text-warning" : "text-base-content/70"}`}>{schedule.nextReportDate ? `${due ? "Report due" : "Next report"}: ${schedule.nextReportDate} · ${schedule.cadence}` : "Set the next reporting date to keep collection on track."}</p>{due && <p className="mt-2 text-sm">Bring back any missing evidence and prepare the next draft.</p>}{canEdit && <details className="mt-3 text-sm"><summary className="cursor-pointer">Reporting schedule</summary><form onSubmit={save} className="mt-3 flex flex-wrap items-end gap-2"><label>Cadence<select className="select select-bordered select-sm mt-1 block" value={schedule.cadence} onChange={event => setSchedule(previous => ({ ...previous, cadence: event.target.value }))}><option value="none">One time</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label><label>Next report date<input type="date" required className="input input-bordered input-sm mt-1 block" value={schedule.nextReportDate} onChange={event => setSchedule(previous => ({ ...previous, nextReportDate: event.target.value }))} /></label><button className="btn btn-sm" disabled={busy}>Save schedule</button></form></details>}{message && <p role="status" className="mt-2 text-sm">{message}</p>}</div>;
}

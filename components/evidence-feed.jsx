"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildEvidenceFeed, filterEvidenceFeed } from "@/lib/evidence-utils";
import { VoiceInputButton } from "@/components/voice-input-button";
import { trackDatafastGoal } from "@/lib/client-analytics";

export function EvidenceFeed({ workspace, files, updates, currentUserEmail, canReview, canManageAiPrivacy }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [voice, setVoice] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const items = useMemo(() => filterEvidenceFeed(buildEvidenceFeed(files, updates), { query, kind, review: reviewFilter }), [files, updates, query, kind, reviewFilter]);
  async function save(event) {
    event.preventDefault(); setBusy(true); setMessage("");
    const failures = [];
    try {
      if (body.trim()) {
        const response = await fetch("/api/workspace-evidence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceSlug: workspace.slug, body, inputMethod: voice ? "voice" : "typed" }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not save evidence");
        setBody(""); setVoice(false);
        trackDatafastGoal("evidence_saved", { source: "evidence", input_method: voice ? "voice" : "typed" });
      }
      const remaining = [];
      for (const file of attachments) {
        const form = new FormData(); form.append("workspaceSlug", workspace.slug); form.append("file", file); form.append("manualNotes", "");
        try {
          const response = await fetch("/api/workspace-files", { method: "POST", body: form });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Upload failed");
          trackDatafastGoal("evidence_saved", { source: "evidence", input_method: "file_upload" });
        } catch (error) { remaining.push(file); failures.push(`${file.name}: ${error.message}`); }
      }
      setAttachments(remaining);
      setMessage(failures.length ? `Saved successful items. ${failures.join("; ")}` : "Evidence saved to shared memory. You can review the interpretation below.");
      router.refresh();
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  async function review(item, summary) {
    setBusy(true);
    try {
      const response = await fetch("/api/workspace-evidence", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceSlug: workspace.slug, id: item.id, kind: item.kind, summary }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Review failed");
      trackDatafastGoal("evidence_reviewed", { source: "evidence", action: "accept" });
      router.refresh(); setMessage("Interpretation reviewed. Original evidence is preserved.");
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  async function createTask(item, title) {
    setBusy(true);
    try {
      const response = await fetch("/api/workspace-tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceSlug: workspace.slug, title, description: `Follow-up from evidence: ${item.kind === "update" ? item.body : item.fileName}`, sourceUpdateId: item.kind === "update" ? item.id : "" }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "Could not create task");
      setMessage("Follow-up created. Assign a teammate and due date in Tasks."); router.refresh();
      trackDatafastGoal("task_created", { source: "evidence", has_assignee: "no", has_due_date: "no" });
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  async function copyCaptureLink() {
    try { await navigator.clipboard.writeText(`${window.location.origin}/dashboard/${workspace.slug}/evidence#capture`); setMessage("Project capture link copied. Teammates sign in to use it."); trackDatafastGoal("evidence_capture_link_copied", { source: "evidence" }); } catch { setMessage("Copy this page's URL and add #capture to share the capture form."); }
  }
  async function togglePrivacy(item) {
    setBusy(true);
    try {
      const response = await fetch(`/api/${item.kind === "file" ? "workspace-files" : "workspace-updates"}/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceSlug: workspace.slug, aiPrivate: !item.aiPrivate }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Privacy update failed");
      router.refresh(); setMessage("Evidence AI privacy updated.");
      trackDatafastGoal("ai_privacy_changed", { scope: item.kind, ai_private: item.aiPrivate ? "no" : "yes" });
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  return <div className="mt-6 space-y-6">
    <form id="capture" onSubmit={save} className="glass-panel rounded-3xl p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-semibold">Add evidence</h2><button type="button" className="btn btn-ghost btn-sm" onClick={copyCaptureLink}>Copy capture link</button></div>
      <p className="mt-2 text-sm text-base-content/70">Record what happened, share a file, or paste a screenshot. Everything stays together in this workspace.</p>
      <label className="mt-4 block text-sm" htmlFor="evidence-note">Note</label>
      <textarea id="evidence-note" className="textarea textarea-bordered mt-2 w-full" rows={4} value={body} disabled={busy} placeholder="What changed? What did the team learn?" onChange={event => setBody(event.target.value)} onPaste={event => { const images = Array.from(event.clipboardData.files).filter(file => file.type.startsWith("image/")); if (images.length) { event.preventDefault(); setAttachments(previous => [...previous, ...images]); } }} />
      <div className="mt-3 flex flex-wrap items-center gap-3"><fieldset disabled={busy}><VoiceInputButton onBusyChange={setVoiceBusy} onTranscript={text => { setBody(previous => `${previous}${previous ? "\n" : ""}${text}`); setVoice(true); }} /></fieldset>
        <label className="btn btn-outline">Attach files<input aria-label="Attach evidence files" type="file" multiple className="sr-only" disabled={busy} onChange={event => { setAttachments(previous => [...previous, ...Array.from(event.target.files)]); event.target.value = ""; }} /></label>
        <button className="btn btn-primary" disabled={busy || voiceBusy || (!body.trim() && !attachments.length)}>{busy ? "Saving…" : "Save evidence"}</button></div>
      {attachments.map((file, index) => <div className="mt-2 flex items-center gap-3 text-sm" key={`${file.name}-${index}`}>{file.name}<button type="button" className="btn btn-ghost btn-xs" disabled={busy} onClick={() => setAttachments(previous => previous.filter((_, i) => i !== index))}>Remove</button></div>)}
      {message && <p role="status" className="mt-4 text-sm">{message}</p>}
    </form>
    <section className="glass-panel rounded-3xl p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Shared evidence</h2><div className="flex flex-wrap gap-2"><input aria-label="Search evidence" className="input input-bordered input-sm" placeholder="Search evidence" value={query} onChange={event => setQuery(event.target.value)} /><select aria-label="Evidence type" className="select select-bordered select-sm" value={kind} onChange={event => setKind(event.target.value)}><option value="all">All evidence</option><option value="file">Files</option><option value="update">Notes and voice</option></select><select aria-label="Review status" className="select select-bordered select-sm" value={reviewFilter} onChange={event => setReviewFilter(event.target.value)}><option value="all">All review states</option><option value="needs_review">Needs review</option><option value="reviewed">Recorded or reviewed</option></select></div></div>
      <p className="mt-2 text-xs text-base-content/60">Showing the latest {files.length} files and {updates.length} notes available to you. Search filters these loaded items.</p>
      <div className="mt-5 space-y-4">{items.map(item => <article id={item.anchor} key={`${item.kind}:${item.id}`} className="rounded-2xl border border-base-300 p-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold break-words">{item.title}</h3><span className="badge badge-outline">{item.kind === "file" ? "File" : item.inputMethod === "voice" ? "Voice note" : "Note"}</span></div><p className="mt-2 text-xs text-base-content/60">{new Date(item.createdAt).toLocaleDateString()} · {item.contributor}{item.aiPrivate ? " · AI private" : ""}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{item.summary}</p>
        <details className="mt-3 text-sm"><summary className="cursor-pointer">Original evidence</summary><p className="mt-2 whitespace-pre-wrap break-words">{item.originalText || item.text}</p>{item.kind === "file" && <a className="link mt-2 inline-block" href={`/api/workspace-files/${item.id}/download`}>Download source</a>}</details>
        {(canReview || (item.kind === "file" ? item.uploadedBy : item.createdBy) === currentUserEmail) && <details className="mt-3"><summary className="cursor-pointer text-sm">{item.reviewState === "reviewed" ? "Edit interpretation" : "Review interpretation"}</summary><form className="mt-3" onSubmit={event => { event.preventDefault(); review(item, new FormData(event.currentTarget).get("summary")); }}><label className="text-sm">{item.kind === "file" ? "Extracted source text" : "Summary"}<textarea name="summary" defaultValue={item.kind === "file" ? item.text : item.summary} required maxLength={item.kind === "file" ? 30000 : 4000} className="textarea textarea-bordered mt-2 w-full" /></label><button className="btn btn-sm mt-2" disabled={busy}>Save reviewed summary</button></form></details>}
        <details className="mt-3 text-sm"><summary className="cursor-pointer">Create a follow-up</summary><form className="mt-2 flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); createTask(item, new FormData(event.currentTarget).get("title")); }}><input name="title" aria-label="Follow-up task title" required maxLength={200} placeholder="What needs to happen next?" className="input input-bordered input-sm flex-1" /><button className="btn btn-sm" disabled={busy}>Create task</button></form></details>
        {canManageAiPrivacy && <button type="button" className="btn btn-xs btn-outline mt-3" disabled={busy} onClick={() => togglePrivacy(item)}>{item.aiPrivate ? "Allow AI access" : "Make AI private"}</button>}
        {item.reviewState === "reviewed" && <p className="mt-2 text-xs text-success">Interpretation reviewed</p>}
      </article>)}{!items.length && <p className="py-8 text-sm text-base-content/70">{query ? "No matching evidence in these items." : "Add the first note or file to start building shared memory."}</p>}</div>
    </section>
  </div>;
}

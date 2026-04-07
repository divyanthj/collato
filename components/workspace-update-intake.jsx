"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { readResponsePayload } from "@/lib/client-api";
import { VoiceInputButton } from "@/components/voice-input-button";
import { WaveformCanvas } from "@/components/waveform-canvas";

const DEFAULT_UPDATE_CHANNEL = "Update";
const ACTION_TRACKER_STATE_LABELS = {
    active: "Active",
    hidden: "Hidden",
    suppressed: "Suppressed",
    archived: "Archived"
};

export function WorkspaceUpdateIntake({ workspaces, initialUpdates, initialActivityEvents = [], isAuthenticated, currentUserName, currentUserEmail }) {
    const voiceButtonRef = useRef(null);
    const [selectedWorkspaceSlug, setSelectedWorkspaceSlug] = useState(workspaces[0]?.slug ?? "");
    const [body, setBody] = useState("");
    const [audioData, setAudioData] = useState(null);
    const [isVoiceUsed, setIsVoiceUsed] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [supportFiles, setSupportFiles] = useState([]);
    const [supportFileInputKey, setSupportFileInputKey] = useState(0);
    const [savedUpdates, setSavedUpdates] = useState(initialUpdates);
    const [savedActivityEvents, setSavedActivityEvents] = useState(initialActivityEvents);
    const [analysis, setAnalysis] = useState(null);
    const [error, setError] = useState(null);
    const [statusMessage, setStatusMessage] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [memberFilter, setMemberFilter] = useState("all");
    const [actionStateFilter, setActionStateFilter] = useState("active");
    const [actionStatusSavingKey, setActionStatusSavingKey] = useState(null);
    const [isSubmitting, startSubmitting] = useTransition();
    const selectedWorkspace = useMemo(() => workspaces.find((workspace) => workspace.slug === selectedWorkspaceSlug) ?? workspaces[0], [selectedWorkspaceSlug, workspaces]);
    const filteredUpdates = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        return savedUpdates.filter((update) => {
            if (selectedWorkspace && update.workspaceSlug !== selectedWorkspace.slug) {
                return false;
            }
            if (memberFilter !== "all" && update.createdBy !== memberFilter) {
                return false;
            }
            if (!normalizedQuery) {
                return true;
            }
            return [update.body, update.structured.summary, update.createdByName, update.channel, ...update.structured.keyPoints, ...update.structured.actionItems]
                .join(" ")
                .toLowerCase()
                .includes(normalizedQuery);
        });
    }, [savedUpdates, searchQuery, memberFilter, selectedWorkspace]);
    const actionTracker = useMemo(() => filteredUpdates.flatMap((update) => update.structured.actionItems.map((action, index) => {
        const actionKey = `a${index}`;
        const state = update.actionItemStates?.[actionKey] ?? "active";
        return {
            id: `${update.id}-${actionKey}`,
            updateId: update.id,
            workspaceSlug: update.workspaceSlug,
            actionKey,
            action,
            state,
            channel: update.channel,
            createdByName: update.createdByName,
            createdAt: update.createdAt
        };
    })), [filteredUpdates]);
    const filteredActionTracker = useMemo(() => {
        if (actionStateFilter === "all") {
            return actionTracker;
        }
        return actionTracker.filter((item) => item.state === actionStateFilter);
    }, [actionTracker, actionStateFilter]);
    const filteredActivityEvents = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        return savedActivityEvents.filter((event) => {
            if (selectedWorkspace && event.workspaceSlug !== selectedWorkspace.slug) {
                return false;
            }
            if (memberFilter !== "all" && event.actorEmail !== memberFilter) {
                return false;
            }
            if (!normalizedQuery) {
                return true;
            }
            return [event.title, event.description, event.actor, event.actorEmail, event.statusMetadata?.channel, event.statusMetadata?.taskStatus]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(normalizedQuery);
        });
    }, [savedActivityEvents, searchQuery, memberFilter, selectedWorkspace]);
    const uniqueMembers = useMemo(() => [...new Set(savedActivityEvents
        .filter((event) => event.actorEmail)
        .map((event) => `${event.actorEmail}|||${event.actor}`))], [savedActivityEvents]);
    const handleSupportFilesChange = (files) => {
        setSupportFiles(Array.from(files ?? []));
    };
    const uploadSupportingFiles = async ({ workspaceSlug, files, manualNotes }) => {
        const uploaded = await Promise.all(files.map(async (file) => {
            const formData = new FormData();
            formData.append("workspaceSlug", workspaceSlug);
            formData.append("file", file);
            formData.append("manualNotes", manualNotes);
            const response = await fetch("/api/workspace-files", {
                method: "POST",
                body: formData
            });
            const result = await readResponsePayload(response);
            if (!response.ok) {
                throw new Error(result.error ?? `Could not upload ${file.name}`);
            }
            return result.file ?? result;
        }));
        return uploaded;
    };
    const handleExport = (format) => {
        const exportRows = filteredUpdates.map((update) => ({
            createdAt: new Date(update.createdAt).toISOString(),
            createdByName: update.createdByName,
            createdBy: update.createdBy,
            channel: update.channel,
            inputMethod: update.inputMethod,
            body: update.body,
            summary: update.structured.summary,
            actionItems: update.structured.actionItems.join(" | "),
            keyPoints: update.structured.keyPoints.join(" | ")
        }));
        const content = format === "json"
            ? JSON.stringify(exportRows, null, 2)
            : [
                ["createdAt", "createdByName", "createdBy", "channel", "inputMethod", "body", "summary", "actionItems", "keyPoints"].join(","),
                ...exportRows.map((row) => [row.createdAt, row.createdByName, row.createdBy, row.channel, row.inputMethod, row.body, row.summary, row.actionItems, row.keyPoints]
                    .map((value) => `"${String(value).replaceAll('"', '""')}"`)
                    .join(","))
            ].join("\n");
        const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `workspace-updates.${format}`;
        link.click();
        URL.revokeObjectURL(url);
    };
    const handleSubmit = () => {
        if (!selectedWorkspace) {
            return;
        }
        const trimmedBody = body.trim();
        const hasUpdateText = Boolean(trimmedBody);
        const hasSupportingFiles = supportFiles.length > 0;
        if (!hasUpdateText && !hasSupportingFiles) {
            return;
        }
        setError(null);
        setStatusMessage(null);
        startSubmitting(async () => {
            try {
                if (hasSupportingFiles) {
                    const supportNotes = hasUpdateText
                        ? `Supporting file uploaded with update context: ${trimmedBody.slice(0, 1000)}`
                        : "Supporting file uploaded from the Team Updates capture flow.";
                    await uploadSupportingFiles({
                        workspaceSlug: selectedWorkspace.slug,
                        files: supportFiles,
                        manualNotes: supportNotes
                    });
                }
                if (hasUpdateText) {
                    const analysisResponse = await fetch("/api/ai/structure-update", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            workspaceName: selectedWorkspace.name,
                            channel: DEFAULT_UPDATE_CHANNEL,
                            rawNote: trimmedBody
                        })
                    });
                    const analysisResult = await readResponsePayload(analysisResponse);
                    if (!analysisResponse.ok) {
                        throw new Error(analysisResult.error ?? "Could not structure update");
                    }
                    const nextAnalysis = {
                        workspaceSlug: selectedWorkspace.slug,
                        workspaceName: selectedWorkspace.name,
                        channel: DEFAULT_UPDATE_CHANNEL,
                        inputMethod: isVoiceUsed ? "voice" : "typed",
                        body: trimmedBody,
                        structured: analysisResult
                    };
                    setAnalysis(nextAnalysis);
                    const response = await fetch("/api/workspace-updates", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            ...nextAnalysis,
                            createdBy: currentUserEmail,
                            createdByName: currentUserName
                        })
                    });
                    const result = await readResponsePayload(response);
                    if (!response.ok) {
                        throw new Error(result.error ?? "Could not save update");
                    }
                    setSavedUpdates((current) => [result, ...current].slice(0, 8));
                    setSavedActivityEvents((current) => [{
                            id: `update-${result.id}`,
                            type: "update",
                            timestamp: result.createdAt,
                            actor: result.createdByName,
                            actorEmail: result.createdBy,
                            title: result.workspaceName,
                            description: result.structured.summary || result.body,
                            workspaceSlug: result.workspaceSlug,
                            statusMetadata: {
                                channel: result.channel,
                                inputMethod: result.inputMethod
                            },
                            update: result
                        }, ...current].slice(0, 80));
                }
                setBody("");
                setSupportFiles([]);
                setSupportFileInputKey((current) => current + 1);
                setStatusMessage(hasUpdateText && hasSupportingFiles
                    ? "Update submitted and supporting files uploaded."
                    : hasUpdateText
                        ? "Update submitted and saved to the workspace."
                        : "Supporting files uploaded to the workspace knowledge base.");
                setIsVoiceUsed(false);
            }
            catch (submitError) {
                setError(submitError instanceof Error ? submitError.message : "Could not submit update");
            }
        });
    };
    const handleActionStateChange = async ({ updateId, workspaceSlug, actionKey, state }) => {
        setError(null);
        const savingId = `${updateId}:${actionKey}`;
        setActionStatusSavingKey(savingId);
        const snapshot = savedUpdates;
        setSavedUpdates((current) => current.map((update) => update.id === updateId
            ? {
                ...update,
                actionItemStates: {
                    ...(update.actionItemStates ?? {}),
                    [actionKey]: state
                }
            }
            : update));
        try {
            const response = await fetch(`/api/workspace-updates/${updateId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    workspaceSlug,
                    actionKey,
                    state
                })
            });
            const result = await readResponsePayload(response);
            if (!response.ok) {
                throw new Error(result.error ?? "Could not update action item");
            }
            setSavedUpdates((current) => current.map((update) => update.id === result.id ? result : update));
            setStatusMessage(`Action item marked as ${ACTION_TRACKER_STATE_LABELS[state].toLowerCase()}.`);
        }
        catch (updateError) {
            setSavedUpdates(snapshot);
            setError(updateError instanceof Error ? updateError.message : "Could not update action item");
        }
        finally {
            setActionStatusSavingKey(null);
        }
    };
    return (<div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="glass-panel rounded-[2rem] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Team updates</p>
            <h2 className="mt-2 text-3xl font-semibold text-neutral">Capture an update</h2>
          </div>
          <div className={`badge badge-lg ${isAuthenticated ? "badge-success" : "badge-warning"}`}>
            {isAuthenticated ? "Available" : "Sign in to continue"}
          </div>
        </div>

        <p className="mt-3 max-w-xl text-sm leading-7 text-base-content/70">
          Members can type updates or speak them. The transcript is structured into a clean summary and then saved back into the same workspace knowledge base.
        </p>

        <div className="mt-6 grid gap-3">
          <label className="form-control">
            <div className="label">
              <span className="label-text">Workspace</span>
            </div>
            <select className="select select-bordered" value={selectedWorkspaceSlug} onChange={(event) => setSelectedWorkspaceSlug(event.target.value)} disabled={!isAuthenticated || workspaces.length === 0}>
              {workspaces.length === 0 ? <option>No workspaces yet</option> : null}
              {workspaces.map((workspace) => (<option key={workspace.slug} value={workspace.slug}>
                  {workspace.name}
                </option>))}
            </select>
          </label>

          <label className="form-control">
            <div className="label flex-wrap items-start">
              <div>
                <span className="label-text">Raw update</span>
              </div>
              <div className="flex items-center gap-3">
                <VoiceInputButton ref={voiceButtonRef} onTranscript={(text) => {
            setBody((current) => `${current}${current ? " " : ""}${text}`.trim());
            setIsVoiceUsed(true);
        }} onAudioData={setAudioData} onRecordingChange={setIsRecording}/>
                <span className="text-xs uppercase tracking-[0.2em] text-base-content/50">Mic input</span>
              </div>
            </div>
            <textarea className="textarea textarea-bordered h-40" value={body} onChange={(event) => setBody(event.target.value)} disabled={!isAuthenticated} placeholder="Example: Visited the site today. The team confirmed the revised schedule, shared the facade markups, and asked for the requirement checklist before Friday."/>
          </label>

          <label className="form-control">
            <div className="label">
              <span className="label-text">Supporting files (optional)</span>
            </div>
            <input key={supportFileInputKey} type="file" className="file-input file-input-bordered" multiple accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.doc,.docx,.txt,.csv,.xlsx" onChange={(event) => handleSupportFilesChange(event.target.files)} disabled={!isAuthenticated}/>
            <div className="mt-2 text-xs text-base-content/60">
              Allowed: images, PDF, DOC/DOCX, TXT, CSV, XLSX.
            </div>
            {supportFiles.length > 0 ? (<div className="mt-2 text-xs text-base-content/70">
                {supportFiles.length} file{supportFiles.length === 1 ? "" : "s"} selected: {supportFiles.map((file) => file.name).join(", ")}
              </div>) : null}
          </label>

          {isRecording ? (<div className="rounded-[1.25rem] border border-primary/20 bg-base-100 p-4">
              <div className="text-sm font-medium text-neutral">Recording live</div>
              <WaveformCanvas audioData={audioData} className="mt-3 h-20 w-full"/>
            </div>) : null}
        </div>

        {error ? (<div className="alert alert-error mt-4 text-sm">
            <span>{error}</span>
          </div>) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={!isAuthenticated || isSubmitting || !selectedWorkspace || (!body.trim() && supportFiles.length === 0)}>
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>
          <p className="text-sm leading-7 text-base-content/60">Submit an update, supporting files, or both. Uploaded files are saved into the same workspace knowledge base.</p>
        </div>
      </div>

      <div className="glass-panel rounded-[2rem] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Latest result</p>
            <h3 className="mt-2 text-3xl font-semibold text-neutral">What was saved to knowledge</h3>
          </div>
        </div>

        {statusMessage ? (<div className="alert alert-success mt-6 text-sm">
            <span>{statusMessage}</span>
          </div>) : null}

        {analysis ? (<div className="mt-6 space-y-4">
            <div className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Verbatim submitted update</div>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-base-content/75">{analysis.body}</p>
            </div>

            <div className="rounded-[1.5rem] bg-secondary/35 p-4 text-sm leading-7 text-secondary-content">
              {analysis.structured.summary}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Key points</div>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-base-content/75">
                  {analysis.structured.keyPoints.length > 0 ? (analysis.structured.keyPoints.map((item) => <li key={item}>{item}</li>)) : (<li>No key points extracted.</li>)}
                </ul>
              </div>

              <div className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Action items</div>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-base-content/75">
                  {analysis.structured.actionItems.length > 0 ? (analysis.structured.actionItems.map((item) => <li key={item}>{item}</li>)) : (<li>No actions extracted.</li>)}
                </ul>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Knowledge contribution</div>
              <p className="mt-3 text-sm leading-7 text-base-content/75">{analysis.structured.knowledgeContribution}</p>
            </div>
          </div>) : (<div className="mt-6 rounded-[1.5rem] border border-dashed border-base-300 bg-base-100 p-8 text-center text-sm leading-7 text-base-content/60">
            Submit an update to see the structured version that gets saved into the workspace knowledge base.
          </div>)}

        <div className="mt-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-kicker">Recent updates</p>
              <h3 className="mt-2 text-2xl font-semibold text-neutral">Team activity stream</h3>
            </div>
            <div className="badge badge-outline">{filteredActivityEvents.length} shown</div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <label className="form-control">
              <div className="label">
                <span className="label-text">Search activity</span>
              </div>
              <input className="input input-bordered" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by person, update text, task event, or status."/>
            </label>

            <label className="form-control">
              <div className="label">
                <span className="label-text">Member</span>
              </div>
              <select className="select select-bordered" value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)}>
                <option value="all">All members</option>
                {uniqueMembers.map((item) => {
            const [email, name] = item.split("|||");
            return (<option key={email} value={email}>
                      {name}
                    </option>);
        })}
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => handleExport("csv")} disabled={filteredUpdates.length === 0}>
              Export CSV
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => handleExport("json")} disabled={filteredUpdates.length === 0}>
              Export JSON
            </button>
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-base-300 bg-base-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-neutral">Action tracker</div>
                <div className="mt-1 text-sm text-base-content/60">Action signals extracted from the currently filtered updates.</div>
              </div>
              <div className="badge badge-outline">{filteredActionTracker.length} actions</div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <label className="form-control w-full md:max-w-xs">
                <div className="label py-1">
                  <span className="label-text">Action status</span>
                </div>
                <select className="select select-bordered select-sm" value={actionStateFilter} onChange={(event) => setActionStateFilter(event.target.value)}>
                  <option value="active">Active</option>
                  <option value="hidden">Hidden</option>
                  <option value="suppressed">Suppressed</option>
                  <option value="archived">Archived</option>
                  <option value="all">All statuses</option>
                </select>
              </label>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {filteredActionTracker.length > 0 ? (filteredActionTracker.map((item) => (<div key={item.id} className="rounded-xl bg-base-200/70 p-3">
                    <div className="font-medium text-neutral">{item.action}</div>
                    <div className="mt-3">
                      <label className="form-control">
                        <div className="label py-1">
                          <span className="label-text text-xs uppercase tracking-[0.16em] text-base-content/55">Status</span>
                        </div>
                        <select className="select select-bordered select-sm" value={item.state} onChange={(event) => {
            void handleActionStateChange({
                updateId: item.updateId,
                workspaceSlug: item.workspaceSlug,
                actionKey: item.actionKey,
                state: event.target.value
            });
        }} disabled={actionStatusSavingKey === `${item.updateId}:${item.actionKey}`}>
                          <option value="active">Active</option>
                          <option value="hidden">Hidden</option>
                          <option value="suppressed">Suppressed</option>
                          <option value="archived">Archived</option>
                        </select>
                      </label>
                    </div>
                    <div className="mt-2 text-sm text-base-content/65">
                      {item.createdByName} via {item.channel} | {new Date(item.createdAt).toLocaleDateString()}
                    </div>
                  </div>))) : (<div className="text-sm text-base-content/60 md:col-span-2">No action items in the current filtered view.</div>)}
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {filteredActivityEvents.length > 0 ? (filteredActivityEvents.map((event) => event.type === "update" && event.update ? (<div key={event.id} className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-neutral">{event.update.workspaceName}</div>
                        <div className="text-sm text-base-content/60">
                          {event.update.createdByName} via {event.update.channel} | {new Date(event.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <div className="badge badge-outline">{event.update.inputMethod}</div>
                    </div>
                    <div className="mt-3 rounded-xl bg-base-200/70 p-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-base-content/55">Verbatim update</div>
                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-base-content/75">{event.update.body}</p>
                    </div>
                    <div className="mt-3 rounded-xl bg-secondary/35 p-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-secondary-content/70">Summary</div>
                      <p className="mt-2 text-sm leading-6 text-secondary-content">{event.update.structured.summary}</p>
                    </div>
                  </div>) : (<div key={event.id} className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-neutral">{event.title}</div>
                        <div className="text-sm text-base-content/60">
                          {event.actor} | {new Date(event.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <div className="badge badge-info badge-outline">Task</div>
                    </div>
                    <div className="mt-3 rounded-xl bg-base-200/70 p-3">
                      <p className="text-sm leading-6 text-base-content/75">{event.description}</p>
                      {event.statusMetadata?.taskStatus ? (<div className="mt-2 text-xs uppercase tracking-[0.16em] text-base-content/55">Status: {event.statusMetadata.taskStatus.replaceAll("_", " ")}</div>) : null}
                    </div>
                  </div>))) : (<div className="rounded-[1.5rem] border border-dashed border-base-300 bg-base-100 p-8 text-center text-sm leading-7 text-base-content/60">
                No matching activity yet. Save the first member update or adjust your filters.
              </div>)}
          </div>
        </div>
      </div>
    </div>);
}


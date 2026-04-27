"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { AlertBanner } from "@/components/alert-banner";
import { readResponsePayload } from "@/lib/client-api";
import { trackDatafastGoal } from "@/lib/client-analytics";
import { getClipboardImageFile } from "@/lib/clipboard-images";
import { VoiceInputButton } from "@/components/voice-input-button";
import { WaveformCanvas } from "@/components/waveform-canvas";

const DEFAULT_UPDATE_CHANNEL = "Update";
const ACTION_TRACKER_STATE_LABELS = {
    active: "Shown",
    hidden: "Hidden",
    suppressed: "Muted",
    archived: "Done"
};

export function WorkspaceUpdateIntake({
    workspaces,
    initialUpdates,
    initialActivityEvents = [],
    isAuthenticated,
    currentUserName,
    currentUserEmail,
    canManageAiPrivacy = false
}) {
    const voiceButtonRef = useRef(null);
    const [selectedWorkspaceSlug] = useState(workspaces[0]?.slug ?? "");
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
    const [isCaptureDialogOpen, setIsCaptureDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [memberFilter, setMemberFilter] = useState("all");
    const [actionStateFilter, setActionStateFilter] = useState("active");
    const [actionStatusSavingKey, setActionStatusSavingKey] = useState(null);
    const [privacySavingUpdateId, setPrivacySavingUpdateId] = useState(null);
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
    const filteredUpdateEvents = useMemo(() => filteredActivityEvents.filter((event) => event.type === "update" && event.update), [filteredActivityEvents]);
    const filteredTaskEvents = useMemo(() => filteredActivityEvents.filter((event) => !(event.type === "update" && event.update)), [filteredActivityEvents]);
    const taskEventStatusSummary = useMemo(() => filteredTaskEvents.reduce((counts, event) => {
        const status = event.statusMetadata?.taskStatus;
        if (status === "in_progress") {
            counts.inProgress += 1;
        }
        else if (status === "done") {
            counts.done += 1;
        }
        else {
            counts.open += 1;
        }
        return counts;
    }, { open: 0, inProgress: 0, done: 0 }), [filteredTaskEvents]);
    const uniqueMembers = useMemo(() => [...new Set(savedActivityEvents
        .filter((event) => event.actorEmail)
        .map((event) => `${event.actorEmail}|||${event.actor}`))], [savedActivityEvents]);
    const handleSupportFilesChange = (files) => {
        setSupportFiles(Array.from(files ?? []));
    };
    const handlePasteSupportingScreenshot = (event) => {
        if (!isAuthenticated) {
            return;
        }
        const imageFile = getClipboardImageFile(event, { prefix: "update-screenshot" });
        if (!imageFile) {
            return;
        }
        event.preventDefault();
        setSupportFiles((current) => [...current, imageFile]);
        setError(null);
        setStatusMessage(`Screenshot pasted: ${imageFile.name}. It will upload as a file.`);
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
                        ? `File uploaded with update context: ${trimmedBody.slice(0, 1000)}`
                        : "File uploaded from the Team Updates capture flow.";
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
                    trackDatafastGoal("workspace_update_added", {
                        workspace_slug: selectedWorkspace.slug,
                        input_method: isVoiceUsed ? "voice" : "typed",
                        channel: DEFAULT_UPDATE_CHANNEL
                    });
                    if (savedUpdates.length === 0) {
                        trackDatafastGoal("first_update_added", {
                            workspace_slug: selectedWorkspace.slug,
                            input_method: isVoiceUsed ? "voice" : "typed"
                        });
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
                    ? "Update submitted and files uploaded."
                    : hasUpdateText
                        ? "Update submitted and saved to the workspace."
                        : "Files uploaded to the workspace knowledge base.");
                setIsVoiceUsed(false);
                setIsCaptureDialogOpen(false);
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
            setStatusMessage(`Follow-up marked as ${ACTION_TRACKER_STATE_LABELS[state].toLowerCase()}.`);
        }
        catch (updateError) {
            setSavedUpdates(snapshot);
            setError(updateError instanceof Error ? updateError.message : "Could not update action item");
        }
        finally {
            setActionStatusSavingKey(null);
        }
    };
    const handleUpdateAiPrivacyToggle = async (update, nextValue) => {
        if (!canManageAiPrivacy) {
            return;
        }
        setError(null);
        setPrivacySavingUpdateId(update.id);
        const previousUpdates = savedUpdates;
        const previousActivityEvents = savedActivityEvents;
        setSavedUpdates((current) => current.map((item) => item.id === update.id ? {
            ...item,
            aiPrivate: nextValue
        } : item));
        setSavedActivityEvents((current) => current.map((event) => event.update?.id === update.id
            ? {
                ...event,
                update: {
                    ...event.update,
                    aiPrivate: nextValue
                }
            }
            : event));
        try {
            const response = await fetch(`/api/workspace-updates/${update.id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    workspaceSlug: update.workspaceSlug,
                    aiPrivate: nextValue
                })
            });
            const result = await readResponsePayload(response);
            if (!response.ok) {
                throw new Error(result.error ?? "Could not update AI privacy");
            }
            setSavedUpdates((current) => current.map((item) => item.id === result.id ? result : item));
            setSavedActivityEvents((current) => current.map((event) => event.update?.id === result.id
                ? {
                    ...event,
                    update: result
                }
                : event));
            setStatusMessage(nextValue
                ? "This update is now excluded from AI context."
                : "This update is now available to AI again.");
        }
        catch (privacyError) {
            setSavedUpdates(previousUpdates);
            setSavedActivityEvents(previousActivityEvents);
            setError(privacyError instanceof Error ? privacyError.message : "Could not update AI privacy");
        }
        finally {
            setPrivacySavingUpdateId(null);
        }
    };
    return (<div className="space-y-5 sm:space-y-6">
      <div className="glass-panel rounded-[1.6rem] p-5 sm:rounded-[2rem] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="section-kicker">Team updates</p>
            <h2 className="mt-2 text-2xl font-semibold text-neutral sm:text-3xl">Updates</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-base-content/70">
              Capture typed notes, voice notes, screenshots, and files from this workspace in one clean flow.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:justify-end">
            <div className={`badge ${isAuthenticated ? "badge-success" : "badge-warning"}`}>
              {isAuthenticated ? "Available" : "Sign in to continue"}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setError(null);
                setStatusMessage(null);
                setIsCaptureDialogOpen(true);
              }}
              disabled={!isAuthenticated || !selectedWorkspace}
            >
              Capture update
            </button>
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-[1.6rem] p-5 sm:rounded-[2rem] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="section-kicker">Latest result</p>
            <h3 className="mt-2 text-2xl font-semibold leading-tight text-neutral sm:text-3xl">What was saved to knowledge</h3>
          </div>
        </div>

        {statusMessage ? <AlertBanner tone="success" className="mt-6">{statusMessage}</AlertBanner> : null}

        {analysis ? (<div className="mt-6 space-y-4">
            <div className="rounded-[1.5rem] bg-secondary/35 p-4 text-sm leading-7 text-secondary-content">
              {analysis.structured.summary}
            </div>

            <div className="collapse collapse-arrow rounded-[1.5rem] bg-transparent">
              <input type="checkbox"/>
              <div className="collapse-title text-xs uppercase tracking-[0.24em] text-primary/60">Verbatim submitted update</div>
              <div className="collapse-content pt-0">
                <p className="whitespace-pre-line text-sm leading-7 text-base-content/75">{analysis.body}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Key points</div>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-base-content/75">
                  {analysis.structured.keyPoints.length > 0 ? (analysis.structured.keyPoints.map((item) => <li key={item}>{item}</li>)) : (<li>No key points extracted.</li>)}
                </ul>
              </div>

              <div className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4">
                <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Suggested follow-ups (optional)</div>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-base-content/75">
                  {analysis.structured.actionItems.length > 0 ? (analysis.structured.actionItems.map((item) => <li key={item}>{item}</li>)) : (<li>No follow-ups suggested.</li>)}
                </ul>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4">
              <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Knowledge contribution</div>
              <p className="mt-3 text-sm leading-7 text-base-content/75">{analysis.structured.knowledgeContribution}</p>
            </div>
          </div>) : (<div className="mt-6 rounded-[1.5rem] border border-dashed border-base-300 bg-base-100 p-6 text-center text-sm leading-7 text-base-content/60 sm:p-8">
            Submit an update to see the structured version that gets saved into the workspace. This is the fastest way to turn raw field notes into a cleaner project signal.
          </div>)}

        <div className="mt-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="section-kicker">Recent updates</p>
              <h3 className="mt-2 text-2xl font-semibold leading-tight text-neutral">Team activity stream</h3>
            </div>
            <div className="badge badge-outline self-start sm:self-center">{filteredUpdateEvents.length} updates</div>
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

          <div className="collapse collapse-arrow mt-6 rounded-[1.5rem] border border-base-300 bg-base-100">
            <input type="checkbox"/>
            <div className="collapse-title pr-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-neutral">Suggested follow-ups</div>
                  <div className="mt-1 text-sm text-base-content/60">Optional next steps surfaced from the currently filtered updates.</div>
                </div>
                <div className="badge badge-outline mr-4 shrink-0">{filteredActionTracker.length} suggestions</div>
              </div>
            </div>

            <div className="collapse-content">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="form-control w-full md:max-w-xs">
                  <div className="label py-1">
                    <span className="label-text">Visibility</span>
                  </div>
                  <select className="select select-bordered select-sm" value={actionStateFilter} onChange={(event) => setActionStateFilter(event.target.value)}>
                    <option value="active">Shown</option>
                    <option value="hidden">Hidden</option>
                    <option value="suppressed">Muted</option>
                    <option value="archived">Done</option>
                    <option value="all">All</option>
                  </select>
                </label>
              </div>

              <div className="mt-3 grid items-stretch gap-3 md:grid-cols-2">
                {filteredActionTracker.length > 0 ? (filteredActionTracker.map((item) => (<div key={item.id} className="flex h-full flex-col rounded-xl bg-base-200/70 p-3">
                      <div className="font-medium text-neutral">{item.action}</div>
                      <div className="mt-auto pt-3">
                        <label className="form-control">
                          <div className="label py-1">
                            <span className="label-text text-xs uppercase tracking-[0.16em] text-base-content/55">Visibility</span>
                          </div>
                          <select className="select select-bordered select-sm" value={item.state} onChange={(event) => {
              void handleActionStateChange({
                  updateId: item.updateId,
                  workspaceSlug: item.workspaceSlug,
                  actionKey: item.actionKey,
                  state: event.target.value
              });
          }} disabled={actionStatusSavingKey === `${item.updateId}:${item.actionKey}`}>
                            <option value="active">Shown</option>
                            <option value="hidden">Hidden</option>
                            <option value="suppressed">Muted</option>
                            <option value="archived">Done</option>
                          </select>
                        </label>
                        <div className="mt-2 text-sm text-base-content/65">
                          {item.createdByName} via {item.channel} | {new Date(item.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>))) : (<div className="text-sm text-base-content/60 md:col-span-2">No follow-up suggestions in the current filtered view.</div>)}
              </div>
            </div>
          </div>

          <div className="collapse collapse-arrow mt-5 rounded-[1.5rem] border border-base-300 bg-base-100">
            <input type="checkbox"/>
            <div className="collapse-title pr-6">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-neutral">Task activity</div>
                  <div className="mt-1 text-sm text-base-content/60">Task-created and task-change events from the current filtered view.</div>
                </div>
                <div className="tooltip tooltip-left shrink-0" data-tip="Open / In progress / Done">
                  <div className="badge badge-outline mr-4 cursor-help">
                    {taskEventStatusSummary.open}/{taskEventStatusSummary.inProgress}/{taskEventStatusSummary.done}
                  </div>
                </div>
              </div>
            </div>

            <div className="collapse-content">
              <div className="space-y-4">
                {filteredTaskEvents.length > 0 ? (filteredTaskEvents.map((event) => (<div key={event.id} className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4">
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
                    </div>))) : (<div className="rounded-[1.25rem] border border-dashed border-base-300 p-5 text-sm text-base-content/60">
                    No task activity in the current filtered view.
                  </div>)}
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {filteredUpdateEvents.length > 0 ? (filteredUpdateEvents.map((event) => (<div key={event.id} className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-neutral">{event.update.workspaceName}</div>
                        <div className="text-sm text-base-content/60">
                          {event.update.createdByName} via {event.update.channel} | {new Date(event.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canManageAiPrivacy ? (<label className="label cursor-pointer gap-2 py-0">
                            <span className="label-text text-xs">Private from AI</span>
                            <input
                              type="checkbox"
                              className="toggle toggle-sm"
                              checked={Boolean(event.update.aiPrivate)}
                              onChange={(targetEvent) => {
                    void handleUpdateAiPrivacyToggle(event.update, targetEvent.target.checked);
                }}
                              disabled={privacySavingUpdateId === event.update.id}
                            />
                          </label>) : null}
                        <div className="badge badge-outline">{event.update.inputMethod}</div>
                      </div>
                    </div>
                    <div className="mt-3 rounded-xl bg-secondary/35 p-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-secondary-content/70">Summary</div>
                      <p className="mt-2 text-sm leading-6 text-secondary-content">{event.update.structured.summary}</p>
                    </div>
                    <div className="collapse collapse-arrow mt-3 rounded-xl bg-transparent">
                      <input type="checkbox"/>
                      <div className="collapse-title text-xs uppercase tracking-[0.18em] text-base-content/55">Verbatim update</div>
                      <div className="collapse-content pt-0">
                        <p className="whitespace-pre-line text-sm leading-6 text-base-content/75">{event.update.body}</p>
                      </div>
                    </div>
                  </div>))) : (<div className="rounded-[1.5rem] border border-dashed border-base-300 bg-base-100 p-8 text-center text-sm leading-7 text-base-content/60">
                No matching updates yet. Save the first update to build a chronological activity trail for this workspace.
              </div>)}
          </div>
        </div>
      </div>

      {isCaptureDialogOpen ? (
        <div className="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="capture-update-dialog-title">
          <div className="modal-box relative max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-4xl overflow-y-auto rounded-[1.5rem] bg-base-100 p-0 shadow-soft sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:rounded-[2rem]">
            <button
              type="button"
              className="btn btn-circle btn-ghost btn-sm absolute right-3 top-3 z-20 sm:right-4 sm:top-4"
              aria-label="Close capture update dialog"
              onClick={() => {
                setError(null);
                setIsCaptureDialogOpen(false);
              }}
            >
              X
            </button>

            <div className="border-b border-base-300 bg-base-100/90 px-5 py-5 pr-14 backdrop-blur-xl sm:px-6 sm:pr-16">
              <p className="section-kicker">Capture update</p>
              <h2 id="capture-update-dialog-title" className="mt-2 text-2xl font-semibold leading-tight text-neutral sm:text-3xl">
                Add a workspace update
              </h2>
              <p className="mt-3 text-sm leading-7 text-base-content/70">
                Use this when you are logging progress, site notes, team observations, WhatsApp screenshots, or anything that happened recently.
              </p>
            </div>

            <div className="grid gap-4 p-5 sm:p-6">
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
                <textarea className="textarea textarea-bordered h-36 sm:h-44" value={body} onChange={(event) => setBody(event.target.value)} onPaste={handlePasteSupportingScreenshot} disabled={!isAuthenticated} placeholder="Example: Visited the site today. The team confirmed the revised schedule, shared the facade markups, and asked for the requirement checklist before Friday."/>
              </label>

              <label className="form-control">
                <div className="label">
                  <span className="label-text">Files (optional)</span>
                </div>
                <input key={supportFileInputKey} type="file" className="file-input file-input-bordered" multiple accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.doc,.docx,.txt,.csv,.xlsx" onChange={(event) => handleSupportFilesChange(event.target.files)} disabled={!isAuthenticated}/>
                <div className="mt-2 text-xs text-base-content/60">
                  Allowed: images, PDF, DOC/DOCX, TXT, CSV, XLSX.
                </div>
                <div className="mt-1 text-xs text-base-content/60">
                  Tip: paste a screenshot with Ctrl+V while focused in Raw update.
                </div>
                {supportFiles.length > 0 ? (<div className="mt-2 text-xs text-base-content/70">
                    {supportFiles.length} file{supportFiles.length === 1 ? "" : "s"} selected: {supportFiles.map((file) => file.name).join(", ")}
                  </div>) : null}
              </label>

              {isRecording ? (<div className="rounded-[1.25rem] border border-primary/20 bg-base-100 p-4">
                  <div className="text-sm font-medium text-neutral">Recording live</div>
                  <WaveformCanvas audioData={audioData} className="mt-3 h-20 w-full"/>
                </div>) : null}

              {error ? <AlertBanner tone="error">{error}</AlertBanner> : null}

              <div className="flex flex-col gap-3 border-t border-base-300 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
                <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={!isAuthenticated || isSubmitting || !selectedWorkspace || (!body.trim() && supportFiles.length === 0)}>
                  {isSubmitting ? "Submitting..." : "Submit"}
                </button>
                <p className="text-sm leading-7 text-base-content/60">Submit an update, files, or both. Uploaded files are saved into the same workspace knowledge base.</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="modal-backdrop"
            aria-label="Close capture update dialog"
            onClick={() => {
              setError(null);
              setIsCaptureDialogOpen(false);
            }}
          >
            close
          </button>
        </div>
      ) : null}
    </div>);
}


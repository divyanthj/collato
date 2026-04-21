"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertBanner } from "@/components/alert-banner";
import { readResponsePayload } from "@/lib/client-api";
import { trackDatafastGoal } from "@/lib/client-analytics";
import { getClipboardImageFile } from "@/lib/clipboard-images";
import { VoiceInputButton } from "@/components/voice-input-button";
import { WaveformCanvas } from "@/components/waveform-canvas";

function compactText(value) {
    return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isPlaceholderKnowledgeText(value) {
    const normalized = compactText(value).toLowerCase();
    return (normalized === "a summary of everything done so far" ||
        normalized === "summary of everything done so far" ||
        normalized === "summary of everything done so far." ||
        normalized === "a summary of everything done so far.");
}
export function KnowledgeBaseManager({
    workspaces,
    initialFiles,
    knowledgeSummary,
    isAuthenticated,
    canManageAiPrivacy = false
}) {
    const router = useRouter();
    const voiceButtonRef = useRef(null);
    const [selectedWorkspaceSlug, setSelectedWorkspaceSlug] = useState(workspaces[0]?.slug ?? "");
    const [selectedFile, setSelectedFile] = useState(null);
    const [manualNotes, setManualNotes] = useState("");
    const [knowledgeBody, setKnowledgeBody] = useState("");
    const [audioData, setAudioData] = useState(null);
    const [isVoiceUsed, setIsVoiceUsed] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [savedFiles, setSavedFiles] = useState(initialFiles);
    const [searchQuery, setSearchQuery] = useState("");
    const [error, setError] = useState(null);
    const [isSaving, startSaving] = useTransition();
    const [isSummarizing, startSummarizing] = useTransition();
    const [fileInputKey, setFileInputKey] = useState(0);
    const [generatedSummary, setGeneratedSummary] = useState(knowledgeSummary ?? null);
    const [summaryMessage, setSummaryMessage] = useState(null);
    const [creatingTaskKey, setCreatingTaskKey] = useState(null);
    const [createdActionKeys, setCreatedActionKeys] = useState({});
    const [privacySavingFileId, setPrivacySavingFileId] = useState(null);
    const selectedWorkspace = useMemo(() => workspaces.find((workspace) => workspace.slug === selectedWorkspaceSlug) ?? workspaces[0], [selectedWorkspaceSlug, workspaces]);
    const filteredFiles = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        return savedFiles.filter((file) => {
            const matchesWorkspace = selectedWorkspace ? file.workspaceSlug === selectedWorkspace.slug : true;
            if (!matchesWorkspace) {
                return false;
            }
            if (!normalizedQuery) {
                return true;
            }
            return [file.fileName, file.fileType, file.knowledgeText, file.uploadedBy]
                .join(" ")
                .toLowerCase()
                .includes(normalizedQuery);
        });
    }, [savedFiles, searchQuery, selectedWorkspace]);
    const relevantFiles = useMemo(() => savedFiles.filter((file) => selectedWorkspace ? file.workspaceSlug === selectedWorkspace.slug : true), [savedFiles, selectedWorkspace]);
    const liveKnowledgeSummary = useMemo(() => {
        const indexedFiles = relevantFiles.filter((file) => !isPlaceholderKnowledgeText(file.extractedText || file.manualNotes || file.knowledgeText || ""));
        const knownPoints = indexedFiles
            .slice(0, 4)
            .map((file) => `${file.fileName}: ${file.extractionSummary || "Knowledge captured and ready for summarization."}`);
        return {
            overview: indexedFiles.length > 0
                ? `${indexedFiles.length} ${indexedFiles.length === 1 ? "file is" : "files are"} ready. The saved workspace brief will refresh automatically as new knowledge is added.`
                : knowledgeSummary?.overview ?? "No knowledge has been captured yet.",
            knownPoints,
            actionItems: indexedFiles.length > 0 ? ["Upload more context or updates to improve the saved workspace brief."] : [],
            fileCount: relevantFiles.length,
            updateCount: knowledgeSummary?.updateCount ?? 0,
            openTaskCount: knowledgeSummary?.openTaskCount ?? 0,
            inProgressTaskCount: knowledgeSummary?.inProgressTaskCount ?? 0,
            doneTaskCount: knowledgeSummary?.doneTaskCount ?? 0,
            pendingTaskHighlights: knowledgeSummary?.pendingTaskHighlights ?? []
        };
    }, [knowledgeSummary, relevantFiles]);
    const displayedSummary = generatedSummary ?? liveKnowledgeSummary;
    const handleExport = (format) => {
        const exportRows = filteredFiles.map((file) => ({
            fileName: file.fileName,
            fileType: file.fileType,
            uploadedBy: file.uploadedBy,
            createdAt: new Date(file.createdAt).toISOString(),
            knowledgeText: file.knowledgeText
        }));
        const content = format === "json"
            ? JSON.stringify(exportRows, null, 2)
            : [
                ["fileName", "fileType", "uploadedBy", "createdAt", "knowledgeText"].join(","),
                ...exportRows.map((row) => [row.fileName, row.fileType, row.uploadedBy, row.createdAt, row.knowledgeText]
                    .map((value) => `"${String(value).replaceAll('"', '""')}"`)
                    .join(","))
            ].join("\n");
        const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `workspace-knowledge.${format}`;
        link.click();
        URL.revokeObjectURL(url);
    };
    const handleFileChange = async (file) => {
        setSelectedFile(file);
    };
    const handlePasteScreenshot = (event) => {
        if (!isAuthenticated) {
            return;
        }
        const imageFile = getClipboardImageFile(event, { prefix: "knowledge-screenshot" });
        if (!imageFile) {
            return;
        }
        event.preventDefault();
        setSelectedFile(imageFile);
        setError(null);
        setSummaryMessage(`Screenshot pasted: ${imageFile.name}. Save to upload it to the knowledge base.`);
    };
    const saveKnowledgeNote = async () => {
        if (!selectedWorkspace || !knowledgeBody.trim()) {
            return null;
        }
        const response = await fetch("/api/workspace-knowledge-notes", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                workspaceSlug: selectedWorkspace.slug,
                body: knowledgeBody.trim(),
                inputMethod: isVoiceUsed ? "voice" : "typed"
            })
        });
        const result = await readResponsePayload(response);
        if (!response.ok) {
            throw new Error(result.error ?? "Could not save knowledge note");
        }
        return result;
    };
    const handleSave = () => {
        if (!selectedWorkspace || (!selectedFile && !knowledgeBody.trim())) {
            return;
        }
        setError(null);
        startSaving(async () => {
            try {
                const savedEntries = [];
                let latestSummary = null;
                if (selectedFile) {
                    const formData = new FormData();
                    formData.append("workspaceSlug", selectedWorkspace.slug);
                    formData.append("file", selectedFile);
                    formData.append("manualNotes", manualNotes);
                    const response = await fetch("/api/workspace-files", {
                        method: "POST",
                        body: formData
                    });
                    const result = await readResponsePayload(response);
                    if (!response.ok) {
                        throw new Error(result.error ?? "Could not save file");
                    }
                    if (result.file) {
                        savedEntries.push(result.file);
                        trackDatafastGoal("knowledge_file_added", {
                            workspace_slug: selectedWorkspace.slug,
                            file_type: result.file.fileType || selectedFile.type || "unknown",
                            input_method: "file_upload"
                        });
                    }
                    latestSummary = result.knowledgeSummary ?? latestSummary;
                }
                if (knowledgeBody.trim()) {
                    const noteResult = await saveKnowledgeNote();
                    if (noteResult?.file) {
                        savedEntries.push(noteResult.file);
                    }
                    latestSummary = noteResult?.knowledgeSummary ?? latestSummary;
                }
                if (savedEntries.length > 0) {
                    setSavedFiles((current) => [...savedEntries, ...current].slice(0, 8));
                }
                setSelectedFile(null);
                setManualNotes("");
                setKnowledgeBody("");
                setAudioData(null);
                setIsVoiceUsed(false);
                setFileInputKey((current) => current + 1);
                setGeneratedSummary(latestSummary ?? null);
                setSummaryMessage(latestSummary ? "Workspace brief refreshed from the latest knowledge capture." : null);
            }
            catch (saveError) {
                setError(saveError instanceof Error ? saveError.message : "Could not save knowledge");
            }
        });
    };
    const handleGenerateSummary = () => {
        if (!selectedWorkspace) {
            return;
        }
        setError(null);
        setSummaryMessage(null);
        startSummarizing(async () => {
            try {
                const response = await fetch("/api/ai/workspace-knowledge-summary", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        workspaceSlug: selectedWorkspace.slug
                    })
                });
                const result = await readResponsePayload(response);
                if (!response.ok) {
                    throw new Error(result.error ?? "Could not generate workspace summary");
                }
                setGeneratedSummary(result);
                setSummaryMessage(result.status === "insufficient_context"
                    ? "There is not enough extracted file content yet. Re-upload supported text files or add stronger notes."
                    : result.status === "partial_context"
                        ? "Summary generated from the material currently available, but file extraction is still limited."
                        : "Workspace summary generated from the uploaded knowledge.");
            }
            catch (summaryError) {
                setError(summaryError instanceof Error ? summaryError.message : "Could not generate workspace summary");
            }
        });
    };
    const handleCreateTaskFromFollowThrough = (actionText, actionKey) => {
        if (!selectedWorkspace || !actionText.trim() || !isAuthenticated) {
            return;
        }
        setError(null);
        setSummaryMessage(null);
        setCreatingTaskKey(actionKey);
        startSaving(async () => {
            try {
                const response = await fetch("/api/workspace-tasks", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        workspaceSlug: selectedWorkspace.slug,
                        title: actionText.trim(),
                        description: "Created from a suggested next step in Knowledge Hub."
                    })
                });
                const result = await readResponsePayload(response);
                if (!response.ok) {
                    throw new Error(result.error ?? "Could not create task");
                }
                setCreatedActionKeys((current) => ({
                    ...current,
                    [actionKey]: true
                }));
                setSummaryMessage("Task created from suggested next step.");
                router.refresh();
            }
            catch (taskError) {
                setError(taskError instanceof Error ? taskError.message : "Could not create task");
            }
            finally {
                setCreatingTaskKey(null);
            }
        });
    };
    const handleFileAiPrivacyToggle = (file, nextValue) => {
        if (!canManageAiPrivacy) {
            return;
        }
        setError(null);
        setPrivacySavingFileId(file.id);
        startSaving(async () => {
            try {
                const response = await fetch(`/api/workspace-files/${file.id}`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        workspaceSlug: file.workspaceSlug,
                        aiPrivate: nextValue
                    })
                });
                const result = await readResponsePayload(response);
                if (!response.ok) {
                    throw new Error(result.error ?? "Could not update AI privacy");
                }
                setSavedFiles((current) => current.map((item) => item.id === result.id ? result : item));
                setGeneratedSummary(null);
                setSummaryMessage(nextValue
                    ? "This item is now excluded from AI context."
                    : "This item is now available to AI again.");
                router.refresh();
            }
            catch (privacyError) {
                setError(privacyError instanceof Error ? privacyError.message : "Could not update AI privacy");
            }
            finally {
                setPrivacySavingFileId(null);
            }
        });
    };
    return (<div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="glass-panel rounded-[2rem] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Knowledge hub</p>
            <h2 className="mt-2 text-3xl font-semibold text-neutral">Add reference knowledge</h2>
          </div>
          <div className={`badge badge-lg ${isAuthenticated ? "badge-success" : "badge-warning"}`}>
            {isAuthenticated ? "Available" : "Sign in to continue"}
          </div>
        </div>

        <p className="mt-3 max-w-xl text-sm leading-7 text-base-content/70">
          Use this area for durable reference material your team will revisit. For day-by-day progress logs and check-ins, use Updates.
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

          <div className="collapse collapse-arrow rounded-[1.2rem] border border-base-300 bg-base-100">
            <input type="checkbox"/>
            <div className="collapse-title text-sm font-semibold text-neutral">
              Upload file (optional)
            </div>
            <div className="collapse-content space-y-3">
              <label className="form-control">
                <div className="label">
                  <span className="label-text">Choose file</span>
                </div>
                <input key={fileInputKey} type="file" className="file-input file-input-bordered" onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)} disabled={!isAuthenticated || workspaces.length === 0}/>
                {selectedFile ? (<div className="mt-2 text-xs text-base-content/70">
                    Selected file: {selectedFile.name}
                  </div>) : null}
                <div className="mt-2 text-xs text-base-content/60">
                  Tip: paste a screenshot with Ctrl+V to attach it directly.
                </div>
              </label>

              <label className="form-control">
                <div className="label">
                  <span className="label-text">Additional notes</span>
                </div>
                <textarea className="textarea textarea-bordered h-40" value={manualNotes} onChange={(event) => setManualNotes(event.target.value)} onPaste={handlePasteScreenshot} disabled={!isAuthenticated || workspaces.length === 0} placeholder="Optional: add context, what this file is for, or the key facts the team should remember."/>
              </label>
            </div>
          </div>

          <label className="form-control">
            <div className="label flex-wrap items-start">
              <div>
                <span className="label-text">Knowledge text (typed or voice)</span>
              </div>
              <div className="flex items-center gap-3">
                <VoiceInputButton ref={voiceButtonRef} onTranscript={(text) => {
            setKnowledgeBody((current) => `${current}${current ? " " : ""}${text}`.trim());
            setIsVoiceUsed(true);
        }} onAudioData={setAudioData} onRecordingChange={setIsRecording}/>
                <span className="text-xs uppercase tracking-[0.2em] text-base-content/50">Mic input</span>
              </div>
            </div>
            <textarea className="textarea textarea-bordered h-32" value={knowledgeBody} onChange={(event) => setKnowledgeBody(event.target.value)} onPaste={handlePasteScreenshot} disabled={!isAuthenticated || workspaces.length === 0} placeholder="Paste or dictate plain text knowledge. This will be saved as a searchable knowledge item in this workspace."/>
          </label>

          {isRecording ? (<div className="rounded-[1.25rem] border border-primary/20 bg-base-100 p-4">
              <div className="text-sm font-medium text-neutral">Recording live</div>
              <WaveformCanvas audioData={audioData} className="mt-3 h-20 w-full"/>
            </div>) : null}
        </div>

        {error ? <AlertBanner tone="error" className="mt-4">{error}</AlertBanner> : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={!isAuthenticated || isSaving || !selectedWorkspace || (!selectedFile && !knowledgeBody.trim())}>
            {isSaving ? "Saving..." : "Add to knowledge base"}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => handleExport("csv")} disabled={filteredFiles.length === 0}>
            Export CSV
          </button>
          <button type="button" className="btn btn-outline" onClick={() => handleExport("json")} disabled={filteredFiles.length === 0}>
            Export JSON
          </button>
          <p className="text-sm leading-7 text-base-content/60">Save a file, plain text, voice transcript, or any combination. All captured knowledge is searchable in this workspace.</p>
        </div>
      </div>

      <div className="glass-panel rounded-[2rem] p-6">
        <div className="rounded-[1.5rem] border border-primary/15 bg-primary/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="section-kicker">Workspace snapshot</p>
            <h3 className="mt-2 text-2xl font-semibold text-neutral">Current workspace snapshot</h3>
            </div>
            <div className="badge badge-outline">
              {liveKnowledgeSummary.fileCount} files / {liveKnowledgeSummary.updateCount} updates
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-outline btn-sm" onClick={handleGenerateSummary} disabled={!isAuthenticated || isSummarizing || !selectedWorkspace}>
              {isSummarizing ? "Generating summary..." : "Generate summary"}
            </button>
            <p className="text-sm leading-7 text-base-content/60">The workspace brief now refreshes automatically after uploads. Use this only when you want to refresh it manually.</p>
          </div>

          {summaryMessage ? (<div className="alert alert-info mt-4 text-sm">
              <span>{summaryMessage}</span>
            </div>) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-base-300 bg-base-100 px-4 py-3 text-sm">
              <div className="text-xs uppercase tracking-[0.18em] text-base-content/55">Open</div>
              <div className="mt-1 text-xl font-semibold text-neutral">{displayedSummary.openTaskCount ?? 0}</div>
            </div>
            <div className="rounded-2xl border border-base-300 bg-base-100 px-4 py-3 text-sm">
              <div className="text-xs uppercase tracking-[0.18em] text-base-content/55">In progress</div>
              <div className="mt-1 text-xl font-semibold text-neutral">{displayedSummary.inProgressTaskCount ?? 0}</div>
            </div>
            <div className="rounded-2xl border border-base-300 bg-base-100 px-4 py-3 text-sm">
              <div className="text-xs uppercase tracking-[0.18em] text-base-content/55">Done</div>
              <div className="mt-1 text-xl font-semibold text-neutral">{displayedSummary.doneTaskCount ?? 0}</div>
            </div>
          </div>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-base-content/78">
            {displayedSummary.overview}
          </p>

          {displayedSummary.knownPoints?.length ? (
            <div className="mt-5">
              <div className="text-xs uppercase tracking-[0.2em] text-primary/60">Known points</div>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-base-content/75 marker:text-primary/70">
                {displayedSummary.knownPoints.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {displayedSummary?.actionItems?.length ? (
            <div className="mt-5">
              <div className="text-xs uppercase tracking-[0.2em] text-primary/60">Suggested next steps (optional)</div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-base-content/75">
                {displayedSummary.actionItems.map((item, index) => {
            const actionKey = `${selectedWorkspace?.slug || "workspace"}-${index}-${item}`;
            const isCreated = Boolean(createdActionKeys[actionKey]);
            const isCreating = creatingTaskKey === actionKey;
            return (<li key={actionKey} className="rounded-2xl border border-base-300 bg-base-100/80 px-4 py-3">
                      <button type="button" className="tooltip w-full cursor-pointer text-left transition hover:text-primary disabled:cursor-not-allowed disabled:opacity-60" data-tip="Turn this into a task" title="Turn this into a task" onClick={() => handleCreateTaskFromFollowThrough(item, actionKey)} disabled={!isAuthenticated || isCreated || isCreating}>
                        {item}
                      </button>
                    </li>);
        })}
              </ul>
            </div>
          ) : null}

          {displayedSummary?.pendingTaskHighlights?.length ? (
            <div className="mt-5">
              <div className="text-xs uppercase tracking-[0.2em] text-primary/60">Pending task highlights</div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-base-content/75">
                {displayedSummary.pendingTaskHighlights.map((task) => (
                  <li key={task.id} className="rounded-2xl border border-base-300 bg-base-100/80 px-4 py-3">
                    <div className="font-medium text-neutral">{task.title}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.14em] text-base-content/60">
                      {task.status.replaceAll("_", " ")} | {task.assignee || "Unassigned"}
                      {task.dueDate ? ` | Due ${new Date(task.dueDate).toLocaleDateString()}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Recent files</p>
            <h3 className="mt-2 text-3xl font-semibold text-neutral">Recently added knowledge</h3>
          </div>
          <div className="badge badge-outline">{filteredFiles.length} shown</div>
        </div>

        <div className="mt-6">
          <label className="form-control">
            <div className="label">
              <span className="label-text">Search knowledge</span>
            </div>
            <input className="input input-bordered" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by file name, uploader, or text inside the knowledge base."/>
          </label>
        </div>

        <div className="mt-6 space-y-4">
          {filteredFiles.length > 0 ? (filteredFiles.map((file) => (<div key={file.id} className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-neutral">{file.fileName}</div>
                    <div className="text-sm text-base-content/60">
                      {file.workspaceName} | {file.fileType} | {file.sizeLabel}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {canManageAiPrivacy ? (<label className="label cursor-pointer gap-2 py-0">
                        <span className="label-text text-xs">Private from AI</span>
                        <input
                          type="checkbox"
                          className="toggle toggle-sm"
                          checked={Boolean(file.aiPrivate)}
                          onChange={(event) => handleFileAiPrivacyToggle(file, event.target.checked)}
                          disabled={privacySavingFileId === file.id}
                        />
                      </label>) : null}
                    {file.extractionStatus === "extracted" ? <div className="badge badge-success badge-outline">Text extracted</div> : null}
                    {file.extractionStatus === "ai_extracted" ? <div className="badge badge-info badge-outline">AI extracted</div> : null}
                    {file.extractionStatus === "unsupported" ? <div className="badge badge-warning badge-outline">Notes only</div> : null}
                    {file.extractionStatus === "legacy" ? <div className="badge badge-outline">Legacy</div> : null}
                    <div className="badge badge-outline">{new Date(file.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
                {file.extractionSummary ? <p className="mt-3 text-xs uppercase tracking-[0.18em] text-primary/60">{file.extractionSummary}</p> : null}
                {file.blobUrl ? <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                    <a className="link link-primary" href={`/api/workspace-files/${file.id}/download`} target="_blank" rel="noreferrer">
                      Open original file
                    </a>
                    <span className="text-base-content/55">
                      {file.blobAccess === "public" ? "Public blob" : "Private blob"}
                    </span>
                  </div> : null}
                <p className="mt-3 line-clamp-4 text-sm leading-6 text-base-content/75">{file.extractedText || file.manualNotes || file.knowledgeText || "No searchable text captured for this file yet."}</p>
              </div>))) : (<div className="rounded-[1.5rem] border border-dashed border-base-300 bg-base-100 p-8 text-center text-sm leading-7 text-base-content/60">
              No matching knowledge files yet. Add the first file or adjust your search.
            </div>)}
        </div>
      </div>
    </div>);
}


"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
    const [sharePointConnection, setSharePointConnection] = useState(null);
    const [sharePointError, setSharePointError] = useState(null);
    const [sharePointStatus, setSharePointStatus] = useState("");
    const [sharePointSites, setSharePointSites] = useState([]);
    const [sharePointDrives, setSharePointDrives] = useState([]);
    const [sharePointItems, setSharePointItems] = useState([]);
    const [selectedSharePointSite, setSelectedSharePointSite] = useState(null);
    const [selectedSharePointDrive, setSelectedSharePointDrive] = useState(null);
    const [sharePointFolderStack, setSharePointFolderStack] = useState([]);
    const [selectedSharePointItems, setSelectedSharePointItems] = useState({});
    const [isSharePointLoading, setIsSharePointLoading] = useState(false);
    const [isSharePointImporting, setIsSharePointImporting] = useState(false);
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
            return [file.fileName, file.fileType, file.knowledgeText, file.uploadedBy, file.externalProvider, file.externalAccountEmail, file.externalPath]
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
    const selectedSharePointCount = useMemo(() => Object.values(selectedSharePointItems).filter(Boolean).length, [selectedSharePointItems]);
    useEffect(() => {
        let isCurrent = true;
        setSharePointConnection(null);
        setSharePointError(null);
        setSharePointStatus("");
        setSharePointSites([]);
        setSharePointDrives([]);
        setSharePointItems([]);
        setSelectedSharePointSite(null);
        setSelectedSharePointDrive(null);
        setSharePointFolderStack([]);
        setSelectedSharePointItems({});
        if (!isAuthenticated || !selectedWorkspace) {
            return () => {
                isCurrent = false;
            };
        }
        const loadConnection = async () => {
            try {
                const response = await fetch(`/api/integrations/sharepoint/connection?workspaceSlug=${encodeURIComponent(selectedWorkspace.slug)}`);
                const result = await readResponsePayload(response);
                if (!isCurrent) {
                    return;
                }
                if (!response.ok) {
                    throw new Error(result.error ?? "Could not check SharePoint connection");
                }
                setSharePointConnection(result.connection ?? null);
            }
            catch (connectionError) {
                if (isCurrent) {
                    setSharePointError(connectionError instanceof Error ? connectionError.message : "Could not check SharePoint connection");
                }
            }
        };
        void loadConnection();
        return () => {
            isCurrent = false;
        };
    }, [isAuthenticated, selectedWorkspace]);
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
        trackDatafastGoal("knowledge_export_requested", { source: "knowledge_hub", format, item_count: exportRows.length });
        URL.revokeObjectURL(url);
    };
    const handleFileChange = async (file) => {
        setSelectedFile(file);
    };
    const handleConnectSharePoint = () => {
        if (!selectedWorkspace) {
            return;
        }
        trackDatafastGoal("integration_connect_started", { integration: "sharepoint", source: "knowledge_hub" });
        window.location.href = `/api/integrations/sharepoint/connect?workspaceSlug=${encodeURIComponent(selectedWorkspace.slug)}`;
    };
    const handleDisconnectSharePoint = async () => {
        if (!selectedWorkspace) {
            return;
        }
        setSharePointError(null);
        setSharePointStatus("");
        setIsSharePointLoading(true);
        try {
            const response = await fetch("/api/integrations/sharepoint/connection", {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    workspaceSlug: selectedWorkspace.slug
                })
            });
            const result = await readResponsePayload(response);
            if (!response.ok) {
                throw new Error(result.error ?? "Could not disconnect SharePoint");
            }
            setSharePointConnection(null);
            setSharePointSites([]);
            setSharePointDrives([]);
            setSharePointItems([]);
            setSelectedSharePointSite(null);
            setSelectedSharePointDrive(null);
            setSharePointFolderStack([]);
            setSelectedSharePointItems({});
            setSharePointStatus("SharePoint disconnected. Imported files remain available in this workspace.");
            trackDatafastGoal("integration_disconnected", { integration: "sharepoint" });
        }
        catch (disconnectError) {
            trackDatafastGoal("integration_action_failed", { integration: "sharepoint", stage: "disconnect" });
            setSharePointError(disconnectError instanceof Error ? disconnectError.message : "Could not disconnect SharePoint");
        }
        finally {
            setIsSharePointLoading(false);
        }
    };
    const loadSharePointSites = async () => {
        if (!selectedWorkspace) {
            return;
        }
        setSharePointError(null);
        setSharePointStatus("");
        setIsSharePointLoading(true);
        try {
            const response = await fetch(`/api/integrations/sharepoint/sites?workspaceSlug=${encodeURIComponent(selectedWorkspace.slug)}`);
            const result = await readResponsePayload(response);
            if (!response.ok) {
                throw new Error(result.error ?? "Could not load SharePoint sites");
            }
            setSharePointSites(result.sites ?? []);
            setSharePointStatus((result.sites ?? []).length > 0 ? "Choose a site to browse libraries." : "No SharePoint sites were returned for this Microsoft account.");
        }
        catch (sitesError) {
            setSharePointError(sitesError instanceof Error ? sitesError.message : "Could not load SharePoint sites");
        }
        finally {
            setIsSharePointLoading(false);
        }
    };
    const loadSharePointDrives = async (site) => {
        if (!selectedWorkspace || !site) {
            return;
        }
        setSharePointError(null);
        setSharePointStatus("");
        setIsSharePointLoading(true);
        setSelectedSharePointSite(site);
        setSelectedSharePointDrive(null);
        setSharePointItems([]);
        setSharePointFolderStack([]);
        setSelectedSharePointItems({});
        try {
            const response = await fetch(`/api/integrations/sharepoint/drives?workspaceSlug=${encodeURIComponent(selectedWorkspace.slug)}&siteId=${encodeURIComponent(site.id)}`);
            const result = await readResponsePayload(response);
            if (!response.ok) {
                throw new Error(result.error ?? "Could not load SharePoint libraries");
            }
            setSharePointDrives(result.drives ?? []);
            setSharePointStatus((result.drives ?? []).length > 0 ? "Choose a document library." : "No document libraries were returned for this site.");
        }
        catch (drivesError) {
            setSharePointError(drivesError instanceof Error ? drivesError.message : "Could not load SharePoint libraries");
        }
        finally {
            setIsSharePointLoading(false);
        }
    };
    const loadSharePointItems = async ({ drive, itemId = "", nextStack = [] }) => {
        if (!selectedWorkspace || !drive) {
            return;
        }
        setSharePointError(null);
        setSharePointStatus("");
        setIsSharePointLoading(true);
        setSelectedSharePointDrive(drive);
        setSharePointFolderStack(nextStack);
        setSelectedSharePointItems({});
        try {
            const params = new URLSearchParams({
                workspaceSlug: selectedWorkspace.slug,
                driveId: drive.id
            });
            if (itemId) {
                params.set("itemId", itemId);
            }
            const response = await fetch(`/api/integrations/sharepoint/items?${params.toString()}`);
            const result = await readResponsePayload(response);
            if (!response.ok) {
                throw new Error(result.error ?? "Could not load SharePoint files");
            }
            setSharePointItems(result.items ?? []);
            setSharePointStatus((result.items ?? []).length > 0 ? "Select files to import into this workspace." : "This folder is empty.");
        }
        catch (itemsError) {
            setSharePointError(itemsError instanceof Error ? itemsError.message : "Could not load SharePoint files");
        }
        finally {
            setIsSharePointLoading(false);
        }
    };
    const handleImportSharePointItems = async () => {
        if (!selectedWorkspace || !selectedSharePointDrive) {
            return;
        }
        const itemsToImport = Object.values(selectedSharePointItems).filter(Boolean);
        if (itemsToImport.length === 0) {
            return;
        }
        setSharePointError(null);
        setSharePointStatus("");
        setIsSharePointImporting(true);
        try {
            const response = await fetch("/api/integrations/sharepoint/import", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    workspaceSlug: selectedWorkspace.slug,
                    siteId: selectedSharePointSite?.id ?? "",
                    siteName: selectedSharePointSite?.displayName ?? selectedSharePointSite?.name ?? "",
                    driveId: selectedSharePointDrive.id,
                    driveName: selectedSharePointDrive.name,
                    items: itemsToImport.map((item) => ({
                        id: item.id,
                        name: item.name
                    }))
                })
            });
            const result = await readResponsePayload(response);
            if (!response.ok && !result.imported?.length) {
                throw new Error(result.error ?? "Could not import SharePoint files");
            }
            if (result.imported?.length) {
                setSavedFiles((current) => [...result.imported, ...current].slice(0, 8));
                setGeneratedSummary(result.knowledgeSummary ?? null);
                trackDatafastGoal("knowledge_file_added", {
                    item_count: result.imported.length,
                    file_type: "sharepoint",
                    input_method: "sharepoint_import"
                });
            }
            trackDatafastGoal("integration_import_completed", { integration: "sharepoint", item_count: result.imported?.length ?? 0, failed_count: result.failed?.length ?? 0 });
            setSelectedSharePointItems({});
            setSharePointStatus(`${result.imported?.length ?? 0} SharePoint file${result.imported?.length === 1 ? "" : "s"} imported.${result.failed?.length ? ` ${result.failed.length} failed.` : ""}`);
        }
        catch (importError) {
            trackDatafastGoal("integration_action_failed", { integration: "sharepoint", stage: "import" });
            setSharePointError(importError instanceof Error ? importError.message : "Could not import SharePoint files");
        }
        finally {
            setIsSharePointImporting(false);
        }
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
                        if (relevantFiles.length === 0 && !knowledgeBody.trim()) {
                            trackDatafastGoal("first_knowledge_item_added", {
                                workspace_slug: selectedWorkspace.slug,
                                source: "file_upload"
                            });
                        }
                    }
                    latestSummary = result.knowledgeSummary ?? latestSummary;
                }
                if (knowledgeBody.trim()) {
                    const noteResult = await saveKnowledgeNote();
                    if (noteResult?.file) {
                        savedEntries.push(noteResult.file);
                        trackDatafastGoal("knowledge_note_added", { source: "knowledge_hub", input_method: isVoiceUsed ? "voice" : "typed" });
                    }
                    if (noteResult?.file && relevantFiles.length === 0) {
                        trackDatafastGoal("first_knowledge_item_added", {
                            workspace_slug: selectedWorkspace.slug,
                            source: isVoiceUsed ? "voice_note" : "typed_note"
                        });
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
                trackDatafastGoal("knowledge_capture_failed", { source: "knowledge_hub", stage: "save" });
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
                trackDatafastGoal("knowledge_summary_result", { source: "knowledge_hub", status: result.status || "ready" });
                setSummaryMessage(result.status === "insufficient_context"
                    ? "There is not enough extracted file content yet. Re-upload supported text files or add stronger notes."
                    : result.status === "partial_context"
                        ? "Summary generated from the material currently available, but file extraction is still limited."
                        : "Workspace summary generated from the uploaded knowledge.");
            }
            catch (summaryError) {
                trackDatafastGoal("knowledge_summary_failed", { source: "knowledge_hub", stage: "summary" });
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
                trackDatafastGoal("task_created", { source: "knowledge_suggestion" });
                router.refresh();
            }
            catch (taskError) {
                trackDatafastGoal("task_action_failed", { source: "knowledge_suggestion", action: "create" });
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
                trackDatafastGoal("ai_privacy_changed", { scope: "file", ai_private: nextValue ? "yes" : "no" });
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
        <div className="mt-4 rounded-[1.25rem] border border-base-300 bg-base-100 p-4 text-sm leading-6 text-base-content/68">
          <span className="font-medium text-neutral">Use this when:</span> you are saving documents, screenshots, notes, transcripts, or facts that should remain searchable and reusable later.
        </div>

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

          <div className="collapse collapse-arrow rounded-[1.2rem] border border-base-300 bg-base-100">
            <input type="checkbox"/>
            <div className="collapse-title text-sm font-semibold text-neutral">
              Import from SharePoint
            </div>
            <div className="collapse-content space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-base-300 bg-base-200/50 p-4">
                <div>
                  <div className="text-sm font-semibold text-neutral">
                    {sharePointConnection ? "SharePoint connected" : "SharePoint not connected"}
                  </div>
                  <div className="mt-1 text-sm text-base-content/60">
                    {sharePointConnection
            ? `Connected as ${sharePointConnection.microsoftDisplayName || sharePointConnection.microsoftAccountEmail || "Microsoft account"}`
            : "Connect Microsoft to browse SharePoint files without changing your Collato sign-in."}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {sharePointConnection ? (<button type="button" className="btn btn-outline btn-sm" onClick={handleDisconnectSharePoint} disabled={isSharePointLoading || isSharePointImporting}>
                      Disconnect
                    </button>) : null}
                  <button type="button" className="btn btn-primary btn-sm" onClick={sharePointConnection ? loadSharePointSites : handleConnectSharePoint} disabled={!isAuthenticated || !selectedWorkspace || isSharePointLoading || isSharePointImporting}>
                    {sharePointConnection ? "Browse SharePoint" : "Connect SharePoint"}
                  </button>
                </div>
              </div>

              {sharePointError ? <AlertBanner tone="error">{sharePointError}</AlertBanner> : null}
              {sharePointStatus ? (<div className="alert alert-info text-sm">
                  <span>{sharePointStatus}</span>
                </div>) : null}

              {sharePointSites.length > 0 ? (<div>
                  <div className="text-xs uppercase tracking-[0.18em] text-base-content/55">Sites</div>
                  <div className="mt-2 grid gap-2">
                    {sharePointSites.map((site) => (<button key={site.id} type="button" className={`btn justify-start text-left ${selectedSharePointSite?.id === site.id ? "btn-primary" : "btn-outline"}`} onClick={() => loadSharePointDrives(site)} disabled={isSharePointLoading || isSharePointImporting}>
                        {site.displayName || site.name}
                      </button>))}
                  </div>
                </div>) : null}

              {sharePointDrives.length > 0 ? (<div>
                  <div className="text-xs uppercase tracking-[0.18em] text-base-content/55">Libraries</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {sharePointDrives.map((drive) => (<button key={drive.id} type="button" className={`btn justify-start text-left ${selectedSharePointDrive?.id === drive.id ? "btn-secondary" : "btn-outline"}`} onClick={() => loadSharePointItems({ drive })} disabled={isSharePointLoading || isSharePointImporting}>
                        {drive.name}
                      </button>))}
                  </div>
                </div>) : null}

              {selectedSharePointDrive ? (<div className="rounded-2xl border border-base-300 bg-base-100 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-base-content/55">Files</div>
                      <div className="mt-1 text-sm font-medium text-neutral">{selectedSharePointDrive.name}</div>
                    </div>
                    <button type="button" className="btn btn-primary btn-sm" onClick={handleImportSharePointItems} disabled={selectedSharePointCount === 0 || isSharePointImporting || isSharePointLoading}>
                      {isSharePointImporting ? "Importing..." : `Import selected (${selectedSharePointCount})`}
                    </button>
                  </div>

                  {sharePointFolderStack.length > 0 ? (<div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                      <button type="button" className="link link-primary" onClick={() => loadSharePointItems({ drive: selectedSharePointDrive })} disabled={isSharePointLoading || isSharePointImporting}>
                        Root
                      </button>
                      {sharePointFolderStack.map((folder, index) => (<button key={folder.id} type="button" className="link link-primary" onClick={() => loadSharePointItems({
                drive: selectedSharePointDrive,
                itemId: folder.id,
                nextStack: sharePointFolderStack.slice(0, index + 1)
            })} disabled={isSharePointLoading || isSharePointImporting}>
                          / {folder.name}
                        </button>))}
                    </div>) : null}

                  <div className="mt-4 space-y-2">
                    {sharePointItems.map((item) => (<div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-base-300 px-4 py-3 text-sm">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-neutral">{item.name}</div>
                          <div className="text-xs text-base-content/55">
                            {item.folder ? "Folder" : item.mimeType || "File"}{item.size ? ` | ${item.size} B` : ""}
                          </div>
                        </div>
                        {item.folder ? (<button type="button" className="btn btn-outline btn-xs" onClick={() => loadSharePointItems({
                    drive: selectedSharePointDrive,
                    itemId: item.id,
                    nextStack: [...sharePointFolderStack, { id: item.id, name: item.name }]
                })} disabled={isSharePointLoading || isSharePointImporting}>
                            Open
                          </button>) : (<label className="label cursor-pointer gap-2 py-0">
                            <span className="label-text text-xs">Import</span>
                            <input type="checkbox" className="checkbox checkbox-sm" checked={Boolean(selectedSharePointItems[item.id])} onChange={(event) => setSelectedSharePointItems((current) => ({
                    ...current,
                    [item.id]: event.target.checked ? item : null
                }))} disabled={isSharePointImporting || isSharePointLoading}/>
                          </label>)}
                      </div>))}
                    {selectedSharePointDrive && sharePointItems.length === 0 ? (<div className="rounded-2xl border border-dashed border-base-300 p-5 text-center text-sm text-base-content/60">
                        {isSharePointLoading ? "Loading SharePoint files..." : "No files shown yet."}
                      </div>) : null}
                  </div>
                </div>) : null}
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
                    {file.externalProvider === "sharepoint" ? <div className="badge badge-info badge-outline">SharePoint</div> : null}
                    <div className="badge badge-outline">{new Date(file.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
                {file.extractionSummary ? <p className="mt-3 text-xs uppercase tracking-[0.18em] text-primary/60">{file.extractionSummary}</p> : null}
                {file.blobUrl ? <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                    <a className="link link-primary" href={`/api/workspace-files/${file.id}/download`} onClick={() => trackDatafastGoal("knowledge_file_download_requested", { source: "knowledge_hub", file_type: file.fileType })} target="_blank" rel="noreferrer">
                      Open original file
                    </a>
                    <span className="text-base-content/55">
                      {file.blobAccess === "public" ? "Public blob" : "Private blob"}
                    </span>
                    {file.externalWebUrl ? (<a className="link link-primary" href={file.externalWebUrl} target="_blank" rel="noreferrer">
                        Open in SharePoint
                      </a>) : null}
                  </div> : null}
                <p className="mt-3 line-clamp-4 text-sm leading-6 text-base-content/75">{file.extractedText || file.manualNotes || file.knowledgeText || "No searchable text captured for this file yet."}</p>
              </div>))) : (<div className="rounded-[1.5rem] border border-dashed border-base-300 bg-base-100 p-8 text-center text-sm leading-7 text-base-content/60">
              No matching knowledge files yet. Start by adding one file or note so the workspace has reusable context.
            </div>)}
        </div>
      </div>
    </div>);
}


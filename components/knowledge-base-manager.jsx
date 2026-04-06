"use client";
import { useMemo, useState, useTransition } from "react";
function formatBytes(size) {
    if (!size || Number.isNaN(size)) {
        return "Unknown size";
    }
    if (size < 1024) {
        return `${size} B`;
    }
    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
function looksTextBased(file) {
    return (file.type.startsWith("text/") ||
        ["application/json", "application/xml"].includes(file.type) ||
        /\.(txt|md|csv|json|xml)$/i.test(file.name));
}
export function KnowledgeBaseManager({ workspaces, initialFiles, isAuthenticated, currentUserEmail }) {
    const [selectedWorkspaceSlug, setSelectedWorkspaceSlug] = useState(workspaces[0]?.slug ?? "");
    const [selectedFile, setSelectedFile] = useState(null);
    const [knowledgeText, setKnowledgeText] = useState("");
    const [savedFiles, setSavedFiles] = useState(initialFiles);
    const [searchQuery, setSearchQuery] = useState("");
    const [error, setError] = useState(null);
    const [isSaving, startSaving] = useTransition();
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
        if (!file) {
            return;
        }
        if (looksTextBased(file)) {
            try {
                const text = await file.text();
                setKnowledgeText(text.slice(0, 12000));
            }
            catch (fileError) {
                console.error(fileError);
            }
        }
    };
    const handleSave = () => {
        if (!selectedWorkspace || !selectedFile) {
            return;
        }
        setError(null);
        startSaving(async () => {
            try {
                const response = await fetch("/api/dashboard-files", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        workspaceSlug: selectedWorkspace.slug,
                        workspaceName: selectedWorkspace.name,
                        fileName: selectedFile.name,
                        fileType: selectedFile.type || "Unknown",
                        sizeLabel: formatBytes(selectedFile.size),
                        knowledgeText,
                        uploadedBy: currentUserEmail
                    })
                });
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error ?? "Could not save file");
                }
                setSavedFiles((current) => [result, ...current].slice(0, 8));
                setSelectedFile(null);
                setKnowledgeText("");
            }
            catch (saveError) {
                setError(saveError instanceof Error ? saveError.message : "Could not save file");
            }
        });
    };
    return (<div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="glass-panel rounded-[2rem] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Knowledge base</p>
            <h2 className="mt-2 text-3xl font-semibold text-neutral">Add files to a workspace</h2>
          </div>
          <div className={`badge badge-lg ${isAuthenticated ? "badge-success" : "badge-warning"}`}>
            {isAuthenticated ? "Available" : "Sign in to continue"}
          </div>
        </div>

        <p className="mt-3 max-w-xl text-sm leading-7 text-base-content/70">
          Store the file details together with the text or notes you want the assistant to search. For text-based files, the content is filled in automatically when possible.
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
            <div className="label">
              <span className="label-text">Choose file</span>
            </div>
            <input type="file" className="file-input file-input-bordered" onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)} disabled={!isAuthenticated || workspaces.length === 0}/>
          </label>

          <label className="form-control">
            <div className="label">
              <span className="label-text">Indexed text or notes</span>
            </div>
            <textarea className="textarea textarea-bordered h-40" value={knowledgeText} onChange={(event) => setKnowledgeText(event.target.value)} disabled={!isAuthenticated || workspaces.length === 0} placeholder="Paste extracted text, requirements, decisions, or a short summary of what is inside the file."/>
          </label>
        </div>

        {error ? (<div className="alert alert-error mt-4 text-sm">
            <span>{error}</span>
          </div>) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={!isAuthenticated || isSaving || !selectedWorkspace || !selectedFile || !knowledgeText.trim()}>
            {isSaving ? "Saving..." : "Add to knowledge base"}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => handleExport("csv")} disabled={filteredFiles.length === 0}>
            Export CSV
          </button>
          <button type="button" className="btn btn-outline" onClick={() => handleExport("json")} disabled={filteredFiles.length === 0}>
            Export JSON
          </button>
          <p className="text-sm leading-7 text-base-content/60">Every saved file becomes queryable context for the workspace chatbot.</p>
        </div>
      </div>

      <div className="glass-panel rounded-[2rem] p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Recent files</p>
            <h3 className="mt-2 text-3xl font-semibold text-neutral">Latest indexed knowledge</h3>
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
                  <div className="badge badge-outline">{new Date(file.createdAt).toLocaleDateString()}</div>
                </div>
                <p className="mt-3 line-clamp-4 text-sm leading-6 text-base-content/75">{file.knowledgeText}</p>
              </div>))) : (<div className="rounded-[1.5rem] border border-dashed border-base-300 bg-base-100 p-8 text-center text-sm leading-7 text-base-content/60">
              No matching knowledge files yet. Add the first file or adjust your search.
            </div>)}
        </div>
      </div>
    </div>);
}


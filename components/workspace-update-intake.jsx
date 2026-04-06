"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { VoiceInputButton } from "@/components/voice-input-button";
import { WaveformCanvas } from "@/components/waveform-canvas";
export function WorkspaceUpdateIntake({ workspaces, initialUpdates, isAuthenticated, currentUserName, currentUserEmail }) {
    const voiceButtonRef = useRef(null);
    const [selectedWorkspaceSlug, setSelectedWorkspaceSlug] = useState(workspaces[0]?.slug ?? "");
    const [channel, setChannel] = useState("Field update");
    const [body, setBody] = useState("");
    const [audioData, setAudioData] = useState(null);
    const [isVoiceUsed, setIsVoiceUsed] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [savedUpdates, setSavedUpdates] = useState(initialUpdates);
    const [analysis, setAnalysis] = useState(null);
    const [error, setError] = useState(null);
    const [statusMessage, setStatusMessage] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [channelFilter, setChannelFilter] = useState("all");
    const [memberFilter, setMemberFilter] = useState("all");
    const [inputMethodFilter, setInputMethodFilter] = useState("all");
    const [isSubmitting, startSubmitting] = useTransition();
    const selectedWorkspace = useMemo(() => workspaces.find((workspace) => workspace.slug === selectedWorkspaceSlug) ?? workspaces[0], [selectedWorkspaceSlug, workspaces]);
    const filteredUpdates = useMemo(() => {
        const normalizedQuery = searchQuery.trim().toLowerCase();
        return savedUpdates.filter((update) => {
            if (selectedWorkspace && update.workspaceSlug !== selectedWorkspace.slug) {
                return false;
            }
            if (channelFilter !== "all" && update.channel !== channelFilter) {
                return false;
            }
            if (memberFilter !== "all" && update.createdBy !== memberFilter) {
                return false;
            }
            if (inputMethodFilter !== "all" && update.inputMethod !== inputMethodFilter) {
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
    }, [savedUpdates, searchQuery, channelFilter, memberFilter, inputMethodFilter, selectedWorkspace]);
    const actionTracker = useMemo(() => filteredUpdates.flatMap((update) => update.structured.actionItems.map((action) => ({
        id: `${update.id}-${action}`,
        action,
        channel: update.channel,
        createdByName: update.createdByName,
        createdAt: update.createdAt
    }))), [filteredUpdates]);
    const uniqueChannels = useMemo(() => [...new Set(savedUpdates.map((update) => update.channel))], [savedUpdates]);
    const uniqueMembers = useMemo(() => [...new Set(savedUpdates.map((update) => ({ email: update.createdBy, name: update.createdByName })).map((item) => `${item.email}|||${item.name}`))], [savedUpdates]);
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
        setError(null);
        setStatusMessage(null);
        startSubmitting(async () => {
            try {
                const analysisResponse = await fetch("/api/ai/structure-update", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        workspaceName: selectedWorkspace.name,
                        channel,
                        rawNote: body
                    })
                });
                const analysisResult = await analysisResponse.json();
                if (!analysisResponse.ok) {
                    throw new Error(analysisResult.error ?? "Could not structure update");
                }
                const nextAnalysis = {
                    workspaceSlug: selectedWorkspace.slug,
                    workspaceName: selectedWorkspace.name,
                    channel,
                    inputMethod: isVoiceUsed ? "voice" : "typed",
                    body,
                    structured: analysisResult
                };
                setAnalysis(nextAnalysis);
                const response = await fetch("/api/dashboard-updates", {
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
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error ?? "Could not save update");
                }
                setSavedUpdates((current) => [result, ...current].slice(0, 8));
                setBody("");
                setStatusMessage("Update submitted and saved to the workspace.");
                setIsVoiceUsed(false);
            }
            catch (submitError) {
                setError(submitError instanceof Error ? submitError.message : "Could not submit update");
            }
        });
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
          <div className="grid gap-3 sm:grid-cols-2">
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
                <span className="label-text">Channel</span>
              </div>
              <select className="select select-bordered" value={channel} onChange={(event) => setChannel(event.target.value)} disabled={!isAuthenticated}>
                <option>Field update</option>
                <option>Call summary</option>
                <option>Site visit</option>
                <option>Client follow-up</option>
                <option>Team coordination</option>
              </select>
            </label>
          </div>

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

          {isRecording ? (<div className="rounded-[1.25rem] border border-primary/20 bg-base-100 p-4">
              <div className="text-sm font-medium text-neutral">Recording live</div>
              <WaveformCanvas audioData={audioData} className="mt-3 h-20 w-full"/>
            </div>) : null}
        </div>

        {error ? (<div className="alert alert-error mt-4 text-sm">
            <span>{error}</span>
          </div>) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={!isAuthenticated || isSubmitting || !selectedWorkspace || !body.trim()}>
            {isSubmitting ? "Submitting..." : "Submit update"}
          </button>
          <p className="text-sm leading-7 text-base-content/60">Your update will be organized automatically and added to the workspace timeline.</p>
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
            <div className="badge badge-outline">{filteredUpdates.length} shown</div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="form-control">
              <div className="label">
                <span className="label-text">Search updates</span>
              </div>
              <input className="input input-bordered" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search by person, summary, raw text, or actions."/>
            </label>

            <label className="form-control">
              <div className="label">
                <span className="label-text">Channel</span>
              </div>
              <select className="select select-bordered" value={channelFilter} onChange={(event) => setChannelFilter(event.target.value)}>
                <option value="all">All channels</option>
                {uniqueChannels.map((channelOption) => (<option key={channelOption} value={channelOption}>
                    {channelOption}
                  </option>))}
              </select>
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

            <label className="form-control">
              <div className="label">
                <span className="label-text">Input method</span>
              </div>
              <select className="select select-bordered" value={inputMethodFilter} onChange={(event) => setInputMethodFilter(event.target.value)}>
                <option value="all">All methods</option>
                <option value="typed">Typed</option>
                <option value="voice">Voice</option>
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
              <div className="badge badge-outline">{actionTracker.length} actions</div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {actionTracker.length > 0 ? (actionTracker.map((item) => (<div key={item.id} className="rounded-xl bg-base-200/70 p-3">
                    <div className="font-medium text-neutral">{item.action}</div>
                    <div className="mt-2 text-sm text-base-content/65">
                      {item.createdByName} via {item.channel} | {new Date(item.createdAt).toLocaleDateString()}
                    </div>
                  </div>))) : (<div className="text-sm text-base-content/60 md:col-span-2">No action items in the current filtered view.</div>)}
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {filteredUpdates.length > 0 ? (filteredUpdates.map((update) => (<div key={update.id} className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-neutral">{update.workspaceName}</div>
                      <div className="text-sm text-base-content/60">
                        {update.createdByName} via {update.channel} | {new Date(update.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="badge badge-outline">{update.inputMethod}</div>
                  </div>
                  <div className="mt-3 rounded-xl bg-base-200/70 p-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-base-content/55">Verbatim update</div>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-base-content/75">{update.body}</p>
                  </div>
                  <div className="mt-3 rounded-xl bg-secondary/35 p-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-secondary-content/70">Summary</div>
                    <p className="mt-2 text-sm leading-6 text-secondary-content">{update.structured.summary}</p>
                  </div>
                </div>))) : (<div className="rounded-[1.5rem] border border-dashed border-base-300 bg-base-100 p-8 text-center text-sm leading-7 text-base-content/60">
                No matching updates yet. Save the first member update or adjust your filters.
              </div>)}
          </div>
        </div>
      </div>
    </div>);
}


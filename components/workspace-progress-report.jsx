"use client";
import { useState, useTransition } from "react";
import { AlertBanner } from "@/components/alert-banner";
import { readResponsePayload } from "@/lib/client-api";
import { VoiceInputButton } from "@/components/voice-input-button";
function ReportSection({ title, items, emptyLabel }) {
    return (<div className="rounded-[1.5rem] bg-base-100 p-5">
      <div className="text-sm font-semibold text-neutral">{title}</div>
      {items.length > 0 ? (<ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-base-content/75 marker:text-primary/70">
          {items.map((item) => (<li key={item}>{item}</li>))}
        </ul>) : (<p className="mt-3 text-sm leading-6 text-base-content/60">{emptyLabel}</p>)}
    </div>);
}
export function WorkspaceProgressReportView({ workspace, isAuthenticated, templates }) {
    const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? "default-progress");
    const [report, setReport] = useState(null);
    const [missingQuestions, setMissingQuestions] = useState([]);
    const [clarificationAnswers, setClarificationAnswers] = useState({});
    const [recordingQuestionId, setRecordingQuestionId] = useState(null);
    const [error, setError] = useState(null);
    const [statusMessage, setStatusMessage] = useState(null);
    const [isPending, startTransition] = useTransition();
    const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0];
    const handleOpenHtml = () => {
        if (!report?.html) {
            return;
        }
        const blob = new Blob([report.html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    };
    const handleDownloadHtml = () => {
        if (!report?.html) {
            return;
        }
        const blob = new Blob([report.html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${workspace.slug}-${selectedTemplateId}.html`;
        link.click();
        URL.revokeObjectURL(url);
    };
    const handleGenerate = (answers = clarificationAnswers) => {
        setError(null);
        setStatusMessage(null);
        startTransition(async () => {
            try {
                const response = await fetch("/api/ai/workspace-report", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        workspaceSlug: workspace.slug,
                        templateId: selectedTemplateId,
                        clarificationAnswers: answers
                    })
                });
                const result = await readResponsePayload(response);
                if (!response.ok) {
                    throw new Error("Could not generate report");
                }
                if (result.status === "needs_clarification") {
                    setReport(null);
                    setMissingQuestions(result.missingQuestions);
                    setStatusMessage("A few details are still needed. Answer these questions and generate the report again.");
                    return;
                }
                setMissingQuestions([]);
                setReport(result);
                setStatusMessage(`Report created using the ${selectedTemplate?.name ?? "selected"} format.`);
            }
            catch (reportError) {
                setError(reportError instanceof Error ? reportError.message : "Could not generate report");
            }
        });
    };
    const appendClarificationTranscript = (questionId, transcript) => {
        const nextText = String(transcript ?? "").trim();
        if (!nextText) {
            return;
        }
        setClarificationAnswers((current) => {
            const existing = String(current[questionId] ?? "").trim();
            return {
                ...current,
                [questionId]: existing ? `${existing} ${nextText}` : nextText
            };
        });
    };
    const renderReportBody = () => {
        if (!report) {
            return null;
        }
        if (report.templateId === "collato-monthly-report") {
            const monthlyReport = report;
            return (<>
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="glass-panel rounded-[2rem] p-6">
              <p className="section-kicker">Report header</p>
              <h2 className="mt-2 text-3xl font-semibold text-neutral">Monthly report details</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.5rem] bg-base-100 p-4"><div className="text-xs uppercase tracking-[0.18em] text-primary/60">Report date</div><div className="mt-2 text-sm text-base-content/80">{monthlyReport.reportDate}</div></div>
                <div className="rounded-[1.5rem] bg-base-100 p-4"><div className="text-xs uppercase tracking-[0.18em] text-primary/60">Prepared by</div><div className="mt-2 text-sm text-base-content/80">{monthlyReport.preparedBy}</div></div>
                <div className="rounded-[1.5rem] bg-base-100 p-4"><div className="text-xs uppercase tracking-[0.18em] text-primary/60">Report no.</div><div className="mt-2 text-sm text-base-content/80">{monthlyReport.reportNo}</div></div>
                <div className="rounded-[1.5rem] bg-base-100 p-4"><div className="text-xs uppercase tracking-[0.18em] text-primary/60">Month of</div><div className="mt-2 text-sm text-base-content/80">{monthlyReport.monthOf}</div></div>
              </div>
              <p className="mt-5 whitespace-pre-line text-sm leading-8 text-base-content/78">{monthlyReport.overview}</p>
            </div>

            <div className="grid gap-4">
              <ReportSection title="Status Summary" items={monthlyReport.statusSummary} emptyLabel="No status summary was generated."/>
              <ReportSection title="Query Contacts" items={monthlyReport.queryContacts} emptyLabel="No query contacts were provided."/>
              <div className="rounded-[1.5rem] bg-base-100 p-5">
                <div className="text-sm font-semibold text-neutral">Project Associate</div>
                <p className="mt-3 text-sm leading-6 text-base-content/75">{monthlyReport.projectAssociate || "No project associate was provided."}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="glass-panel rounded-[2rem] p-6">
              <p className="section-kicker">Project overview</p>
              <h2 className="mt-2 text-3xl font-semibold text-neutral">Activities for the month</h2>
              <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-base-300">
                <table className="table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Description</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyReport.projectOverviewRows.length > 0 ? (monthlyReport.projectOverviewRows.map((row, index) => (<tr key={`${row.description}-${index}`}>
                          <td>{index + 1}</td>
                          <td>{row.description}</td>
                          <td>{row.date || "-"}</td>
                        </tr>))) : (<tr>
                        <td colSpan={3} className="text-base-content/60">
                          No monthly activities were added.
                        </td>
                      </tr>)}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass-panel rounded-[2rem] p-6">
              <p className="section-kicker">Other info</p>
              <h2 className="mt-2 text-3xl font-semibold text-neutral">Additional notes and reminders</h2>
              <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-base-300">
                <table className="table">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Description</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyReport.otherInfoRows.length > 0 ? (monthlyReport.otherInfoRows.map((row, index) => (<tr key={`${row.description}-${index}`}>
                          <td>{index + 1}</td>
                          <td>{row.description}</td>
                          <td>{row.date || "-"}</td>
                        </tr>))) : (<tr>
                        <td colSpan={3} className="text-base-content/60">
                          No additional notes were added.
                        </td>
                      </tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
            <ReportSection title="General Instructions" items={monthlyReport.generalInstructions} emptyLabel="No general instructions were included."/>
            <ReportSection title="Source Highlights" items={monthlyReport.sourceHighlights} emptyLabel="No source highlights were returned."/>
          </div>
        </>);
        }
        const defaultReport = report;
        return (<div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="glass-panel rounded-[2rem] p-6">
          <p className="section-kicker">Generated report</p>
          <h2 className="mt-2 text-3xl font-semibold text-neutral">Current project picture</h2>
          <p className="mt-4 whitespace-pre-line text-sm leading-8 text-base-content/78">{defaultReport.overview}</p>
        </div>

        <div className="grid gap-4">
          <ReportSection title="Accomplishments" items={defaultReport.accomplishments} emptyLabel="No accomplishments were surfaced yet."/>
          <ReportSection title="Current focus" items={defaultReport.currentFocus} emptyLabel="No active focus areas were surfaced yet."/>
          <ReportSection title="Risks and blockers" items={defaultReport.risks} emptyLabel="No major risks were surfaced from the current context."/>
        </div>

        <ReportSection title="Recommended next steps" items={defaultReport.nextSteps} emptyLabel="No next steps were surfaced yet."/>
        <ReportSection title="Source highlights" items={defaultReport.sourceHighlights} emptyLabel="No source highlights were returned."/>
      </div>);
    };
    return (<div className="space-y-6">
      <div className="glass-panel rounded-[2rem] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-kicker">Progress summary</p>
            <h2 className="mt-2 text-3xl font-semibold text-neutral">Generate a report from a template</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-base-content/70">
              Choose a report template first, then generate a report from the workspace knowledge, captured updates, and tracked action items.
            </p>
          </div>
          <div className="rounded-full border border-base-300 bg-base-100 px-4 py-2 text-sm font-medium text-base-content/70">
            {workspace.fileCount} files / {workspace.updateCount} updates / {workspace.taskCount} tasks
          </div>
        </div>

        <div className="mt-6">
          <div className="text-sm font-semibold text-neutral">Report templates</div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {templates.map((template) => {
            const isSelected = template.id === selectedTemplateId;
            return (<button key={template.id} type="button" onClick={() => {
                    setSelectedTemplateId(template.id);
                    setReport(null);
                    setMissingQuestions([]);
                    setClarificationAnswers({});
                    setStatusMessage(null);
                }} className={`rounded-[1.5rem] border p-5 text-left transition ${isSelected ? "border-primary bg-primary/5 shadow-soft" : "border-base-300 bg-base-100 hover:border-primary/40"}`}>
                  <div className="text-sm font-semibold text-neutral">{template.name}</div>
                  <p className="mt-2 text-sm leading-6 text-base-content/68">{template.description}</p>
                  <div className="mt-4 text-xs uppercase tracking-[0.18em] text-primary/70">{isSelected ? "Selected template" : "Choose template"}</div>
                </button>);
        })}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" onClick={() => handleGenerate()} disabled={!isAuthenticated || isPending}>
            {isPending ? "Generating..." : "Generate report"}
          </button>
          {report ? (<>
              <button type="button" className="btn btn-outline" onClick={handleOpenHtml}>
                Open HTML report
              </button>
              <button type="button" className="btn btn-outline" onClick={handleDownloadHtml}>
                Download HTML
              </button>
            </>) : null}
          <div className="text-sm text-base-content/60">{selectedTemplate?.name ?? "Template"} selected.</div>
        </div>

        {error ? <AlertBanner tone="error" className="mt-4">{error}</AlertBanner> : null}

        {statusMessage ? <AlertBanner tone="success" className="mt-4">{statusMessage}</AlertBanner> : null}

        {missingQuestions.length > 0 ? (<div className="mt-6 rounded-[1.5rem] border border-base-300 bg-base-100 p-5">
            <div className="text-sm font-semibold text-neutral">Add the missing details before you continue</div>
            <p className="mt-2 text-sm leading-6 text-base-content/65">
              These answers will be used only for this report so the selected template can be completed more accurately.
            </p>

            <div className="mt-4 space-y-4">
              {missingQuestions.map((question) => (<label key={question.id} className="form-control">
                  <div className="label items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="label-text font-medium text-neutral">{question.question}</span>
                      <span className="mt-1 block text-xs text-base-content/55">{question.reason}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <VoiceInputButton onTranscript={(text) => appendClarificationTranscript(question.id, text)} onRecordingChange={(isRecording) => {
                setRecordingQuestionId(isRecording ? question.id : (current) => current === question.id ? null : current);
            }}/>
                      <span className="text-xs uppercase tracking-[0.16em] text-base-content/50">
                        {recordingQuestionId === question.id ? "Recording" : "Mic"}
                      </span>
                    </div>
                  </div>
                  <textarea className="textarea textarea-bordered h-24" value={clarificationAnswers[question.id] ?? ""} onChange={(event) => setClarificationAnswers((current) => ({
                    ...current,
                    [question.id]: event.target.value
                }))} placeholder="Add the missing detail here."/>
                </label>))}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" className="btn btn-primary" onClick={() => handleGenerate()} disabled={isPending || missingQuestions.some((question) => !(clarificationAnswers[question.id] ?? "").trim())}>
                {isPending ? "Generating..." : "Generate with answers"}
              </button>
            </div>
          </div>) : null}
      </div>

      {report ? (<>
          {renderReportBody()}

          <div className="glass-panel rounded-[2rem] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-3">
              <div>
                <p className="section-kicker">HTML preview</p>
                <h2 className="mt-2 text-2xl font-semibold text-neutral">Formatted report</h2>
              </div>
              <div className="text-sm text-base-content/60">This is the formatted HTML version generated from the current project progress.</div>
            </div>
            <div className="overflow-hidden rounded-[1.5rem] border border-base-300 bg-white">
              <iframe title="Workspace progress report HTML preview" srcDoc={report.html} className="h-[900px] w-full bg-white"/>
            </div>
          </div>
        </>) : null}
    </div>);
}



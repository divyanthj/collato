"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { AlertBanner } from "@/components/alert-banner";
import { WorkspaceUpdateIntake } from "@/components/workspace-update-intake";
import { readResponsePayload } from "@/lib/client-api";

function formatTaskStatus(status) {
  if (status === "in_progress") {
    return "In progress";
  }

  return "Open";
}

function formatDueDate(dueDate) {
  if (!dueDate) {
    return "No due date";
  }

  const [year, month, day] = dueDate.slice(0, 10).split("-").map(Number);

  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isOverdue(dueDate) {
  if (!dueDate) {
    return false;
  }

  return dueDate.slice(0, 10) < getLocalDateKey(new Date());
}

function isDueNowTask(task) {
  return task.status !== "done" && task.dueDate && task.dueDate.slice(0, 10) <= getLocalDateKey(new Date());
}

function sortTodayTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const dueCompare = a.dueDate.slice(0, 10).localeCompare(b.dueDate.slice(0, 10));
    if (dueCompare !== 0) {
      return dueCompare;
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function buildUpdateEvents(updates) {
  return updates.map((update) => ({
    id: `update-${update.id}`,
    type: "update",
    timestamp: update.createdAt,
    actor: update.createdByName,
    actorEmail: update.createdBy,
    title: update.workspaceName,
    description: update.structured.summary || update.body,
    workspaceSlug: update.workspaceSlug,
    statusMetadata: {
      channel: update.channel,
      inputMethod: update.inputMethod
    },
    update
  }));
}

function buildSuggestedTasks(updates) {
  return updates.flatMap((update) => update.structured.actionItems.map((action, index) => ({
    id: `${update.id}-${index}`,
    title: action,
    workspaceSlug: update.workspaceSlug,
    workspaceName: update.workspaceName,
    sourceUpdateId: update.id,
    createdByName: update.createdByName,
    createdAt: update.createdAt,
    channel: update.channel
  })));
}

export function DashboardTodayPanel({
  workspaces,
  todayTasks,
  recentUpdates,
  isAuthenticated,
  currentUserName,
  currentUserEmail,
  canManageAiPrivacy = false
}) {
  const [captureRequest, setCaptureRequest] = useState(null);
  const [localTodayTasks, setLocalTodayTasks] = useState(todayTasks);
  const [availableSuggestions, setAvailableSuggestions] = useState(() => buildSuggestedTasks(recentUpdates));
  const [isClient, setIsClient] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTaskWorkspaceSlug, setSelectedTaskWorkspaceSlug] = useState(workspaces[0]?.slug ?? "");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskAssigneeEmail, setTaskAssigneeEmail] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskSourceUpdateId, setTaskSourceUpdateId] = useState("");
  const [selectedSuggestionId, setSelectedSuggestionId] = useState("");
  const [taskError, setTaskError] = useState(null);
  const [taskStatusMessage, setTaskStatusMessage] = useState(null);
  const [isCreatingTask, startCreatingTask] = useTransition();
  const activityEvents = useMemo(() => buildUpdateEvents(recentUpdates), [recentUpdates]);
  const defaultWorkspaceSlug = workspaces[0]?.slug ?? "";
  const canCapture = isAuthenticated && workspaces.length > 0;
  const selectedTaskWorkspace = useMemo(() => workspaces.find((workspace) => workspace.slug === selectedTaskWorkspaceSlug) ?? workspaces[0], [selectedTaskWorkspaceSlug, workspaces]);
  const memberDirectory = useMemo(() => {
    if (!selectedTaskWorkspace) {
      return [];
    }

    return (selectedTaskWorkspace.activeMembers ?? selectedTaskWorkspace.currentMembers ?? selectedTaskWorkspace.members ?? [])
      .filter((member) => member.status === "active")
      .map((member) => ({
        email: member.email,
        name: member.email === selectedTaskWorkspace.ownerEmail ? selectedTaskWorkspace.ownerName : member.email
      }));
  }, [selectedTaskWorkspace]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    setLocalTodayTasks(todayTasks);
  }, [todayTasks]);

  useEffect(() => {
    setAvailableSuggestions(buildSuggestedTasks(recentUpdates));
  }, [recentUpdates]);

  const openCapture = (workspaceSlug = "") => {
    setCaptureRequest({
      key: `${Date.now()}-${workspaceSlug || "manual"}`,
      workspaceSlug: workspaceSlug || defaultWorkspaceSlug
    });
  };

  const openCreateTask = () => {
    setTaskError(null);
    setTaskStatusMessage(null);
    setSelectedTaskWorkspaceSlug(defaultWorkspaceSlug);
    setIsCreateDialogOpen(true);
  };

  const resetTaskForm = () => {
    setTaskTitle("");
    setTaskDescription("");
    setTaskAssigneeEmail("");
    setTaskDueDate("");
    setTaskSourceUpdateId("");
    setSelectedSuggestionId("");
  };

  const createTask = ({ workspaceSlug, title, description = "", assigneeEmail = "", dueDate = null, sourceUpdateId = "" }, { suggestionId = "" } = {}) => {
    const workspace = workspaces.find((item) => item.slug === workspaceSlug);
    const trimmedTitle = title.trim();
    if (!workspace || !trimmedTitle) {
      setTaskError("Workspace and task title are required.");
      return;
    }

    setTaskError(null);
    setTaskStatusMessage(null);
    startCreatingTask(async () => {
      try {
        const workspaceMembers = (workspace.activeMembers ?? workspace.currentMembers ?? workspace.members ?? [])
          .filter((member) => member.status === "active")
          .map((member) => ({
            email: member.email,
            name: member.email === workspace.ownerEmail ? workspace.ownerName : member.email
          }));
        const assignee = workspaceMembers.find((member) => member.email === assigneeEmail);
        const response = await fetch("/api/workspace-tasks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            workspaceSlug: workspace.slug,
            title: trimmedTitle,
            description,
            assigneeEmail,
            assigneeName: assignee?.name ?? "",
            dueDate,
            sourceUpdateId
          })
        });
        const result = await readResponsePayload(response);
        if (!response.ok) {
          throw new Error(result.error ?? "Could not create task");
        }

        if (isDueNowTask(result)) {
          setLocalTodayTasks((current) => sortTodayTasks([result, ...current.filter((task) => task.id !== result.id)]));
        }
        resetTaskForm();
        if (suggestionId) {
          setAvailableSuggestions((current) => current.filter((suggestion) => suggestion.id !== suggestionId));
        }
        setTaskStatusMessage("Task created successfully.");
        if (!suggestionId) {
          setIsCreateDialogOpen(false);
        }
      }
      catch (error) {
        setTaskError(error instanceof Error ? error.message : "Could not create task");
      }
    });
  };

  const handleCreateTask = () => {
    createTask({
      workspaceSlug: selectedTaskWorkspace?.slug ?? "",
      title: taskTitle,
      description: taskDescription,
      assigneeEmail: taskAssigneeEmail,
      dueDate: taskDueDate || null,
      sourceUpdateId: taskSourceUpdateId
    }, { suggestionId: selectedSuggestionId });
  };

  const handleSuggestedTask = (suggestion) => {
    setTaskError(null);
    setTaskStatusMessage("Suggestion copied into the form. Review it, then create the task.");
    setSelectedTaskWorkspaceSlug(suggestion.workspaceSlug);
    setTaskTitle(suggestion.title);
    setTaskDescription(`Imported from ${suggestion.channel} update by ${suggestion.createdByName}.`);
    setTaskAssigneeEmail("");
    setTaskDueDate("");
    setTaskSourceUpdateId(suggestion.sourceUpdateId);
    setSelectedSuggestionId(suggestion.id);
  };

  return (
    <div className="glass-panel rounded-[2rem] p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.24em] text-primary/60">Today</div>
          <h2 className="mt-2 text-2xl font-semibold leading-tight text-neutral sm:text-3xl">
            Tasks due now and quick updates
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-base-content/70">
            Start from what needs attention today, then post an update to the right workspace without opening a separate page.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          {defaultWorkspaceSlug ? (
            <button type="button" className="btn btn-outline" onClick={openCreateTask}>
              Create task
            </button>
          ) : (
            <span className="btn btn-disabled">Create task</span>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => openCapture()}
            disabled={!canCapture}
          >
            Capture update
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-neutral">Today tasks</div>
              <div className="mt-1 text-sm text-base-content/60">Due today or overdue across visible workspaces.</div>
            </div>
            <div className="badge badge-outline">{localTodayTasks.length} due</div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {localTodayTasks.length > 0 ? localTodayTasks.map((task) => {
              const overdue = isOverdue(task.dueDate);

              return (
                <div key={task.id} className="flex min-h-52 flex-col rounded-[1.25rem] border border-base-300 bg-base-200/50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-[0.18em] text-primary/60">{task.workspaceName}</div>
                      <div className="mt-2 break-words text-lg font-semibold leading-snug text-neutral">{task.title}</div>
                    </div>
                    <span className={`badge shrink-0 ${overdue ? "badge-error badge-outline" : "badge-info badge-outline"}`}>
                      {overdue ? "Overdue" : "Today"}
                    </span>
                  </div>

                  {task.description ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-base-content/70">{task.description}</p> : null}

                  <div className="mt-auto pt-4">
                    <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.14em] text-base-content/55">
                      <span>{formatTaskStatus(task.status)}</span>
                      <span>Due {formatDueDate(task.dueDate)}</span>
                      <span>{task.assigneeName || task.assigneeEmail || "Unassigned"}</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm mt-4"
                      onClick={() => openCapture(task.workspaceSlug)}
                      disabled={!canCapture}
                    >
                      Post update
                    </button>
                  </div>
                </div>
              );
            }) : defaultWorkspaceSlug ? (
              <Link
                href={`/dashboard/${encodeURIComponent(defaultWorkspaceSlug)}/tasks`}
                className="rounded-[1.25rem] border border-dashed border-base-300 p-8 text-center text-sm leading-7 text-base-content/60 transition hover:border-primary/45 hover:bg-base-200/50 hover:text-base-content lg:col-span-2"
              >
                No due or overdue tasks for today. Open the task board to create or review tasks.
              </Link>
            ) : (
              <div className="rounded-[1.25rem] border border-dashed border-base-300 p-8 text-center text-sm leading-7 text-base-content/60 lg:col-span-2">
                No due or overdue tasks for today.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4 sm:p-5">
          <div className="text-sm font-semibold text-neutral">Recent update signal</div>
          <div className="mt-1 text-sm text-base-content/60">Latest workspace updates visible from this dashboard.</div>

          <div className="mt-4 space-y-3">
            {recentUpdates.length > 0 ? recentUpdates.slice(0, 3).map((update) => (
              <div key={update.id} className="rounded-[1.25rem] bg-base-200/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-neutral">{update.workspaceName}</div>
                  <div className="badge badge-outline">{update.inputMethod}</div>
                </div>
                <p className="mt-2 text-sm leading-6 text-base-content/72">{update.structured.summary}</p>
              </div>
            )) : (
              <div className="rounded-[1.25rem] border border-dashed border-base-300 p-6 text-sm leading-7 text-base-content/60">
                No updates yet. The first capture from here will start the organization activity trail.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <WorkspaceUpdateIntake
          workspaces={workspaces}
          initialUpdates={recentUpdates}
          initialActivityEvents={activityEvents}
          isAuthenticated={canCapture}
          currentUserName={currentUserName}
          currentUserEmail={currentUserEmail}
          canManageAiPrivacy={canManageAiPrivacy}
          initialSelectedWorkspaceSlug={defaultWorkspaceSlug}
          captureRequest={captureRequest}
          showHeader={false}
          showActivity={false}
        />
      </div>
      {isClient && isCreateDialogOpen ? createPortal((
        <div className="modal modal-open" role="dialog" aria-modal="true" aria-labelledby="dashboard-create-task-title">
          <div className="modal-box relative max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-6xl overflow-y-auto rounded-[1.5rem] bg-base-100 p-0 shadow-soft sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:rounded-[2rem]">
            <button
              type="button"
              className="btn btn-circle btn-ghost btn-sm absolute right-3 top-3 z-20 sm:right-4 sm:top-4"
              aria-label="Close create task dialog"
              onClick={() => {
                setTaskError(null);
                setTaskStatusMessage(null);
                setIsCreateDialogOpen(false);
              }}
            >
              X
            </button>

            <div className="border-b border-base-300 bg-base-100/90 px-5 py-5 pr-14 backdrop-blur-xl sm:px-6 sm:pr-16">
              <p className="section-kicker">Create task</p>
              <h2 id="dashboard-create-task-title" className="mt-2 text-2xl font-semibold leading-tight text-neutral sm:text-3xl">
                Add a workspace task
              </h2>
              <p className="mt-3 text-sm leading-7 text-base-content/70">
                Pick the workspace first, then assign ownership and a due date.
              </p>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-[0.95fr_1.05fr] sm:p-6">
              <div className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4 sm:p-5">
                <div>
                  <p className="section-kicker">Manual task</p>
                  <h3 className="mt-2 text-2xl font-semibold text-neutral">Add a new task</h3>
                </div>

                <div className="mt-5 grid gap-4">
                  <label className="form-control">
                    <div className="label">
                      <span className="label-text">Workspace</span>
                    </div>
                    <select
                      className="select select-bordered"
                      value={selectedTaskWorkspaceSlug}
                      onChange={(event) => {
                        setSelectedTaskWorkspaceSlug(event.target.value);
                        setTaskAssigneeEmail("");
                        setTaskSourceUpdateId("");
                        setSelectedSuggestionId("");
                      }}
                      disabled={isCreatingTask}
                    >
                      {workspaces.map((workspace) => (
                        <option key={workspace.slug} value={workspace.slug}>
                          {workspace.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="form-control">
                    <div className="label">
                      <span className="label-text">Task title</span>
                    </div>
                    <input
                      className="input input-bordered"
                      value={taskTitle}
                      onChange={(event) => setTaskTitle(event.target.value)}
                      placeholder="Example: Send revised checklist to the facade vendor"
                      disabled={isCreatingTask}
                    />
                  </label>

                  <label className="form-control">
                    <div className="label">
                      <span className="label-text">Description</span>
                    </div>
                    <textarea
                      className="textarea textarea-bordered h-28"
                      value={taskDescription}
                      onChange={(event) => setTaskDescription(event.target.value)}
                      placeholder="Add optional context, links, or the reason this task matters."
                      disabled={isCreatingTask}
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="form-control">
                      <div className="label">
                        <span className="label-text">Assignee</span>
                      </div>
                      <select
                        className="select select-bordered"
                        value={taskAssigneeEmail}
                        onChange={(event) => setTaskAssigneeEmail(event.target.value)}
                        disabled={isCreatingTask}
                      >
                        <option value="">Unassigned</option>
                        {memberDirectory.map((member) => (
                          <option key={member.email} value={member.email}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="form-control">
                      <div className="label">
                        <span className="label-text">Due date</span>
                      </div>
                      <input
                        className="input input-bordered"
                        type="date"
                        value={taskDueDate}
                        onChange={(event) => setTaskDueDate(event.target.value)}
                        disabled={isCreatingTask}
                      />
                    </label>
                  </div>
                </div>

                {taskError ? <AlertBanner tone="error" className="mt-4">{taskError}</AlertBanner> : null}
                {taskStatusMessage ? <AlertBanner tone="success" className="mt-4">{taskStatusMessage}</AlertBanner> : null}

                <div className="mt-5 flex flex-col gap-3 border-t border-base-300 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleCreateTask}
                    disabled={isCreatingTask || !selectedTaskWorkspace || !taskTitle.trim()}
                  >
                    {isCreatingTask ? "Saving..." : "Create task"}
                  </button>
                  <p className="text-sm leading-7 text-base-content/60">Tasks due today or overdue will show in the Today list.</p>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="section-kicker">Suggested tasks</p>
                    <h3 className="mt-2 text-2xl font-semibold text-neutral">Import from recent updates</h3>
                    <p className="mt-3 text-sm leading-7 text-base-content/70">
                      Convert extracted action items into tracked tasks without retyping them.
                    </p>
                  </div>
                  <div className="badge badge-outline">{availableSuggestions.length} suggestions</div>
                </div>

                <div className="mt-5 grid gap-3">
                  {availableSuggestions.length > 0 ? availableSuggestions.map((suggestion) => (
                    <div key={suggestion.id} className="rounded-[1.25rem] border border-base-300 bg-base-200/50 p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-primary/60">{suggestion.workspaceName}</div>
                      <div className="mt-2 font-semibold text-neutral">{suggestion.title}</div>
                      <div className="mt-2 text-sm text-base-content/65">
                        {suggestion.createdByName} via {suggestion.channel} | {new Date(suggestion.createdAt).toLocaleDateString()}
                      </div>
                      <button type="button" className="btn btn-outline btn-sm mt-4" onClick={() => handleSuggestedTask(suggestion)} disabled={isCreatingTask}>
                        Use this suggestion
                      </button>
                    </div>
                  )) : (
                    <div className="rounded-[1.25rem] border border-dashed border-base-300 p-6 text-center text-sm leading-7 text-base-content/60">
                      No action suggestions yet. Suggested tasks appear when recent updates include extracted follow-ups.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="modal-backdrop"
            aria-label="Close create task dialog"
            onClick={() => {
              setTaskError(null);
              setTaskStatusMessage(null);
              setIsCreateDialogOpen(false);
            }}
          >
            close
          </button>
        </div>
      ), document.body) : null}
    </div>
  );
}

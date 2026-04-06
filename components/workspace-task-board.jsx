"use client";
import { useMemo, useState, useTransition } from "react";
const TASK_COLUMNS = [
    { status: "open", label: "Open" },
    { status: "in_progress", label: "In progress" },
    { status: "done", label: "Done" }
];
export function WorkspaceTaskBoard({ workspace, initialTasks, suggestedTasks, currentUserName, currentUserEmail }) {
    const [tasks, setTasks] = useState(initialTasks);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [assigneeEmail, setAssigneeEmail] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [error, setError] = useState(null);
    const [statusMessage, setStatusMessage] = useState(null);
    const [isPending, startTransition] = useTransition();
    const memberDirectory = useMemo(() => workspace.members.map((member) => ({
        email: member.email,
        name: member.email === workspace.ownerEmail
            ? workspace.ownerName
            : member.email
    })), [workspace]);
    const tasksByStatus = useMemo(() => TASK_COLUMNS.map((column) => ({
        ...column,
        tasks: tasks.filter((task) => task.status === column.status)
    })), [tasks]);
    const createTask = (payload) => {
        setError(null);
        setStatusMessage(null);
        startTransition(async () => {
            try {
                const assignee = memberDirectory.find((member) => member.email === payload.assigneeEmail);
                const response = await fetch("/api/dashboard-tasks", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        workspaceSlug: workspace.slug,
                        title: payload.title,
                        description: payload.description ?? "",
                        assigneeEmail: payload.assigneeEmail ?? "",
                        assigneeName: assignee?.name ?? "",
                        dueDate: payload.dueDate || null,
                        sourceUpdateId: payload.sourceUpdateId ?? ""
                    })
                });
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error ?? "Could not create task");
                }
                setTasks((current) => [result, ...current]);
                setStatusMessage("Task created successfully.");
                setTitle("");
                setDescription("");
                setAssigneeEmail("");
                setDueDate("");
            }
            catch (taskError) {
                setError(taskError instanceof Error ? taskError.message : "Could not create task");
            }
        });
    };
    const handleCreateTask = () => {
        if (!title.trim()) {
            setError("Task title is required");
            return;
        }
        createTask({
            title,
            description,
            assigneeEmail,
            dueDate
        });
    };
    const handleSuggestedTask = (suggestion) => {
        createTask({
            title: suggestion.title,
            description: `Imported from ${suggestion.channel} update by ${suggestion.createdByName}.`,
            sourceUpdateId: suggestion.sourceUpdateId
        });
    };
    const handleTaskPatch = (taskId, updates) => {
        setError(null);
        setStatusMessage(null);
        startTransition(async () => {
            try {
                const response = await fetch(`/api/dashboard-tasks/${taskId}`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        workspaceSlug: workspace.slug,
                        ...updates
                    })
                });
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error ?? "Could not update task");
                }
                setTasks((current) => current.map((task) => (task.id === taskId ? result : task)));
            }
            catch (taskError) {
                setError(taskError instanceof Error ? taskError.message : "Could not update task");
            }
        });
    };
    return (<div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="glass-panel rounded-[2rem] p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-kicker">Create task</p>
              <h2 className="mt-2 text-3xl font-semibold text-neutral">Turn follow-through into a shared queue</h2>
              <p className="mt-3 text-sm leading-7 text-base-content/70">
                Create explicit tasks for owners and members so the next step does not disappear inside a long update thread.
              </p>
            </div>
            <div className="rounded-full border border-base-300 bg-base-100 px-4 py-2 text-sm font-medium text-base-content/70">
              {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            <label className="form-control">
              <div className="label">
                <span className="label-text">Task title</span>
              </div>
              <input className="input input-bordered" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Example: Send revised checklist to the facade vendor"/>
            </label>

            <label className="form-control">
              <div className="label">
                <span className="label-text">Description</span>
              </div>
              <textarea className="textarea textarea-bordered h-28" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add optional context, links, or the reason this task matters."/>
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="form-control">
                <div className="label">
                  <span className="label-text">Assignee</span>
                </div>
                <select className="select select-bordered" value={assigneeEmail} onChange={(event) => setAssigneeEmail(event.target.value)}>
                  <option value="">Unassigned</option>
                  {memberDirectory.map((member) => (<option key={member.email} value={member.email}>
                      {member.name}
                    </option>))}
                </select>
              </label>

              <label className="form-control">
                <div className="label">
                  <span className="label-text">Due date</span>
                </div>
                <input className="input input-bordered" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)}/>
              </label>
            </div>
          </div>

          {error ? (<div className="alert alert-error mt-4 text-sm">
              <span>{error}</span>
            </div>) : null}

          {statusMessage ? (<div className="alert alert-success mt-4 text-sm">
              <span>{statusMessage}</span>
            </div>) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-primary" onClick={handleCreateTask} disabled={isPending || !title.trim()}>
              {isPending ? "Saving..." : "Create task"}
            </button>
            <div className="text-sm text-base-content/60">Logged by {currentUserName || currentUserEmail}</div>
          </div>
        </div>

        <div className="glass-panel rounded-[2rem] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-kicker">Suggested tasks</p>
              <h2 className="mt-2 text-3xl font-semibold text-neutral">Import from recent updates</h2>
            </div>
            <div className="badge badge-outline">{suggestedTasks.length} suggestions</div>
          </div>

          <div className="mt-6 grid gap-3">
            {suggestedTasks.length > 0 ? (suggestedTasks.map((suggestion) => (<div key={suggestion.id} className="rounded-[1.5rem] border border-base-300 bg-base-100 p-4">
                  <div className="font-semibold text-neutral">{suggestion.title}</div>
                  <div className="mt-2 text-sm text-base-content/65">
                    {suggestion.createdByName} via {suggestion.channel} | {new Date(suggestion.createdAt).toLocaleDateString()}
                  </div>
                  <button type="button" className="btn btn-outline btn-sm mt-4" onClick={() => handleSuggestedTask(suggestion)} disabled={isPending}>
                    Create task from this
                  </button>
                </div>))) : (<div className="rounded-[1.5rem] border border-dashed border-base-300 bg-base-100 p-8 text-center text-sm leading-7 text-base-content/60">
                No action suggestions yet. As updates accumulate, extracted action items will appear here for quick conversion into tasks.
              </div>)}
          </div>
        </div>
      </div>

      <div className="glass-panel rounded-[2rem] p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="section-kicker">Task board</p>
            <h2 className="mt-2 text-3xl font-semibold text-neutral">Track work across the workspace</h2>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          {tasksByStatus.map((column) => (<div key={column.status} className="rounded-[1.75rem] bg-base-100 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-lg font-semibold text-neutral">{column.label}</div>
                <div className="badge badge-outline">{column.tasks.length}</div>
              </div>

              <div className="mt-4 space-y-3">
                {column.tasks.length > 0 ? (column.tasks.map((task) => (<div key={task.id} className="rounded-[1.25rem] border border-base-300 bg-base-200/50 p-4">
                      <div className="font-semibold text-neutral">{task.title}</div>
                      {task.description ? <p className="mt-2 text-sm leading-6 text-base-content/70">{task.description}</p> : null}

                      <div className="mt-3 grid gap-3">
                        <label className="form-control">
                          <div className="label py-1">
                            <span className="label-text text-xs uppercase tracking-[0.18em] text-base-content/55">Status</span>
                          </div>
                          <select className="select select-bordered select-sm" value={task.status} onChange={(event) => handleTaskPatch(task.id, {
                    status: event.target.value
                })}>
                            <option value="open">Open</option>
                            <option value="in_progress">In progress</option>
                            <option value="done">Done</option>
                          </select>
                        </label>

                        <label className="form-control">
                          <div className="label py-1">
                            <span className="label-text text-xs uppercase tracking-[0.18em] text-base-content/55">Assignee</span>
                          </div>
                          <select className="select select-bordered select-sm" value={task.assigneeEmail} onChange={(event) => {
                    const nextEmail = event.target.value;
                    const nextAssignee = memberDirectory.find((member) => member.email === nextEmail);
                    handleTaskPatch(task.id, {
                        assigneeEmail: nextEmail,
                        assigneeName: nextAssignee?.name ?? ""
                    });
                }}>
                            <option value="">Unassigned</option>
                            {memberDirectory.map((member) => (<option key={member.email} value={member.email}>
                                {member.name}
                              </option>))}
                          </select>
                        </label>

                        <label className="form-control">
                          <div className="label py-1">
                            <span className="label-text text-xs uppercase tracking-[0.18em] text-base-content/55">Due date</span>
                          </div>
                          <input className="input input-bordered input-sm" type="date" value={task.dueDate ? task.dueDate.slice(0, 10) : ""} onChange={(event) => handleTaskPatch(task.id, {
                    dueDate: event.target.value || null
                })}/>
                        </label>
                      </div>

                      <div className="mt-3 text-xs uppercase tracking-[0.18em] text-base-content/50">
                        {task.assigneeName || task.assigneeEmail || "Unassigned"} | created by {task.createdByName}
                      </div>
                    </div>))) : (<div className="rounded-[1.25rem] border border-dashed border-base-300 p-5 text-sm text-base-content/60">
                    No tasks in this column yet.
                  </div>)}
              </div>
            </div>))}
        </div>
      </div>
    </div>);
}


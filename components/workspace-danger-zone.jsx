"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function WorkspaceDangerZone({ workspace, canDeleteWorkspace }) {
    const router = useRouter();
    const dialogRef = useRef(null);
    const [error, setError] = useState(null);
    const [isDeleting, startDeleting] = useTransition();

    const openDialog = () => {
        setError(null);
        dialogRef.current?.showModal();
    };

    const closeDialog = () => {
        dialogRef.current?.close();
    };

    const handleDelete = () => {
        setError(null);
        startDeleting(async () => {
            try {
                const response = await fetch("/api/workspaces", {
                    method: "DELETE",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        workspaceSlug: workspace.slug
                    })
                });
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.error ?? "Could not delete workspace");
                }
                closeDialog();
                router.push("/dashboard");
                router.refresh();
            }
            catch (deleteError) {
                setError(deleteError instanceof Error ? deleteError.message : "Could not delete workspace");
            }
        });
    };

    return (<div className="glass-panel rounded-[2rem] p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-kicker">Danger zone</p>
          <h2 className="mt-2 text-3xl font-semibold text-neutral">Delete this workspace</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-base-content/68">
            This permanently removes the workspace and clears its files, updates, tasks, and indexed knowledge chunks.
          </p>
        </div>
        <div className={`badge ${canDeleteWorkspace ? "badge-warning" : "badge-neutral"}`}>
          {canDeleteWorkspace ? "Owner or admin" : "Not allowed"}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-error btn-outline" onClick={openDialog} disabled={!canDeleteWorkspace || isDeleting}>
          Delete workspace
        </button>
        <p className="text-sm leading-7 text-base-content/60">
          {canDeleteWorkspace ? "Use this only when the workspace should no longer exist." : "Only the workspace owner or an organization admin can delete it."}
        </p>
      </div>

      {error ? (<div className="alert alert-error mt-4 text-sm">
          <span>{error}</span>
        </div>) : null}

      <dialog ref={dialogRef} className="modal">
        <div className="modal-box max-w-xl rounded-[2rem]">
          <h3 className="text-2xl font-semibold text-neutral">Delete workspace?</h3>
          <p className="mt-4 text-sm leading-7 text-base-content/72">
            You are about to delete <span className="font-semibold text-neutral">{workspace.name}</span>. This cannot be undone.
          </p>
          <p className="mt-3 text-sm leading-7 text-base-content/72">
            The workspace record, uploaded knowledge, saved updates, tracked tasks, and retrieval index for this workspace will all be removed.
          </p>

          {error ? (<div className="alert alert-error mt-4 text-sm">
              <span>{error}</span>
            </div>) : null}

          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={closeDialog} disabled={isDeleting}>
              Cancel
            </button>
            <button type="button" className="btn btn-error" onClick={handleDelete} disabled={isDeleting || !canDeleteWorkspace}>
              {isDeleting ? "Deleting..." : "Yes, delete workspace"}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit" disabled={isDeleting}>close</button>
        </form>
      </dialog>
    </div>);
}

"use client";
import { useRef, useState } from "react";
import { WorkspaceChat } from "@/components/workspace-chat";
export function AskCollatoPanel({ workspaceSlug }) {
  const dialog = useRef(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  async function show() {
    setOpen(true); setLoading(true); dialog.current.showModal();
    try { const response = await fetch(`/api/ai/workspace-chat?workspaceSlug=${encodeURIComponent(workspaceSlug)}`); const result = await response.json(); setMessages(response.ok ? result.messages : []); } catch { setMessages([]); } finally { setLoading(false); }
  }
  return <><button type="button" className="btn btn-sm btn-outline" onClick={show}>Ask Collato</button><dialog ref={dialog} className="modal" onClose={() => setOpen(false)}><div className="modal-box w-11/12 max-w-4xl"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-semibold">Ask Collato</h2><button className="btn btn-sm btn-ghost" type="button" onClick={() => dialog.current.close()}>Close</button></div>{loading && <p className="mt-4 text-sm">Loading your workspace conversation…</p>}{open && !loading && <WorkspaceChat workspaces={[{ slug: workspaceSlug, name: "Current workspace" }]} initialMessages={messages} isAuthenticated />}</div><form method="dialog" className="modal-backdrop"><button>Close</button></form></dialog></>;
}

"use client";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { readResponsePayload } from "@/lib/client-api";
function makeId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function MarkdownAnswer({ text }) {
    return (<div className="prose prose-sm max-w-none text-base-content prose-headings:my-2 prose-headings:text-base-content prose-p:my-2 prose-li:my-1 prose-pre:my-3 prose-pre:overflow-x-auto prose-pre:rounded-xl prose-pre:bg-neutral prose-pre:p-3 prose-pre:text-neutral-content prose-code:rounded prose-code:bg-base-300 prose-code:px-1 prose-code:py-0.5 prose-code:text-xs">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {text}
      </ReactMarkdown>
    </div>);
}
export function WorkspaceChat({ workspaces, initialMessages = [], isAuthenticated }) {
    const [selectedWorkspaceSlug, setSelectedWorkspaceSlug] = useState(workspaces[0]?.slug ?? "");
    const [question, setQuestion] = useState("");
    const [messages, setMessages] = useState(initialMessages);
    const [error, setError] = useState(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const scrollRef = useRef(null);
    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages]);
    const handleAsk = async () => {
        const trimmedQuestion = question.trim();
        if (!trimmedQuestion) {
            return;
        }
        setError(null);
        setQuestion("");
        setIsStreaming(true);
        const userMessage = {
            id: makeId(),
            role: "user",
            text: trimmedQuestion
        };
        const assistantId = makeId();
        setMessages((current) => [
            ...current,
            userMessage,
            {
                id: assistantId,
                role: "assistant",
                text: "",
                isStreaming: true
            }
        ]);
        try {
            const response = await fetch("/api/ai/workspace-chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    workspaceSlug: selectedWorkspaceSlug,
                    question: trimmedQuestion
                })
            });
            if (!response.ok || !response.body) {
                let message = "Could not answer question";
                const result = await readResponsePayload(response);
                message = result.error ?? message;
                throw new Error(message);
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let isReading = true;
            while (isReading) {
                const { done, value } = await reader.read();
                if (done) {
                    isReading = false;
                    continue;
                }
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";
                for (const line of lines) {
                    if (!line.trim()) {
                        continue;
                    }
                    const event = JSON.parse(line);
                    if (event.type === "delta") {
                        setMessages((current) => current.map((message) => message.id === assistantId
                            ? {
                                ...message,
                                text: `${message.text}${event.text}`
                            }
                            : message));
                    }
                    if (event.type === "meta") {
                        setMessages((current) => current.map((message) => message.id === assistantId
                            ? {
                                ...message,
                                sources: event.sources,
                                followUps: event.followUps,
                                isStreaming: false
                            }
                            : message));
                    }
                    if (event.type === "error") {
                        throw new Error(event.error);
                    }
                }
            }
            setMessages((current) => current.map((message) => message.id === assistantId
                ? {
                    ...message,
                    isStreaming: false
                }
                : message));
        }
        catch (askError) {
            setError(askError instanceof Error ? askError.message : "Could not answer question");
            setMessages((current) => current.map((message) => message.id === assistantId
                ? {
                    ...message,
                    text: message.text || "I couldn't answer that just now.",
                    isStreaming: false
                }
                : message));
        }
        finally {
            setIsStreaming(false);
        }
    };
    return (<div className="glass-panel rounded-[2rem] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="section-kicker">Workspace chatbot</p>
          <h2 className="mt-2 text-3xl font-semibold text-neutral">Ask the knowledge base</h2>
        </div>
        <div className={`badge badge-lg ${isAuthenticated ? "badge-success" : "badge-warning"}`}>
          {isAuthenticated ? "Available" : "Sign in to continue"}
        </div>
      </div>

      <p className="mt-3 max-w-2xl text-sm leading-7 text-base-content/70">
        Ask questions across uploaded files and team updates. Answers now stream in like a real chat instead of waiting for the full response first.
      </p>

      <div className="mt-6">
        <label className="form-control">
          <div className="label">
            <span className="label-text">Workspace</span>
          </div>
          <select className="select select-bordered" value={selectedWorkspaceSlug} onChange={(event) => setSelectedWorkspaceSlug(event.target.value)} disabled={!isAuthenticated || workspaces.length === 0 || isStreaming}>
            {workspaces.length === 0 ? <option>No workspaces yet</option> : null}
            {workspaces.map((workspace) => (<option key={workspace.slug} value={workspace.slug}>
                {workspace.name}
              </option>))}
          </select>
        </label>
      </div>

      <div className="mt-6 rounded-[1.5rem] border border-base-300 bg-base-100 p-4">
        <div className="space-y-4">
          {messages.length > 0 ? (messages.map((message) => (<div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-[1.25rem] p-4 ${message.role === "user" ? "bg-neutral text-neutral-content" : "bg-base-200 text-base-content"}`}>
                  <div className="text-xs uppercase tracking-[0.18em] opacity-60">
                    {message.role === "user" ? "You" : "Knowledge base"}
                  </div>
                  <div className="mt-2 text-sm leading-7">
                    {message.role === "assistant" ? (<MarkdownAnswer text={message.text || (message.isStreaming ? "Thinking..." : "")}/>) : (<p className="whitespace-pre-line">{message.text || ""}</p>)}
                  </div>

                  {message.role === "assistant" && message.sources && message.sources.length > 0 ? (<div className="mt-4">
                      <div className="text-xs uppercase tracking-[0.18em] opacity-60">Sources</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.sources.map((source) => (<span key={source} className="badge badge-outline">
                            {source}
                          </span>))}
                      </div>
                    </div>) : null}

                  {message.role === "assistant" && message.followUps && message.followUps.length > 0 ? (<div className="mt-4">
                      <div className="text-xs uppercase tracking-[0.18em] opacity-60">Suggested follow-ups</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.followUps.map((item) => (<button key={item} type="button" className="badge badge-outline cursor-pointer px-3 py-3" onClick={() => setQuestion(item)} disabled={isStreaming}>
                            {item}
                          </button>))}
                      </div>
                    </div>) : null}
                </div>
              </div>))) : (<div className="rounded-[1.25rem] border border-dashed border-base-300 bg-base-100 p-8 text-center text-sm leading-7 text-base-content/60">
              Start a conversation with the workspace knowledge base.
            </div>)}
          <div ref={scrollRef}/>
        </div>
      </div>

      {error ? (<div className="alert alert-error mt-4 text-sm">
          <span>{error}</span>
        </div>) : null}

      <div className="mt-6 grid gap-3">
        <label className="form-control">
          <div className="label">
            <span className="label-text">Message</span>
          </div>
          <textarea className="textarea textarea-bordered h-28" value={question} onChange={(event) => setQuestion(event.target.value)} disabled={!isAuthenticated || isStreaming} placeholder="Example: What requirements have we already collected for this project, and what are the open actions from recent field updates?"/>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" onClick={handleAsk} disabled={!isAuthenticated || isStreaming || !selectedWorkspaceSlug || !question.trim()}>
            {isStreaming ? "Streaming answer..." : "Send"}
          </button>
          <p className="text-sm leading-7 text-base-content/60">Responses appear progressively so you can follow the answer as it forms.</p>
        </div>
      </div>
    </div>);
}


import { AskCollatoPanel } from "@/components/ask-collato-panel";
import Link from "next/link";
import { ClientEventTracker } from "@/components/client-event-tracker";

const WORKSPACE_TABS = [
  { id: "hub", label: "Overview", href: slug => `/dashboard/${slug}` },
  { id: "evidence", label: "Evidence", href: slug => `/dashboard/${slug}/evidence` },
  { id: "tasks", label: "Tasks", href: slug => `/dashboard/${slug}/tasks` },
  { id: "report", label: "Reports", href: slug => `/dashboard/${slug}/report` }
];

export function WorkspaceSubnav({ workspaceSlug, activeTab }) {
  if (!workspaceSlug) {
    return null;
  }

  return (
    <div className="mt-5 max-w-full overflow-x-auto pb-1">
      <ClientEventTracker key={`${workspaceSlug}:${activeTab}`} goalName="workspace_section_viewed" metadata={{ section: activeTab }} />
      <div className="flex flex-wrap items-center gap-3"><AskCollatoPanel workspaceSlug={workspaceSlug} /><div role="tablist" className="tabs tabs-boxed w-max rounded-[1rem] border border-base-300 bg-base-100/90 p-1">
        {WORKSPACE_TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <Link
              key={tab.id}
              href={tab.href(workspaceSlug)}
              role="tab"
              aria-selected={isActive}
              className={`tab flex-none whitespace-nowrap rounded-xl border border-transparent px-3 text-xs transition sm:text-sm ${
                isActive
                  ? "tab-active !border-neutral !bg-neutral !text-neutral-content"
                  : "text-base-content/72 hover:border-base-300 hover:bg-base-200/70 hover:text-neutral"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div></div>
    </div>
  );
}

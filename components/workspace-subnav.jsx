import Link from "next/link";

const WORKSPACE_TABS = [
  {
    id: "hub",
    label: "Hub",
    href: (workspaceSlug) => `/dashboard/${workspaceSlug}`
  },
  {
    id: "knowledge",
    label: "Knowledge",
    href: (workspaceSlug) => `/dashboard/${workspaceSlug}/knowledge`
  },
  {
    id: "updates",
    label: "Updates",
    href: (workspaceSlug) => `/dashboard/${workspaceSlug}/updates`
  },
  {
    id: "chat",
    label: "Ask",
    href: (workspaceSlug) => `/dashboard/${workspaceSlug}/chat`
  },
  {
    id: "tasks",
    label: "Tasks",
    href: (workspaceSlug) => `/dashboard/${workspaceSlug}/tasks`
  },
  {
    id: "report",
    label: "Report",
    href: (workspaceSlug) => `/dashboard/${workspaceSlug}/report`
  }
];

export function WorkspaceSubnav({ workspaceSlug, activeTab }) {
  if (!workspaceSlug) {
    return null;
  }

  return (
    <div className="mt-5">
      <div role="tablist" className="tabs tabs-boxed rounded-[1rem] border border-base-300 bg-base-100/90 p-1">
        {WORKSPACE_TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <Link
              key={tab.id}
              href={tab.href(workspaceSlug)}
              role="tab"
              aria-selected={isActive}
              className={`tab rounded-xl border border-transparent transition ${
                isActive
                  ? "tab-active !border-neutral !bg-neutral !text-neutral-content"
                  : "text-base-content/72 hover:border-base-300 hover:bg-base-200/70 hover:text-neutral"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

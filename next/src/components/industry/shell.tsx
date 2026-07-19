"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Database,
  FileText,
  FolderOpen,
  Globe2,
  Grid2X2,
  Settings,
  ArrowLeft,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useStore, type AgentInfo } from "@/lib/store";
import { getProjectCounts, useIndustryStore } from "@/lib/industry/store";
import { relativeTime } from "@/lib/industry/format";
import type { WorkspaceProjectCounts } from "@/lib/industry/workspace/client";

export function AppLogo() {
  return (
    <Link href="/" className="iis-logo">
      <span className="iis-logo-mark">
        <BarChart3 size={22} strokeWidth={2.2} />
      </span>
      <span className="iis-logo-title">Industry Insight Studio</span>
    </Link>
  );
}

export function AppTopBar({
  projectId,
  projectName,
  section,
}: {
  projectId?: string;
  projectName?: string;
  section?: string;
}) {
  const project = useIndustryStore((s) =>
    projectId ? s.projects.find((p) => p.id === projectId) : undefined,
  );
  const agents = useStore((s) => s.agents);
  const selectedAgentId = useStore((s) => s.selectedAgent);
  const agentModels = useStore((s) => s.agentModels);
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);
  const selectedModel = selectedAgentId ? agentModels[selectedAgentId] ?? "default" : "default";

  return (
    <header className="iis-topbar">
      <div className="iis-topbar-left">
        <AppLogo />
        {(project || projectName) && projectId && (
          <nav className="iis-breadcrumbs" aria-label="Breadcrumb">
            <span>›</span>
            <Link href={`/projects/${projectId}/overview`}>{project?.name ?? projectName}</Link>
            {section && (
              <>
                <span>›</span>
                <strong>{section}</strong>
              </>
            )}
          </nav>
        )}
      </div>
      <div className="iis-topbar-actions">
        <IndustryAgentConnector
          selectedAgent={selectedAgent}
          selectedModel={selectedModel}
        />
        <button className="iis-icon-button" type="button" aria-label="Settings">
          <Settings size={21} />
        </button>
      </div>
    </header>
  );
}

function IndustryAgentConnector({
  selectedAgent,
  selectedModel,
}: {
  selectedAgent?: AgentInfo;
  selectedModel: string;
}) {
  const agents = useStore((s) => s.agents);
  const setAgents = useStore((s) => s.setAgents);
  const selectedAgentId = useStore((s) => s.selectedAgent);
  const setSelectedAgent = useStore((s) => s.setSelectedAgent);
  const agentModels = useStore((s) => s.agentModels);
  const setAgentModel = useStore((s) => s.setAgentModel);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const availableAgents = useMemo(
    () => agents.filter((agent) => agent.available && !agent.unsupported),
    [agents],
  );

  async function loadAgents() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agents", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as { agents?: AgentInfo[] };
      const nextAgents = payload.agents ?? [];
      setAgents(nextAgents);
      const available = nextAgents.filter((agent) => agent.available && !agent.unsupported);
      if (!available.find((agent) => agent.id === selectedAgentId) && available.length) {
        const preferred = available.find((agent) => agent.id === "claude") ?? available[0];
        setSelectedAgent(preferred?.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!agents.length) void loadAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="iis-agent-connector">
      <button
        className={selectedAgent ? "iis-button iis-button-muted connected" : "iis-button iis-button-muted"}
        type="button"
        onClick={() => setOpen((value) => !value)}
        title="Choose local CLI agent"
      >
        <Bot size={17} />
        {selectedAgent ? selectedAgent.label : loading ? "Scanning..." : "Connect CLI"}
        {selectedAgent && selectedModel !== "default" && <code>{selectedModel}</code>}
      </button>
      {open && (
        <div className="iis-agent-menu">
          <div className="iis-agent-menu-head">
            <strong>Generation Agent</strong>
            <button type="button" onClick={() => void loadAgents()} disabled={loading}>
              {loading ? "Scanning..." : "Rescan"}
            </button>
          </div>
          {error && <p className="iis-form-error">{error}</p>}
          {availableAgents.length ? (
            <div className="iis-agent-list">
              {availableAgents.map((agent) => {
                const selected = agent.id === selectedAgentId;
                return (
                  <button
                    key={agent.id}
                    className={selected ? "active" : ""}
                    type="button"
                    onClick={() => {
                      setSelectedAgent(agent.id);
                      setOpen(false);
                    }}
                  >
                    <span>
                      <strong>{agent.label}</strong>
                      <small>{agent.vendor}</small>
                    </span>
                    {selected && <em>Connected</em>}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="iis-agent-empty">No supported local CLI agents detected.</p>
          )}
          {selectedAgent && (
            <label className="iis-agent-model">
              Model
              <select
                value={agentModels[selectedAgent.id] ?? "default"}
                onChange={(event) => setAgentModel(selectedAgent.id, event.target.value)}
              >
                {selectedAgent.models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  );
}

export function ProjectShell({
  projectId,
  projectName,
  counts,
  section,
  children,
}: {
  projectId: string;
  projectName?: string;
  counts?: WorkspaceProjectCounts;
  section: string;
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    setSidebarCollapsed(localStorage.getItem("iis-sidebar-collapsed") === "true");
  }, []);

  function toggleSidebar() {
    setSidebarCollapsed((value) => {
      const next = !value;
      localStorage.setItem("iis-sidebar-collapsed", String(next));
      return next;
    });
  }

  return (
    <main className="iis-app">
      <AppTopBar projectId={projectId} projectName={projectName} section={section} />
      <div className={sidebarCollapsed ? "iis-project-frame collapsed" : "iis-project-frame"}>
        <ProjectSidebar
          projectId={projectId}
          counts={counts}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebar}
        />
        <section className="iis-page">{children}</section>
      </div>
    </main>
  );
}

export function ProjectSidebar({
  projectId,
  counts: workspaceCounts,
  collapsed = false,
  onToggleCollapsed,
}: {
  projectId: string;
  counts?: WorkspaceProjectCounts;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const pathname = usePathname();
  const state = useIndustryStore((s) => s);
  const counts = workspaceCounts ?? getProjectCounts(state, projectId);
  const items = [
    { id: "overview", label: "Overview", icon: Grid2X2, count: undefined },
    { id: "sources", label: "Sources", icon: Globe2, count: counts.sources },
    { id: "data", label: "Data", icon: Database, count: counts.dataItems },
    { id: "reports", label: "Reports", icon: FileText, count: counts.reports },
  ];
  return (
    <aside className={collapsed ? "iis-sidebar collapsed" : "iis-sidebar"}>
      <div>
        <div className="iis-sidebar-head">
          <div className="iis-sidebar-label">Project</div>
          <button
            className="iis-icon-button iis-sidebar-toggle"
            type="button"
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            title={collapsed ? "Expand navigation" : "Collapse navigation"}
            onClick={onToggleCollapsed ?? (() => {})}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <nav className="iis-nav">
          {items.map((item) => {
            const Icon = item.icon;
            const href = `/projects/${projectId}/${item.id}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={item.id}
                href={href}
                className={active ? "iis-nav-item active" : "iis-nav-item"}
                title={collapsed ? item.label : undefined}
                aria-label={item.label}
              >
                <Icon size={21} />
                <span>{item.label}</span>
                {typeof item.count === "number" && <em>{item.count}</em>}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="iis-sidebar-footer">
        <Link
          href="/"
          className="iis-sidebar-link"
          title={collapsed ? "Back to All Projects" : undefined}
          aria-label="Back to All Projects"
        >
          <ArrowLeft size={19} /> Back to All Projects
        </Link>
      </div>
    </aside>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="iis-page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="iis-page-actions">{actions}</div>}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  caption,
  icon,
}: {
  label: string;
  value: string | number;
  caption: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="iis-metric-card">
      <div className="iis-metric-label">
        {label}
        {icon}
      </div>
      <strong>{value}</strong>
      <span>{caption}</span>
    </div>
  );
}

export function EmptyStateAction({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link className="iis-empty-action" href={href}>
      <span>+</span>
      {children}
    </Link>
  );
}

export function StatusBadge({
  status,
}: {
  status: "completed" | "running" | "waiting" | "completed_with_warnings" | "failed" | "ready" | "draft" | "parsing";
}) {
  const map = {
    completed: "Completed",
    running: "Running",
    waiting: "Waiting",
    completed_with_warnings: "Completed with warnings",
    failed: "Failed",
    ready: "Ready",
    draft: "Draft",
    parsing: "Parsing",
  };
  return <span className={`iis-status ${status}`}>{map[status]}</span>;
}

export function ProjectMetaLine({ projectId }: { projectId: string }) {
  const project = useIndustryStore((s) => s.projects.find((p) => p.id === projectId));
  if (!project) return null;
  return (
    <div className="iis-meta-line">
      {project.tags.map((tag) => (
        <span key={tag}>{tag}</span>
      ))}
      <small>Updated {relativeTime(project.updatedAt)}</small>
    </div>
  );
}

export function SourceIcon({ type }: { type: string }) {
  if (type === "career_site") return <BriefcaseBusiness size={22} />;
  if (type === "upload") return <FileText size={22} />;
  if (type === "url_import") return <FolderOpen size={22} />;
  return <Globe2 size={22} />;
}

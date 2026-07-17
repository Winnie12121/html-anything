"use client";

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
  Home,
  Settings,
  ArrowLeft,
  RefreshCcw,
} from "lucide-react";
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
  const running = useIndustryStore((s) =>
    projectId
      ? s.runs.find((run) => run.projectId === projectId && run.status === "running")
      : s.runs.find((run) => run.status === "running"),
  );

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
        {running && <RunProgressChip progress={running.progress} />}
        <button className="iis-button iis-button-muted" type="button">
          <Bot size={17} /> Claude Code
        </button>
        <button className="iis-button iis-button-ghost" type="button">
          <FolderOpen size={18} /> Open Folder
        </button>
        <button className="iis-icon-button" type="button" aria-label="Settings">
          <Settings size={21} />
        </button>
      </div>
    </header>
  );
}

export function RunProgressChip({ progress }: { progress: number }) {
  return (
    <span className="iis-progress-chip">
      <RefreshCcw size={17} className="iis-spin-soft" />
      Collection running - {progress}%
    </span>
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
  return (
    <main className="iis-app">
      <AppTopBar projectId={projectId} projectName={projectName} section={section} />
      <div className="iis-project-frame">
        <ProjectSidebar projectId={projectId} counts={counts} />
        <section className="iis-page">{children}</section>
      </div>
    </main>
  );
}

export function ProjectSidebar({
  projectId,
  counts: workspaceCounts,
}: {
  projectId: string;
  counts?: WorkspaceProjectCounts;
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
    <aside className="iis-sidebar">
      <div>
        <div className="iis-sidebar-label">Project</div>
        <nav className="iis-nav">
          {items.map((item) => {
            const Icon = item.icon;
            const href = `/projects/${projectId}/${item.id}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link key={item.id} href={href} className={active ? "iis-nav-item active" : "iis-nav-item"}>
                <Icon size={21} />
                <span>{item.label}</span>
                {typeof item.count === "number" && <em>{item.count}</em>}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="iis-sidebar-footer">
        <button className="iis-sidebar-link" type="button">
          <Settings size={19} /> Project Settings
        </button>
        <Link href="/" className="iis-sidebar-link">
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

"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Building2, Database, FileText, Globe2, RefreshCcw } from "lucide-react";
import {
  MetricCard,
  PageHeader,
  ProjectMetaLine,
  ProjectShell,
} from "./shell";
import { getProjectCounts, useIndustryStore } from "@/lib/industry/store";
import { relativeTime } from "@/lib/industry/format";
import type { WorkspaceProjectSummary } from "@/lib/industry/workspace";

export function OverviewPage({
  projectId,
  projectSummary,
}: {
  projectId: string;
  projectSummary?: WorkspaceProjectSummary;
}) {
  const storeProject = useIndustryStore((s) => s.projects.find((p) => p.id === projectId));
  const state = useIndustryStore((s) => s);
  const startDemoRun = useIndustryStore((s) => s.startDemoRun);
  const allSources = useIndustryStore((s) => s.sources);
  const allActivity = useIndustryStore((s) => s.activity);
  const sources = useMemo(
    () => allSources.filter((source) => source.projectId === projectId),
    [allSources, projectId],
  );
  const activity = useMemo(
    () => allActivity.filter((item) => item.projectId === projectId).slice(0, 6),
    [allActivity, projectId],
  );
  const project = projectSummary?.project ?? storeProject;
  const counts = projectSummary?.counts ?? getProjectCounts(state, projectId);

  if (!project) return <MissingProject />;

  return (
    <ProjectShell
      projectId={projectId}
      projectName={project.name}
      counts={projectSummary?.counts}
      section="Overview"
    >
      <PageHeader
        title={project.name}
        actions={
          <button
            className="iis-button iis-button-ghost"
            type="button"
            onClick={() => startDemoRun(projectId, sources.filter((s) => s.enabled).map((s) => s.id))}
          >
            <RefreshCcw size={18} /> Run Collection
          </button>
        }
      />
      {projectSummary ? (
        <WorkspaceProjectMetaLine projectSummary={projectSummary} />
      ) : (
        <ProjectMetaLine projectId={projectId} />
      )}

      <div className="iis-metric-grid">
        <MetricCard label="Companies" value={counts.companies} caption="Tracked" icon={<Building2 size={22} />} />
        <MetricCard label="Data Items" value={counts.dataItems} caption="Collected" icon={<Database size={22} />} />
        <MetricCard label="Reports" value={counts.reports} caption="Generated" icon={<FileText size={22} />} />
        <MetricCard label="Sources" value={counts.sources} caption="Configured" icon={<Globe2 size={22} />} />
      </div>

      <div className="iis-action-grid">
        <WorkflowCard href={`/projects/${projectId}/sources`} icon={<Globe2 size={24} />} title="Collect Data">
          Run external sources or upload files
        </WorkflowCard>
        <WorkflowCard href={`/projects/${projectId}/data`} icon={<Database size={24} />} title="Select Data">
          Browse and select data for a report
        </WorkflowCard>
        <WorkflowCard href={`/projects/${projectId}/reports/new`} icon={<FileText size={24} />} title="Create Report">
          Generate an HTML insight report
        </WorkflowCard>
      </div>

      <section className="iis-card iis-activity">
        <header>
          <h2>Recent Activity</h2>
          <span>↗</span>
        </header>
        {activity.map((item) => (
          <div key={item.id} className="iis-activity-row">
            <span className={`iis-activity-dot ${item.tone}`} />
            <strong>{item.label}</strong>
            <em>{relativeTime(item.createdAt)}</em>
          </div>
        ))}
      </section>
    </ProjectShell>
  );
}

function WorkspaceProjectMetaLine({
  projectSummary,
}: {
  projectSummary: WorkspaceProjectSummary;
}) {
  const updatedAt = Date.parse(projectSummary.project.updatedAt);
  return (
    <div className="iis-meta-line">
      {projectSummary.project.tags.map((tag) => (
        <span key={tag}>{tag}</span>
      ))}
      <small>
        Updated {Number.isFinite(updatedAt) ? relativeTime(updatedAt) : "-"}
      </small>
    </div>
  );
}

function WorkflowCard({
  href,
  icon,
  title,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Link className="iis-workflow-card" href={href}>
      <span>{icon}</span>
      <div>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
    </Link>
  );
}

function MissingProject() {
  return (
    <main className="iis-app">
      <div className="iis-missing">
        <h1>Project not found</h1>
        <Link className="iis-button iis-button-primary" href="/">
          Back to projects
        </Link>
      </div>
    </main>
  );
}

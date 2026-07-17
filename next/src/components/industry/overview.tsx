"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Building2, Database, FileText, Globe2, RefreshCcw } from "lucide-react";
import {
  MetricCard,
  PageHeader,
  ProjectShell,
} from "./shell";
import { getProjectCounts, useIndustryStore } from "@/lib/industry/store";
import { relativeTime } from "@/lib/industry/format";
import type {
  WorkspaceActivityItem,
  WorkspaceOverview,
} from "@/lib/industry/workspace";

export function OverviewPage({
  projectId,
  overview,
}: {
  projectId: string;
  overview?: WorkspaceOverview;
}) {
  const storeProject = useIndustryStore((s) => s.projects.find((p) => p.id === projectId));
  const state = useIndustryStore((s) => s);
  const project = overview?.project ?? storeProject;
  const counts = overview?.counts ?? getProjectCounts(state, projectId);
  const allStoreActivity = useIndustryStore((s) => s.activity);
  const fallbackActivity = useMemo(
    () =>
      allStoreActivity
        .filter((item) => item.projectId === projectId)
        .slice(0, 6)
        .map((item) => ({
          id: item.id,
          label: item.label,
          tone: item.tone,
          createdAt: new Date(item.createdAt).toISOString(),
        })),
    [allStoreActivity, projectId],
  );
  const activity = overview?.activity ?? fallbackActivity;

  if (!project) return <MissingProject />;

  return (
    <ProjectShell
      projectId={projectId}
      projectName={project.name}
      counts={overview?.counts}
      section="Overview"
    >
      <PageHeader
        title={project.name}
        actions={
          <Link
            className="iis-button iis-button-ghost"
            href={`/projects/${projectId}/sources`}
          >
            <RefreshCcw size={18} /> Run Collection
          </Link>
        }
      />
      <WorkspaceProjectMetaLine
        tags={project.tags}
        updatedAt={typeof project.updatedAt === "number" ? project.updatedAt : Date.parse(project.updatedAt)}
      />

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
        {activity.length ? (
          activity.map((item) => <ActivityRow key={item.id} item={item} />)
        ) : (
          <div className="iis-activity-row">
            <span className="iis-activity-dot info" />
            <strong>No collection activity yet</strong>
            <em>-</em>
          </div>
        )}
      </section>
    </ProjectShell>
  );
}

function WorkspaceProjectMetaLine({
  tags,
  updatedAt,
}: {
  tags: string[];
  updatedAt: number;
}) {
  return (
    <div className="iis-meta-line">
      {tags.map((tag) => (
        <span key={tag}>{tag}</span>
      ))}
      <small>
        Updated {Number.isFinite(updatedAt) ? relativeTime(updatedAt) : "-"}
      </small>
    </div>
  );
}

function ActivityRow({ item }: { item: WorkspaceActivityItem }) {
  const createdAt = Date.parse(item.createdAt);
  return (
    <div className="iis-activity-row">
      <span className={`iis-activity-dot ${item.tone}`} />
      <strong>{item.label}</strong>
      <em>{Number.isFinite(createdAt) ? relativeTime(createdAt) : "-"}</em>
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

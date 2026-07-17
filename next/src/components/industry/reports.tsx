"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, FileText, Plus } from "lucide-react";
import type { WorkspaceReportsView } from "@/lib/industry/workspace/client";
import { relativeTime } from "@/lib/industry/format";
import { EmptyStateAction, PageHeader, ProjectShell, StatusBadge } from "./shell";

export function ReportsPage({
  projectId,
  reportsView,
}: {
  projectId: string;
  reportsView: WorkspaceReportsView;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <ProjectShell
      projectId={projectId}
      projectName={reportsView.project.name}
      counts={reportsView.counts}
      section="Reports"
    >
      <PageHeader
        title="Reports"
        description="Generated HTML insight reports for this project."
        actions={
          <Link className="iis-button iis-button-primary" href={`/projects/${projectId}/reports/new`}>
            <Plus size={19} /> New Report
          </Link>
        }
      />
      <div className="iis-report-list">
        {reportsView.reports.map((report) => (
          <article key={report.slug} className="iis-report-card">
            <div className="iis-report-icon">
              <FileText size={22} />
            </div>
            <div>
              <h2>{report.name}</h2>
              <div className="iis-chip-row">
                <span>{templateLabel(report.templateId)}</span>
                <span>{report.language}</span>
                {report.status === "draft" && <StatusBadge status="draft" />}
              </div>
              <p>
                <FileText size={17} /> {report.sections.length} sections
                <span>
                  <Clock size={17} /> Updated {mounted ? relativeTime(Date.parse(report.updatedAt)) : "-"}
                </span>
              </p>
            </div>
            <Link
              className="iis-button iis-button-ghost"
              href={`/projects/${projectId}/reports/${report.slug}/studio`}
            >
              Open Studio
            </Link>
          </article>
        ))}
      </div>
      <EmptyStateAction href={`/projects/${projectId}/reports/new`}>
        Create a new report from your selected data
      </EmptyStateAction>
    </ProjectShell>
  );
}

function templateLabel(id: string) {
  const labels: Record<string, string> = {
    "competitor-hiring-comparison": "Competitor Hiring Comparison",
    "executive-industry-brief": "Executive Industry Brief",
    "talent-market-dashboard": "Talent Market Dashboard",
  };
  return labels[id] ?? id;
}

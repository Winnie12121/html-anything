"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { EmptyStateAction, PageHeader, ProjectShell, StatusBadge } from "./shell";
import { relativeTime } from "@/lib/industry/format";
import { useIndustryStore } from "@/lib/industry/store";

export function ReportsPage({ projectId }: { projectId: string }) {
  const allReports = useIndustryStore((s) => s.reports);
  const reports = useMemo(
    () => allReports.filter((report) => report.projectId === projectId),
    [allReports, projectId],
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <ProjectShell projectId={projectId} section="Reports">
      <PageHeader
        title="Reports"
        description="Generated HTML insight reports for this project."
        actions={
          <Link className="iis-button iis-button-primary" href={`/projects/${projectId}/reports/new`}>
            <Plus size={19} /> New Report
          </Link>
        }
      />
      <div className="grid gap-4">
        {reports.map((report) => (
          <article key={report.id} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-4 rounded-lg border border-[var(--iis-border)] bg-white px-6 py-5">
            <div className="grid h-11 w-11 place-items-center rounded-md bg-[#e9f1fa] text-[var(--iis-accent)]"><FileText size={22} /></div>
            <div className="min-w-0">
              <h2 className="m-0 text-[17px] font-semibold leading-tight">{report.name}</h2>
              <div className="iis-chip-row">
                <span>{templateLabel(report.templateId)}</span>
                <span>{report.language}</span>
                {report.status === "draft" && <StatusBadge status="draft" />}
              </div>
              <p className="mt-3 flex items-center gap-5 text-[13px] text-[var(--iis-muted)]">
                <FileText size={17} /> {report.sections.length || 4} sections
                <span>Updated {mounted ? relativeTime(report.updatedAt) : "-"}</span>
              </p>
            </div>
            <Link className="iis-button iis-button-ghost" href={`/projects/${projectId}/reports/${report.id}/studio`}>
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

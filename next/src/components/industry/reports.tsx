"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, FileText, Plus, Trash2 } from "lucide-react";
import type { WorkspaceReportsView } from "@/lib/industry/workspace/client";
import { relativeTime } from "@/lib/industry/format";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { EmptyStateAction, PageHeader, ProjectShell, StatusBadge } from "./shell";

export function ReportsPage({
  projectId,
  reportsView,
}: {
  projectId: string;
  reportsView: WorkspaceReportsView;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  const [pendingDeleteReport, setPendingDeleteReport] = useState<
    WorkspaceReportsView["reports"][number] | null
  >(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function deleteReport(report: WorkspaceReportsView["reports"][number]) {
    setDeletingReportId(report.slug);
    setDeleteError(null);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/reports/${encodeURIComponent(report.slug)}`,
        { method: "DELETE" },
      );
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "Report deletion failed");
      }
      setPendingDeleteReport(null);
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingReportId(null);
    }
  }

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
            <button
              className="iis-icon-button iis-button-danger"
              type="button"
              title="Delete report"
              aria-label={`Delete report ${report.name}`}
              disabled={deletingReportId === report.slug}
              onClick={() => setPendingDeleteReport(report)}
            >
              <Trash2 size={18} />
            </button>
          </article>
        ))}
      </div>
      {deleteError && <p className="iis-form-error">{deleteError}</p>}
      <EmptyStateAction href={`/projects/${projectId}/reports/new`}>
        Create a new report from your selected data
      </EmptyStateAction>
      {pendingDeleteReport && (
        <ConfirmDeleteDialog
          title="Delete report"
          message={`Delete report "${pendingDeleteReport.name}"? This cannot be undone.`}
          busy={deletingReportId === pendingDeleteReport.slug}
          onCancel={() => setPendingDeleteReport(null)}
          onConfirm={() => void deleteReport(pendingDeleteReport)}
        />
      )}
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

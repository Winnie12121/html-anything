import { ReportStudioPage } from "@/components/industry/report-studio";
import { readWorkspaceReportStudio } from "@/lib/industry/workspace";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string; reportId: string }>;
}) {
  const { projectId, reportId } = await params;
  const studioView = await readWorkspaceReportStudio(projectId, reportId);
  return (
    <ReportStudioPage
      projectId={projectId}
      reportId={reportId}
      studioView={studioView}
    />
  );
}

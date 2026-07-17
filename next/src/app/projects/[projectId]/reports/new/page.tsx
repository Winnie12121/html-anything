import { ReportSetupPage } from "@/components/industry/report-setup";
import { readWorkspaceReportSetup } from "@/lib/industry/workspace";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const setupView = await readWorkspaceReportSetup(projectId);
  return <ReportSetupPage projectId={projectId} setupView={setupView} />;
}

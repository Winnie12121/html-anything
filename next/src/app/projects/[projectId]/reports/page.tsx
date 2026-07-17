import { ReportsPage } from "@/components/industry/reports";
import { readWorkspaceReports } from "@/lib/industry/workspace";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const reportsView = await readWorkspaceReports(projectId);
  return <ReportsPage projectId={projectId} reportsView={reportsView} />;
}

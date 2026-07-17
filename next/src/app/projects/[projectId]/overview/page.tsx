import { OverviewPage } from "@/components/industry/overview";
import { readWorkspaceProject } from "@/lib/industry/workspace";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const projectSummary = await readWorkspaceProject(projectId).catch(() => undefined);
  return <OverviewPage projectId={projectId} projectSummary={projectSummary} />;
}

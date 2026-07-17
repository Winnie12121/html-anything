import { OverviewPage } from "@/components/industry/overview";
import { readWorkspaceOverview } from "@/lib/industry/workspace";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const overview = await readWorkspaceOverview(projectId).catch(() => undefined);
  return <OverviewPage projectId={projectId} overview={overview} />;
}

import { DataWorkspacePage } from "@/components/industry/data-workspace";
import { readWorkspaceData } from "@/lib/industry/workspace";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const dataView = await readWorkspaceData(projectId).catch(() => undefined);
  return <DataWorkspacePage projectId={projectId} dataView={dataView} />;
}

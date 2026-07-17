import { SourcesPage } from "../../../../components/industry/sources";
import { readWorkspaceSources } from "@/lib/industry/workspace";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const sourcesView = await readWorkspaceSources(projectId).catch(() => undefined);
  return <SourcesPage projectId={projectId} sourcesView={sourcesView} />;
}

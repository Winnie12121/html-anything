import { DataWorkspacePage } from "@/components/industry/data-workspace";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <DataWorkspacePage projectId={projectId} />;
}

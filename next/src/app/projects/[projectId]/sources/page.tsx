import { SourcesPage } from "@/components/industry/sources";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <SourcesPage projectId={projectId} />;
}

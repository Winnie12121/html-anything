import { ReportsPage } from "@/components/industry/reports";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ReportsPage projectId={projectId} />;
}

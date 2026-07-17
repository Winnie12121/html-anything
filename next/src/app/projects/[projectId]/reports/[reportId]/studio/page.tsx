import { ReportStudioPage } from "@/components/industry/report-studio";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string; reportId: string }>;
}) {
  const { projectId, reportId } = await params;
  return <ReportStudioPage projectId={projectId} reportId={reportId} />;
}

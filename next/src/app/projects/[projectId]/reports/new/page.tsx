import { ReportSetupPage } from "@/components/industry/report-setup";

export default async function Page({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ReportSetupPage projectId={projectId} />;
}

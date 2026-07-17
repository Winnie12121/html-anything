import { createWorkspaceReport } from "@/lib/industry/workspace";

type GenerateReportBody = {
  name?: unknown;
  templateId?: unknown;
  audience?: unknown;
  language?: unknown;
  goal?: unknown;
  includedInsightIds?: unknown;
};

export async function POST(
  request: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await ctx.params;
  const body = (await request.json()) as GenerateReportBody;

  if (typeof body.name !== "string" || !body.name.trim()) {
    return Response.json({ error: "Report name is required" }, { status: 400 });
  }
  if (typeof body.templateId !== "string" || !body.templateId.trim()) {
    return Response.json({ error: "Template is required" }, { status: 400 });
  }

  try {
    const result = await createWorkspaceReport(projectId, {
      name: body.name,
      templateId: body.templateId,
      audience: typeof body.audience === "string" ? body.audience : "",
      language: typeof body.language === "string" ? body.language : "English",
      goal: typeof body.goal === "string" ? body.goal : "",
      includedInsightIds: Array.isArray(body.includedInsightIds)
        ? body.includedInsightIds.filter((id): id is string => typeof id === "string")
        : [],
    });
    return Response.json({
      reportId: result.report.id,
      reportSlug: result.reportSlug,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to generate report" },
      { status: 500 },
    );
  }
}

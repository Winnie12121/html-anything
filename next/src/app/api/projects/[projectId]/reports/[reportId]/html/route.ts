import { saveWorkspaceReportHtml } from "@/lib/industry/workspace";

type SaveHtmlBody = {
  html?: unknown;
};

export async function PUT(
  request: Request,
  ctx: { params: Promise<{ projectId: string; reportId: string }> },
) {
  const { projectId, reportId } = await ctx.params;
  const body = (await request.json()) as SaveHtmlBody;

  if (typeof body.html !== "string") {
    return Response.json({ error: "HTML content is required" }, { status: 400 });
  }

  try {
    const report = await saveWorkspaceReportHtml(projectId, reportId, {
      html: body.html,
    });
    return Response.json({ updatedAt: report.updatedAt });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to save report HTML" },
      { status: 500 },
    );
  }
}

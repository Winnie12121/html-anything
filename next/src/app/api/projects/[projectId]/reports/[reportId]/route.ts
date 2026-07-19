import { deleteWorkspaceReport } from "@/lib/industry/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ projectId: string; reportId: string }> },
) {
  const { projectId, reportId } = await ctx.params;

  try {
    await deleteWorkspaceReport(projectId, reportId);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to delete report" },
      { status: statusForWorkspaceDeleteError(error) },
    );
  }
}

function statusForWorkspaceDeleteError(error: unknown): number {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "ENOENT") return 404;
  if (
    error instanceof Error &&
    (error.message.startsWith("Invalid project slug") ||
      error.message.startsWith("Invalid report slug"))
  ) {
    return 400;
  }
  return 500;
}

import { deleteWorkspaceProject } from "@/lib/industry/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await ctx.params;

  try {
    await deleteWorkspaceProject(projectId);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to delete project" },
      { status: statusForWorkspaceDeleteError(error) },
    );
  }
}

function statusForWorkspaceDeleteError(error: unknown): number {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "ENOENT") return 404;
  if (error instanceof Error && error.message.startsWith("Invalid project slug")) {
    return 400;
  }
  return 500;
}

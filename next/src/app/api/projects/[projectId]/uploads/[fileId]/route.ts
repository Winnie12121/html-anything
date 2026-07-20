import { NextResponse } from "next/server";
import { deleteWorkspaceUpload } from "@/lib/industry/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ projectId: string; fileId: string }> },
) {
  const { projectId, fileId } = await ctx.params;

  try {
    const uploads = await deleteWorkspaceUpload(projectId, fileId);
    return NextResponse.json({ uploads });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete upload" },
      { status: (error as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 500 },
    );
  }
}

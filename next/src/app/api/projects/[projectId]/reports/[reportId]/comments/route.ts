import {
  addWorkspaceReportComment,
  resolveWorkspaceReportComment,
} from "@/lib/industry/workspace";

type AddCommentBody = {
  sectionId?: unknown;
  text?: unknown;
};

type ResolveCommentBody = {
  commentId?: unknown;
};

export async function POST(
  request: Request,
  ctx: { params: Promise<{ projectId: string; reportId: string }> },
) {
  const { projectId, reportId } = await ctx.params;
  const body = (await request.json()) as AddCommentBody;

  if (typeof body.sectionId !== "string" || !body.sectionId.trim()) {
    return Response.json({ error: "Section id is required" }, { status: 400 });
  }
  if (typeof body.text !== "string" || !body.text.trim()) {
    return Response.json({ error: "Comment text is required" }, { status: 400 });
  }

  try {
    const comment = await addWorkspaceReportComment(projectId, reportId, {
      sectionId: body.sectionId,
      text: body.text,
    });
    return Response.json({ comment });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to add comment" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ projectId: string; reportId: string }> },
) {
  const { projectId, reportId } = await ctx.params;
  const body = (await request.json()) as ResolveCommentBody;

  if (typeof body.commentId !== "string" || !body.commentId.trim()) {
    return Response.json({ error: "Comment id is required" }, { status: 400 });
  }

  try {
    const comments = await resolveWorkspaceReportComment(
      projectId,
      reportId,
      body.commentId,
    );
    return Response.json({ comments });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to resolve comment" },
      { status: 500 },
    );
  }
}

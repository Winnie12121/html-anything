import {
  addWorkspaceReportComment,
  resolveWorkspaceReportComment,
} from "@/lib/industry/workspace";

type AddCommentBody = {
  sectionId?: unknown;
  text?: unknown;
  general?: unknown;
  refs?: unknown;
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

  if (typeof body.text !== "string" || !body.text.trim()) {
    return Response.json({ error: "Comment text is required" }, { status: 400 });
  }
  const refs = parseCommentRefs(body.refs);
  const general = body.general === true;
  const sectionId = typeof body.sectionId === "string" && body.sectionId.trim()
    ? body.sectionId.trim()
    : undefined;

  if (!sectionId && !general && refs.length === 0) {
    return Response.json({ error: "Comment target is required" }, { status: 400 });
  }

  try {
    const comment = await addWorkspaceReportComment(projectId, reportId, {
      sectionId,
      general,
      refs,
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

function parseCommentRefs(value: unknown): Array<{ id: string; tag: string; snippet: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const ref = item as Record<string, unknown>;
      if (typeof ref.id !== "string" || !ref.id.trim()) return null;
      return {
        id: ref.id.trim(),
        tag: typeof ref.tag === "string" && ref.tag.trim() ? ref.tag.trim() : "element",
        snippet: typeof ref.snippet === "string" ? ref.snippet.trim().slice(0, 240) : "",
      };
    })
    .filter((item): item is { id: string; tag: string; snippet: string } => Boolean(item));
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

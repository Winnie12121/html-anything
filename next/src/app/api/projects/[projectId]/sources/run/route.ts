import { NextRequest, NextResponse } from "next/server";
import { runMockExternalCollection } from "@/lib/industry/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await ctx.params;
  let body: { sourceIds?: unknown };
  try {
    body = (await req.json()) as { sourceIds?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sourceIds = Array.isArray(body.sourceIds)
    ? body.sourceIds.filter((sourceId): sourceId is string => typeof sourceId === "string")
    : [];

  try {
    const result = await runMockExternalCollection(projectId, sourceIds);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

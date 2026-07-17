import { NextRequest, NextResponse } from "next/server";
import { writeCurrentSelection } from "@/lib/industry/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await ctx.params;
  let body: { selectedRecordRefs?: unknown };
  try {
    body = (await req.json()) as { selectedRecordRefs?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.selectedRecordRefs)) {
    return NextResponse.json(
      { error: "Missing required field: selectedRecordRefs" },
      { status: 400 },
    );
  }

  const selectedRecordRefs = body.selectedRecordRefs.filter(
    (ref): ref is string => typeof ref === "string",
  );

  try {
    const selection = await writeCurrentSelection(projectId, selectedRecordRefs);
    return NextResponse.json({ selection });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

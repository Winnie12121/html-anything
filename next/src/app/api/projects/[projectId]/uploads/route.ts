import { NextRequest, NextResponse } from "next/server";
import {
  ingestWorkspaceUpload,
  readWorkspaceUploads,
} from "@/lib/industry/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await ctx.params;

  try {
    const uploads = await readWorkspaceUploads(projectId);
    return NextResponse.json({ uploads });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await ctx.params;
  const form = await request.formData();
  const files = form
    .getAll("files")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length === 0) {
    return NextResponse.json(
      { error: "Upload at least one file." },
      { status: 400 },
    );
  }

  try {
    const results = [];
    for (const file of files) {
      results.push(await ingestWorkspaceUpload(projectId, file));
    }
    const uploads = await readWorkspaceUploads(projectId);
    return NextResponse.json({
      uploads,
      files: results.map((result) => result.file),
      recordsCreated: results.reduce((sum, result) => sum + result.records.length, 0),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

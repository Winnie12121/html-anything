import { NextRequest, NextResponse } from "next/server";
import {
  runExternalCollection,
  type WorkspaceRunEvent,
} from "@/lib/industry/workspace";

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

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function emit(event: WorkspaceRunEvent) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      }

      try {
        await runExternalCollection(projectId, sourceIds, { onEvent: emit });
      } catch (error) {
        controller.enqueue(
          encoder.encode(JSON.stringify({
            type: "failed",
            error: error instanceof Error ? error.message : String(error),
          }) + "\n"),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 201,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

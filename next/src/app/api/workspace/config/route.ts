import { NextRequest } from "next/server";
import {
  ensureWorkspaceRoot,
  readAppWorkspaceConfig,
  writeAppWorkspaceConfig,
} from "@/lib/industry/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = await readAppWorkspaceConfig();
  await ensureWorkspaceRoot(config.workspaceRoot);
  return Response.json(config);
}

export async function PUT(req: NextRequest) {
  let body: { workspaceRoot?: unknown };
  try {
    body = (await req.json()) as { workspaceRoot?: unknown };
  } catch {
    return new Response("invalid JSON body", { status: 400 });
  }

  if (typeof body.workspaceRoot !== "string" || !body.workspaceRoot.trim()) {
    return new Response("missing required field: workspaceRoot", { status: 400 });
  }

  const config = await writeAppWorkspaceConfig(body.workspaceRoot.trim());
  await ensureWorkspaceRoot(config.workspaceRoot);
  return Response.json(config);
}

import { invokeAgent } from "@/lib/agents/invoke";
import { extractHtml } from "@/lib/extract-html";
import {
  buildWorkspaceReportRegenerationPrompt,
  configuredWorkspaceRoot,
  projectPath,
  safeJoin,
  saveRegeneratedWorkspaceReportHtml,
} from "@/lib/industry/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RegenerateReportBody = {
  instruction?: unknown;
  commentIds?: unknown;
  agent?: unknown;
  model?: unknown;
  binOverride?: unknown;
};

export async function POST(
  request: Request,
  ctx: { params: Promise<{ projectId: string; reportId: string }> },
) {
  const { projectId, reportId } = await ctx.params;
  const body = (await request.json()) as RegenerateReportBody;
  const agent = typeof body.agent === "string" && body.agent.trim()
    ? body.agent.trim()
    : undefined;

  if (!agent) {
    return Response.json({ error: "CLI agent is required for regeneration" }, { status: 400 });
  }

  try {
    const prompt = await buildWorkspaceReportRegenerationPrompt(projectId, reportId, {
      instruction: typeof body.instruction === "string" ? body.instruction : undefined,
      commentIds: Array.isArray(body.commentIds)
        ? body.commentIds.filter((id): id is string => typeof id === "string")
        : undefined,
    });
    const workspaceRoot = await configuredWorkspaceRoot();
    const cwd = safeJoin(workspaceRoot, projectPath(projectId));
    const abortCtl = new AbortController();
    request.signal?.addEventListener("abort", () => abortCtl.abort(), { once: true });
    const streamed = await collectAgentOutput({
      agent,
      prompt,
      cwd,
      model: typeof body.model === "string" && body.model !== "default"
        ? body.model
        : undefined,
      binOverride: typeof body.binOverride === "string" ? body.binOverride : undefined,
      signal: abortCtl.signal,
    });
    const html = extractHtml(streamed);
    if (!html.trim()) throw new Error("Agent returned empty report HTML");

    const result = await saveRegeneratedWorkspaceReportHtml(projectId, reportId, { html });
    return Response.json({
      html,
      updatedAt: result.report.updatedAt,
      snapshotPath: result.snapshotPath,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to regenerate report";
    return Response.json({ error: message }, { status: message.includes("unresolved comment") ? 400 : 500 });
  }
}

async function collectAgentOutput(opts: {
  agent: string;
  prompt: string;
  cwd: string;
  model?: string;
  binOverride?: string;
  signal: AbortSignal;
}): Promise<string> {
  const stream = invokeAgent(opts);
  const reader = stream.getReader();
  let output = "";
  let stderr = "";
  let exitCode: number | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;

    if (value.type === "delta") output += value.text;
    else if (value.type === "html") output = value.text;
    else if (value.type === "stderr") stderr += value.text;
    else if (value.type === "done") exitCode = value.code;
    else if (value.type === "error") throw new Error(value.message);
  }

  if (exitCode !== null && exitCode !== 0) {
    const detail = stderr.trim() ? `: ${stderr.trim().slice(0, 500)}` : "";
    throw new Error(`Agent exited with code ${exitCode}${detail}`);
  }
  if (!output.trim()) {
    throw new Error("Agent returned empty report HTML");
  }

  return output;
}

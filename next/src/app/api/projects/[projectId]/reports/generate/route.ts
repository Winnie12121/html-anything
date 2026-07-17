import { invokeAgent } from "@/lib/agents/invoke";
import { extractHtml } from "@/lib/extract-html";
import {
  buildWorkspaceReportGenerationPrompt,
  configuredWorkspaceRoot,
  createWorkspaceReport,
  projectPath,
  safeJoin,
} from "@/lib/industry/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GenerateReportBody = {
  name?: unknown;
  templateId?: unknown;
  audience?: unknown;
  language?: unknown;
  goal?: unknown;
  includedInsightIds?: unknown;
  agent?: unknown;
  model?: unknown;
  binOverride?: unknown;
};

export async function POST(
  request: Request,
  ctx: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await ctx.params;
  const body = (await request.json()) as GenerateReportBody;

  if (typeof body.name !== "string" || !body.name.trim()) {
    return Response.json({ error: "Report name is required" }, { status: 400 });
  }
  if (typeof body.templateId !== "string" || !body.templateId.trim()) {
    return Response.json({ error: "Template is required" }, { status: 400 });
  }

  try {
    const reportInput = {
      name: body.name,
      templateId: body.templateId,
      audience: typeof body.audience === "string" ? body.audience : "",
      language: typeof body.language === "string" ? body.language : "English",
      goal: typeof body.goal === "string" ? body.goal : "",
      includedInsightIds: Array.isArray(body.includedInsightIds)
        ? body.includedInsightIds.filter((id): id is string => typeof id === "string")
        : [],
    };
    const agent = typeof body.agent === "string" && body.agent.trim()
      ? body.agent.trim()
      : undefined;
    let generatedHtml: string | undefined;

    if (agent) {
      const workspaceRoot = await configuredWorkspaceRoot();
      const prompt = await buildWorkspaceReportGenerationPrompt(projectId, reportInput);
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
        binOverride: typeof body.binOverride === "string"
          ? body.binOverride
          : undefined,
        signal: abortCtl.signal,
      });
      generatedHtml = extractHtml(streamed);
    }

    const result = await createWorkspaceReport(projectId, {
      ...reportInput,
      generatedHtml,
    });
    return Response.json({
      reportId: result.report.id,
      reportSlug: result.reportSlug,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to generate report" },
      { status: 500 },
    );
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

import path from "node:path";
import {
  appendJsonl,
  ensureDir,
  listDirectories,
  readJsonFile,
  readJsonlFile,
  writeJsonFile,
  writeTextFile,
} from "./fs";
import { projectPath, toWorkspaceSlug } from "./paths";
import { configuredWorkspaceRoot, readWorkspaceProject } from "./projects";
import { readLiepinSampleRecords, type LiepinJobRecord } from "./liepin";
import type { WorkspaceSourcesView } from "./client";
import type {
  WorkspaceProject,
  WorkspaceRunManifest,
  WorkspaceSourceConfig,
} from "./schema";

export type MockCollectionResult = {
  run: WorkspaceRunManifest;
  recordsCreated: number;
};

export type WorkspaceRunEvent = {
  type: "started" | "progress" | "log" | "completed" | "failed";
  run: WorkspaceRunManifest;
  message?: string;
  sourceId?: string;
  recordsCreated?: number;
  error?: string;
};

type RunOptions = {
  root?: string;
  fetchImpl?: typeof fetch;
  tavilyApiKey?: string;
  onEvent?: (event: WorkspaceRunEvent) => void | Promise<void>;
};

type WorkspaceRecord = LiepinJobRecord | TavilyWebpageRecord;

type TavilyWebpageRecord = {
  id: string;
  sourceId: "tavily";
  kind: "web_page";
  title: string;
  summary: string;
  fields: Record<string, string | number | boolean | string[] | null>;
  rawText: string;
  url?: string;
  createdAt: string;
};

type TavilySearchResponse = {
  answer?: string;
  request_id?: string;
  response_time?: number;
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    raw_content?: string;
    score?: number;
    published_date?: string;
  }>;
};

export async function readWorkspaceSources(
  projectSlug: string,
  root?: string,
): Promise<WorkspaceSourcesView> {
  const workspaceRoot = root ?? (await configuredWorkspaceRoot());
  const projectSummary = await readWorkspaceProject(projectSlug, workspaceRoot);
  const [sourceConfig, runs] = await Promise.all([
    readJsonFile<WorkspaceSourceConfig>(
      workspaceRoot,
      projectPath(projectSlug, "source-config.json"),
    ),
    readWorkspaceRuns(workspaceRoot, projectSlug),
  ]);

  return {
    project: projectSummary.project,
    counts: projectSummary.counts,
    sourceConfig,
    runs,
  };
}

export async function runMockExternalCollection(
  projectSlug: string,
  sourceIds: string[],
  root?: string,
): Promise<MockCollectionResult> {
  return runExternalCollection(projectSlug, sourceIds, { root });
}

export async function runExternalCollection(
  projectSlug: string,
  sourceIds: string[],
  options: RunOptions = {},
): Promise<MockCollectionResult> {
  const workspaceRoot = options.root ?? (await configuredWorkspaceRoot());
  const fetchImpl = options.fetchImpl ?? fetch;
  const sourceConfig = await readJsonFile<WorkspaceSourceConfig>(
    workspaceRoot,
    projectPath(projectSlug, "source-config.json"),
  );
  const knownIds = new Set(sourceConfig.sources.map((source) => source.id));
  const enabledIds = new Set(
    sourceConfig.sources
      .filter((source) => source.enabled)
      .map((source) => source.id),
  );
  const selectedSourceIds = sourceIds.length
    ? sourceIds.filter((sourceId) => knownIds.has(sourceId))
    : [...enabledIds];

  if (!selectedSourceIds.length) {
    throw new Error("No valid sources selected");
  }

  const runId = await nextRunId(workspaceRoot, projectSlug);
  const startedAt = new Date().toISOString();
  await ensureDir(path.join(workspaceRoot, projectPath(projectSlug, "runs", runId)));

  let manifest: WorkspaceRunManifest = {
    id: runId,
    sourceIds: selectedSourceIds,
    status: "running",
    progress: 3,
    startedAt,
    recordsCreated: 0,
    warnings: [],
  };

  async function updateRun(
    patch: Partial<WorkspaceRunManifest>,
    event: Omit<WorkspaceRunEvent, "run">,
  ) {
    manifest = { ...manifest, ...patch };
    await writeRunManifest(workspaceRoot, projectSlug, manifest);
    await appendRunEvent(workspaceRoot, projectSlug, manifest.id, event.message ?? event.type);
    await appendRunLog(
      workspaceRoot,
      projectSlug,
      manifest.id,
      event.type === "failed" ? "error" : "info",
      event.message ?? event.type,
    );
    await options.onEvent?.({ ...event, run: manifest });
  }

  try {
    await updateRun({ progress: 5 }, {
      type: "started",
      message: "Collection started",
    });

    if (selectedSourceIds.includes("liepin")) {
      await updateRun({ progress: 12 }, {
        type: "progress",
        sourceId: "liepin",
        message: "Loading Liepin CSV sample",
      });
      const records = await readLiepinSampleRecords(new Date().toISOString());
      const written = await upsertJsonlRecords<LiepinJobRecord>(
        workspaceRoot,
        projectPath(projectSlug, "sources/external/normalized/jobs.jsonl"),
        records,
      );
      await updateRun(
        {
          progress: selectedSourceIds.includes("tavily") ? 45 : 95,
          recordsCreated: manifest.recordsCreated + records.length,
        },
        {
          type: "log",
          sourceId: "liepin",
          recordsCreated: records.length,
          message: `Liepin CSV normalized ${records.length} records (${written} new or updated)`,
        },
      );
    }

    if (selectedSourceIds.includes("tavily")) {
      const tavilySource = sourceConfig.sources.find((source) => source.id === "tavily");
      const topics = Array.isArray(tavilySource?.config.topics)
        ? tavilySource.config.topics.filter((topic): topic is string => typeof topic === "string")
        : [];
      const key = options.tavilyApiKey ?? process.env.TAVILY_API_KEY;
      if (!key) {
        throw new Error("TAVILY_API_KEY is required to run Tavily Search");
      }
      if (!topics.length) {
        throw new Error("Tavily Search requires at least one configured topic");
      }

      await updateRun({ progress: Math.max(manifest.progress, 50) }, {
        type: "progress",
        sourceId: "tavily",
        message: `Running Tavily Search for ${topics.length} topics`,
      });

      const tavilyRecords: TavilyWebpageRecord[] = [];
      for (const [index, topic] of topics.entries()) {
        const progress = 50 + Math.round((index / topics.length) * 40);
        await updateRun({ progress }, {
          type: "progress",
          sourceId: "tavily",
          message: `Searching: ${topic}`,
        });
        const response = await searchTavily(fetchImpl, key, topic);
        const reportPath = projectPath(
          projectSlug,
          "sources/external/raw/tavily",
          runId,
          `${topicSlug(topic)}.md`,
        );
        await writeTextFile(
          workspaceRoot,
          reportPath,
          tavilyMarkdownReport(topic, response),
        );
        tavilyRecords.push(tavilyResponseToRecord({
          topic,
          runId,
          reportPath: workspaceRelativeProjectPath(reportPath, projectSlug),
          response,
          createdAt: new Date().toISOString(),
        }));
      }

      const written = await upsertJsonlRecords<TavilyWebpageRecord>(
        workspaceRoot,
        projectPath(projectSlug, "sources/external/normalized/webpages.jsonl"),
        tavilyRecords,
      );
      await updateRun(
        {
          progress: 95,
          recordsCreated: manifest.recordsCreated + tavilyRecords.length,
        },
        {
          type: "log",
          sourceId: "tavily",
          recordsCreated: tavilyRecords.length,
          message: `Tavily Search wrote ${tavilyRecords.length} markdown reports (${written} new or updated)`,
        },
      );
    }

    const endedAt = new Date().toISOString();
    await updateRun(
      {
        status: manifest.warnings.length ? "completed_with_warnings" : "completed",
        progress: 100,
        endedAt,
      },
      {
        type: "completed",
        recordsCreated: manifest.recordsCreated,
        message: `Collection completed with ${manifest.recordsCreated} records`,
      },
    );
    await updateSourceConfigLastRun(workspaceRoot, projectSlug, sourceConfig, selectedSourceIds, runId);
    await touchProject(workspaceRoot, projectSlug, endedAt);
    return { run: manifest, recordsCreated: manifest.recordsCreated };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const endedAt = new Date().toISOString();
    await updateRun(
      {
        status: "failed",
        progress: Math.max(manifest.progress, 100),
        endedAt,
        warnings: [...manifest.warnings, message],
      },
      {
        type: "failed",
        error: message,
        message,
      },
    );
    await updateSourceConfigLastRun(workspaceRoot, projectSlug, sourceConfig, selectedSourceIds, runId);
    await touchProject(workspaceRoot, projectSlug, endedAt);
    return { run: manifest, recordsCreated: manifest.recordsCreated };
  }
}

async function readWorkspaceRuns(
  root: string,
  projectSlug: string,
): Promise<WorkspaceRunManifest[]> {
  let runIds: string[];
  try {
    runIds = await listDirectories(root, projectPath(projectSlug, "runs"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const runs: WorkspaceRunManifest[] = [];
  for (const runId of runIds) {
    try {
      runs.push(
        await readJsonFile<WorkspaceRunManifest>(
          root,
          projectPath(projectSlug, "runs", runId, "manifest.json"),
        ),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  return runs.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

async function nextRunId(root: string, projectSlug: string): Promise<string> {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const runs = await readWorkspaceRuns(root, projectSlug);
  const todays = runs.filter((run) => run.id.startsWith(`RUN-${date}-`));
  const next = todays.length + 1;
  return `RUN-${date}-${String(next).padStart(3, "0")}`;
}

async function writeRunManifest(
  root: string,
  projectSlug: string,
  manifest: WorkspaceRunManifest,
) {
  await writeJsonFile(
    root,
    projectPath(projectSlug, "runs", manifest.id, "manifest.json"),
    manifest,
  );
}

async function appendRunEvent(
  root: string,
  projectSlug: string,
  runId: string,
  message: string,
) {
  await appendJsonl(root, projectPath(projectSlug, "runs", runId, "events.jsonl"), [
    { at: new Date().toISOString(), message },
  ]);
}

async function appendRunLog(
  root: string,
  projectSlug: string,
  runId: string,
  level: "info" | "error",
  message: string,
) {
  await appendJsonl(root, projectPath(projectSlug, "runs", runId, "logs.jsonl"), [
    { at: new Date().toISOString(), level, message },
  ]);
}

async function upsertJsonlRecords<T extends { id: string }>(
  root: string,
  relativePath: string,
  records: T[],
): Promise<number> {
  let existing: T[] = [];
  try {
    existing = await readJsonlFile<T>(root, relativePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const recordIds = new Set(records.map((record) => record.id));
  const next = [
    ...existing.filter((record) => !recordIds.has(record.id)),
    ...records,
  ];
  await writeTextFile(
    root,
    relativePath,
    next.length ? `${next.map((record) => JSON.stringify(record)).join("\n")}\n` : "",
  );
  return records.length;
}

async function searchTavily(
  fetchImpl: typeof fetch,
  apiKey: string,
  query: string,
): Promise<TavilySearchResponse> {
  const response = await fetchImpl("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: 5,
      include_answer: "basic",
      include_raw_content: "markdown",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Tavily Search failed with HTTP ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`);
  }

  return (await response.json()) as TavilySearchResponse;
}

function tavilyMarkdownReport(query: string, response: TavilySearchResponse): string {
  const lines = [
    `# Tavily Search Report: ${query}`,
    "",
    `- Query: ${query}`,
    `- Request ID: ${response.request_id ?? "-"}`,
    `- Response time: ${response.response_time ?? "-"}s`,
    `- Results: ${response.results?.length ?? 0}`,
    "",
  ];

  if (response.answer) {
    lines.push("## Answer", "", response.answer, "");
  }

  lines.push("## Results", "");
  for (const [index, result] of (response.results ?? []).entries()) {
    lines.push(
      `### ${index + 1}. ${result.title ?? "Untitled result"}`,
      "",
      `- URL: ${result.url ?? "-"}`,
      `- Score: ${result.score ?? "-"}`,
      result.published_date ? `- Published: ${result.published_date}` : "",
      "",
      result.raw_content ?? result.content ?? "",
      "",
    );
  }

  return `${lines.filter((line) => line !== "").join("\n")}\n`;
}

function tavilyResponseToRecord(input: {
  topic: string;
  runId: string;
  reportPath: string;
  response: TavilySearchResponse;
  createdAt: string;
}): TavilyWebpageRecord {
  const topResult = input.response.results?.[0];
  const resultCount = input.response.results?.length ?? 0;
  return {
    id: `tavily-${input.runId.toLowerCase()}-${topicSlug(input.topic)}`,
    sourceId: "tavily",
    kind: "web_page",
    title: `Tavily report: ${input.topic}`,
    summary: input.response.answer || `${resultCount} Tavily Search results captured as markdown.`,
    fields: {
      query: input.topic,
      resultCount,
      reportPath: input.reportPath,
      requestId: input.response.request_id ?? null,
      responseTime: input.response.response_time ?? null,
    },
    rawText: [
      input.response.answer,
      ...(input.response.results ?? []).map((result) =>
        [result.title, result.url, result.content ?? result.raw_content].filter(Boolean).join("\n"),
      ),
    ].filter(Boolean).join("\n\n"),
    url: topResult?.url,
    createdAt: input.createdAt,
  };
}

function topicSlug(topic: string): string {
  return `${toWorkspaceSlug(topic)}-${hashString(topic).slice(0, 8)}`;
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(i) | 0;
  }
  return Math.abs(hash).toString(16);
}

function workspaceRelativeProjectPath(
  relativePath: string,
  projectSlug: string,
): string {
  return relativePath.replace(`projects/${projectSlug}/`, "");
}

async function updateSourceConfigLastRun(
  root: string,
  projectSlug: string,
  sourceConfig: WorkspaceSourceConfig,
  sourceIds: string[],
  runId: string,
) {
  await writeJsonFile(
    root,
    projectPath(projectSlug, "source-config.json"),
    {
      ...sourceConfig,
      sources: sourceConfig.sources.map((source) =>
        sourceIds.includes(source.id) ? { ...source, lastRunId: runId } : source,
      ),
    } satisfies WorkspaceSourceConfig,
  );
}

async function touchProject(root: string, projectSlug: string, updatedAt: string) {
  const project = await readJsonFile<WorkspaceProject>(
    root,
    projectPath(projectSlug, "project.json"),
  );
  await writeJsonFile(
    root,
    projectPath(projectSlug, "project.json"),
    { ...project, updatedAt },
  );
}

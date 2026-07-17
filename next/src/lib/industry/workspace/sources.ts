import path from "node:path";
import {
  appendJsonl,
  ensureDir,
  listDirectories,
  readJsonFile,
  writeJsonFile,
} from "./fs";
import { projectPath } from "./paths";
import { configuredWorkspaceRoot, readWorkspaceProject } from "./projects";
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

type MockRecord = {
  id: string;
  sourceId: string;
  kind: "job" | "news" | "web_page";
  title: string;
  summary: string;
  fields: Record<string, string | string[]>;
  rawText: string;
  url: string;
  createdAt: string;
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
  const workspaceRoot = root ?? (await configuredWorkspaceRoot());
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
  const runId = await nextRunId(workspaceRoot, projectSlug);
  const startedAt = new Date();
  const endedAt = new Date(startedAt.getTime() + 45_000);
  const records = mockRecordsForRun(runId, selectedSourceIds, endedAt.toISOString());
  const recordsCreated = records.jobs.length + records.news.length + records.webpages.length;
  const warnings = selectedSourceIds.includes("liepin")
    ? ["Liepin connector is mocked in V1; saved-session automation is not enabled."]
    : [];

  await ensureDir(path.join(workspaceRoot, projectPath(projectSlug, "runs", runId)));
  const manifest: WorkspaceRunManifest = {
    id: runId,
    sourceIds: selectedSourceIds,
    status: warnings.length ? "completed_with_warnings" : "completed",
    progress: 100,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    recordsCreated,
    warnings,
  };

  await writeJsonFile(
    workspaceRoot,
    projectPath(projectSlug, "runs", runId, "manifest.json"),
    manifest,
  );
  await appendJsonl(
    workspaceRoot,
    projectPath(projectSlug, "runs", runId, "events.jsonl"),
    [
      { at: startedAt.toISOString(), message: "Collection started" },
      { at: endedAt.toISOString(), message: `Collection completed with ${recordsCreated} records` },
    ],
  );
  await appendJsonl(
    workspaceRoot,
    projectPath(projectSlug, "runs", runId, "logs.jsonl"),
    [
      { level: "info", message: `Mock external collection wrote ${recordsCreated} normalized records` },
      ...warnings.map((message) => ({ level: "warning", message })),
    ],
  );
  await appendJsonl(
    workspaceRoot,
    projectPath(projectSlug, "sources/external/normalized/jobs.jsonl"),
    records.jobs,
  );
  await appendJsonl(
    workspaceRoot,
    projectPath(projectSlug, "sources/external/normalized/news.jsonl"),
    records.news,
  );
  await appendJsonl(
    workspaceRoot,
    projectPath(projectSlug, "sources/external/normalized/webpages.jsonl"),
    records.webpages,
  );

  await writeJsonFile(
    workspaceRoot,
    projectPath(projectSlug, "source-config.json"),
    {
      ...sourceConfig,
      sources: sourceConfig.sources.map((source) =>
        selectedSourceIds.includes(source.id)
          ? { ...source, lastRunId: runId }
          : source,
      ),
    } satisfies WorkspaceSourceConfig,
  );

  const project = await readJsonFile<WorkspaceProject>(
    workspaceRoot,
    projectPath(projectSlug, "project.json"),
  );
  await writeJsonFile(
    workspaceRoot,
    projectPath(projectSlug, "project.json"),
    { ...project, updatedAt: endedAt.toISOString() },
  );

  return { run: manifest, recordsCreated };
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

function mockRecordsForRun(
  runId: string,
  sourceIds: string[],
  createdAt: string,
): { jobs: MockRecord[]; news: MockRecord[]; webpages: MockRecord[] } {
  const suffix = runId.toLowerCase();
  const jobs = sourceIds.some((id) => id === "career-sites" || id === "liepin")
    ? [
        {
          id: `${suffix}-job-bosch-platform`,
          sourceId: sourceIds.includes("career-sites") ? "career-sites" : "liepin",
          kind: "job" as const,
          title: "Software Platform Architect",
          summary: "Bosch platform architecture role with strong embedded and vehicle software signals.",
          fields: {
            company: "Bosch",
            location: "Shanghai",
            skills: ["Embedded Linux", "AUTOSAR", "Vehicle Software"],
          },
          rawText:
            "Own software platform architecture for next-generation vehicle systems, with embedded Linux and AUTOSAR integration.",
          url: "https://bosch.com/careers/software-platform-architect",
          createdAt,
        },
        {
          id: `${suffix}-job-continental-adas`,
          sourceId: sourceIds.includes("career-sites") ? "career-sites" : "liepin",
          kind: "job" as const,
          title: "ADAS Controls Engineer",
          summary: "Continental ADAS controls hiring signal for China engineering teams.",
          fields: {
            company: "Continental",
            location: "Suzhou",
            skills: ["ADAS", "Controls", "C++"],
          },
          rawText:
            "Develop ADAS control functions and validate embedded control software for vehicle programs.",
          url: "https://continental.com/careers/adas-controls-engineer",
          createdAt,
        },
      ]
    : [];

  const news = sourceIds.includes("tavily")
    ? [
        {
          id: `${suffix}-news-adas-demand`,
          sourceId: "tavily",
          kind: "news" as const,
          title: "ADAS and vehicle software roles remain priority hiring areas",
          summary: "Mock market signal for report setup and insight generation.",
          fields: {
            topic: "Hiring Demand",
            region: "China",
          },
          rawText:
            "Industry hiring signals continue to point to ADAS, embedded software, and platform engineering as priority areas.",
          url: "https://example.com/mock-adas-demand",
          createdAt,
        },
      ]
    : [];

  const webpages = sourceIds.includes("manual-urls")
    ? [
        {
          id: `${suffix}-webpage-market-brief`,
          sourceId: "manual-urls",
          kind: "web_page" as const,
          title: "China automotive software market brief",
          summary: "Mock imported page for industry context.",
          fields: {
            topic: "Market Context",
            region: "China",
          },
          rawText:
            "Automotive companies in China continue investing in software-defined vehicle capabilities and talent.",
          url: "https://example.com/mock-market-brief",
          createdAt,
        },
      ]
    : [];

  return { jobs, news, webpages };
}

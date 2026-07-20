import path from "node:path";
import {
  ensureDir,
  listDirectories,
  pathExists,
  readJsonFile,
  readJsonlFile,
  removeWorkspacePath,
  writeJsonFile,
  writeTextFile,
} from "./fs";
import { readAppWorkspaceConfig } from "./config";
import { projectPath, toWorkspaceSlug } from "./paths";
import {
  WORKSPACE_SCHEMA_VERSION,
  type WorkspaceProject,
  type WorkspaceRegion,
  type WorkspaceSourceConfig,
} from "./schema";
import type {
  WorkspaceProjectCounts,
  WorkspaceProjectSummary,
} from "./client";

export type CreateWorkspaceProjectInput = {
  name: string;
  industry: string;
  region: WorkspaceRegion;
  trackedCompanies: string[];
  tags?: string[];
};

type ProjectDataRecord = {
  kind?: string;
  fields?: Record<string, unknown>;
};

export const DEFAULT_HIRING_KEYWORDS = [
  "半导体",
  "汽车半导体",
  "车规芯片",
  "SiC",
  "GaN",
  "MCU",
  "功率器件",
  "模拟芯片",
  "传感器",
  "ADAS",
  "座舱SoC",
  "功能安全",
  "800V",
];

export async function configuredWorkspaceRoot(): Promise<string> {
  const config = await readAppWorkspaceConfig();
  return config.workspaceRoot;
}

export async function listWorkspaceProjects(
  root?: string,
): Promise<WorkspaceProjectSummary[]> {
  const workspaceRoot = root ?? (await configuredWorkspaceRoot());
  await ensureWorkspaceScaffold(workspaceRoot);
  const projectSlugs = await listDirectories(workspaceRoot, "projects");
  const summaries = await Promise.all(
    projectSlugs.map(async (slug) => {
      const project = await readJsonFile<WorkspaceProject>(
        workspaceRoot,
        projectPath(slug, "project.json"),
      );
      const counts = await readProjectCounts(workspaceRoot, slug);
      return { project, counts };
    }),
  );

  return summaries.sort((a, b) =>
    Date.parse(b.project.updatedAt) - Date.parse(a.project.updatedAt),
  );
}

export async function createWorkspaceProject(
  input: CreateWorkspaceProjectInput,
  root?: string,
): Promise<WorkspaceProjectSummary> {
  const workspaceRoot = root ?? (await configuredWorkspaceRoot());
  await ensureWorkspaceScaffold(workspaceRoot);

  const baseSlug = toWorkspaceSlug(input.name);
  const slug = await nextAvailableProjectSlug(workspaceRoot, baseSlug);
  const now = new Date().toISOString();
  const industry = input.industry.trim() || "Industry";
  const region = normalizeWorkspaceRegion(input.region);
  const trackedCompanies = normalizeStringList(input.trackedCompanies);
  if (!trackedCompanies.length) {
    throw new Error("At least one tracked company is required");
  }
  const tags = input.tags?.length
    ? input.tags
    : [industry, region].filter(Boolean);

  const project: WorkspaceProject = {
    id: slug,
    slug,
    name: input.name.trim() || "Untitled Industry Project",
    industry,
    region,
    tags,
    trackedCompanies,
    createdAt: now,
    updatedAt: now,
  };

  await ensureProjectDirectories(workspaceRoot, slug);
  await writeJsonFile(workspaceRoot, projectPath(slug, "project.json"), project);
  await writeJsonFile(workspaceRoot, projectPath(slug, "source-config.json"), {
    version: WORKSPACE_SCHEMA_VERSION,
    sources: defaultSourceConfigs({
      industry,
      region,
      trackedCompanies,
    }),
  } satisfies WorkspaceSourceConfig);
  await writeJsonFile(workspaceRoot, projectPath(slug, "sources/uploaded/files.json"), {
    version: WORKSPACE_SCHEMA_VERSION,
    files: [],
  });
  await writeTextFile(workspaceRoot, projectPath(slug, "sources/external/normalized/jobs.jsonl"), "");
  await writeTextFile(workspaceRoot, projectPath(slug, "sources/external/normalized/news.jsonl"), "");
  await writeTextFile(workspaceRoot, projectPath(slug, "sources/external/normalized/webpages.jsonl"), "");
  await writeTextFile(workspaceRoot, projectPath(slug, "sources/uploaded/normalized/records.jsonl"), "");
  await writeJsonFile(workspaceRoot, projectPath(slug, "selections/current.json"), {
    id: "current",
    name: "Current report evidence",
    selectedRecordRefs: [],
    selectedFileRefs: [],
    createdAt: now,
  });

  return {
    project,
    counts: await readProjectCounts(workspaceRoot, slug),
  };
}

export async function readWorkspaceProject(
  projectSlug: string,
  root?: string,
): Promise<WorkspaceProjectSummary> {
  const workspaceRoot = root ?? (await configuredWorkspaceRoot());
  const project = await readJsonFile<WorkspaceProject>(
    workspaceRoot,
    projectPath(projectSlug, "project.json"),
  );
  return {
    project,
    counts: await readProjectCounts(workspaceRoot, projectSlug),
  };
}

export async function deleteWorkspaceProject(
  projectSlug: string,
  root?: string,
): Promise<void> {
  const workspaceRoot = root ?? (await configuredWorkspaceRoot());
  const projectJsonPath = projectPath(projectSlug, "project.json");
  if (!(await pathExists(path.join(workspaceRoot, projectJsonPath)))) {
    throw notFoundError(`Project not found: ${projectSlug}`);
  }

  await removeWorkspacePath(workspaceRoot, projectPath(projectSlug));
}

async function ensureWorkspaceScaffold(root: string): Promise<void> {
  await ensureDir(root);
  await ensureDir(path.join(root, "projects"));
  await ensureDir(path.join(root, "templates"));

  if (!(await pathExists(path.join(root, "workspace.json")))) {
    await writeJsonFile(root, "workspace.json", {
      version: WORKSPACE_SCHEMA_VERSION,
      name: "Industry Insight Studio Workspace",
      projectsDir: "projects",
      templatesDir: "templates",
    });
  }
}

async function ensureProjectDirectories(root: string, slug: string): Promise<void> {
  const dirs = [
    projectPath(slug, "sources/external/raw/liepin"),
    projectPath(slug, "sources/external/raw/tavily"),
    projectPath(slug, "sources/external/normalized"),
    projectPath(slug, "sources/uploaded/original"),
    projectPath(slug, "sources/uploaded/parsed"),
    projectPath(slug, "sources/uploaded/normalized"),
    projectPath(slug, "runs"),
    projectPath(slug, "selections"),
    projectPath(slug, "reports"),
  ];

  for (const dir of dirs) {
    await ensureDir(path.join(root, dir));
  }
}

async function nextAvailableProjectSlug(root: string, baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let suffix = 2;

  while (await pathExists(path.join(root, projectPath(slug, "project.json")))) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

async function readProjectCounts(
  root: string,
  projectSlug: string,
): Promise<WorkspaceProjectCounts> {
  const [sourceCount, records, reports] = await Promise.all([
    countSources(root, projectSlug),
    readProjectDataRecords(root, projectSlug),
    countReports(root, projectSlug),
  ]);

  const companies = new Set<string>();
  for (const record of records) {
    if (record.kind !== "job") continue;
    const company = record.fields?.company;
    if (typeof company === "string" && company.trim()) companies.add(company);
  }

  return {
    companies: companies.size,
    dataItems: records.length,
    reports,
    sources: sourceCount,
  };
}

async function countSources(root: string, projectSlug: string): Promise<number> {
  try {
    const config = await readJsonFile<WorkspaceSourceConfig>(
      root,
      projectPath(projectSlug, "source-config.json"),
    );
    return config.sources.length;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
}

async function countReports(root: string, projectSlug: string): Promise<number> {
  let reportSlugs: string[];
  try {
    reportSlugs = await listDirectories(root, projectPath(projectSlug, "reports"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }

  let count = 0;
  for (const reportSlug of reportSlugs) {
    if (await pathExists(path.join(root, projectPath(projectSlug, "reports", reportSlug, "report.json")))) {
      count += 1;
    }
  }
  return count;
}

async function readProjectDataRecords(
  root: string,
  projectSlug: string,
): Promise<ProjectDataRecord[]> {
  const files = [
    "sources/external/normalized/jobs.jsonl",
    "sources/external/normalized/news.jsonl",
    "sources/external/normalized/webpages.jsonl",
    "sources/uploaded/normalized/records.jsonl",
  ];
  const records: ProjectDataRecord[] = [];

  for (const file of files) {
    try {
      records.push(
        ...(await readJsonlFile<ProjectDataRecord>(
          root,
          projectPath(projectSlug, file),
        )),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  return records;
}

function defaultSourceConfigs(input: {
  industry: string;
  region: WorkspaceRegion;
  trackedCompanies: string[];
}): WorkspaceSourceConfig["sources"] {
  return [
    {
      id: "liepin",
      type: "liepin",
      displayName: "Liepin scraper",
      description: "Collect and normalize Liepin job listings for tracked companies.",
      enabled: true,
      config: {
        companies: input.trackedCompanies,
        keywords: DEFAULT_HIRING_KEYWORDS,
      },
    },
    {
      id: "tavily",
      type: "tavily",
      displayName: "Tavily Search",
      description: "Search industry news, company activity, hiring trends, and market signals.",
      enabled: true,
      config: {
        topics: buildTavilyTopics(input),
      },
    },
  ];
}

export function buildTavilyTopics(input: {
  industry: string;
  region: WorkspaceRegion;
  trackedCompanies: string[];
}): string[] {
  const companies = input.trackedCompanies.slice(0, 5);
  const regionText = input.region === "China" ? "中国" : "global";
  return [
    ...companies.flatMap((company) => [
      `${company} ${regionText} ${input.industry} 招聘`,
      `${company} ${regionText} ${input.industry} 投资 研发中心`,
    ]),
    `${input.industry} 人才需求 ${regionText}`,
    `${input.industry} 薪资 招聘趋势 ${regionText}`,
  ];
}

export function normalizeWorkspaceRegion(value: string): WorkspaceRegion {
  if (value === "Global") return "Global";
  return "China";
}

function normalizeStringList(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function notFoundError(message: string): Error {
  return Object.assign(new Error(message), { code: "ENOENT" });
}

import path from "node:path";
import {
  ensureDir,
  listDirectories,
  pathExists,
  readJsonFile,
  readJsonlFile,
  writeJsonFile,
  writeTextFile,
} from "./fs";
import { readAppWorkspaceConfig } from "./config";
import { projectPath, toWorkspaceSlug } from "./paths";
import {
  WORKSPACE_SCHEMA_VERSION,
  type WorkspaceProject,
  type WorkspaceSourceConfig,
} from "./schema";

export type WorkspaceProjectCounts = {
  companies: number;
  dataItems: number;
  reports: number;
  sources: number;
};

export type WorkspaceProjectSummary = {
  project: WorkspaceProject;
  counts: WorkspaceProjectCounts;
};

export type CreateWorkspaceProjectInput = {
  name: string;
  industry: string;
  region: string;
  tags?: string[];
};

type ProjectDataRecord = {
  kind?: string;
  fields?: Record<string, unknown>;
};

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
  const region = input.region.trim() || "Region";
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
    createdAt: now,
    updatedAt: now,
  };

  await ensureProjectDirectories(workspaceRoot, slug);
  await writeJsonFile(workspaceRoot, projectPath(slug, "project.json"), project);
  await writeJsonFile(workspaceRoot, projectPath(slug, "source-config.json"), {
    version: WORKSPACE_SCHEMA_VERSION,
    sources: defaultSourceConfigs(),
  } satisfies WorkspaceSourceConfig);
  await writeJsonFile(workspaceRoot, projectPath(slug, "sources/uploaded/files.json"), {
    version: WORKSPACE_SCHEMA_VERSION,
    files: [],
  });
  await writeTextFile(workspaceRoot, projectPath(slug, "sources/external/normalized/jobs.jsonl"), "");
  await writeTextFile(workspaceRoot, projectPath(slug, "sources/external/normalized/news.jsonl"), "");
  await writeTextFile(workspaceRoot, projectPath(slug, "sources/external/normalized/webpages.jsonl"), "");
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
    projectPath(slug, "sources/external/raw/career-sites"),
    projectPath(slug, "sources/external/raw/liepin"),
    projectPath(slug, "sources/external/raw/tavily"),
    projectPath(slug, "sources/external/raw/manual-urls"),
    projectPath(slug, "sources/external/normalized"),
    projectPath(slug, "sources/uploaded/original"),
    projectPath(slug, "sources/uploaded/parsed"),
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
  try {
    return (await listDirectories(root, projectPath(projectSlug, "reports"))).length;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
}

async function readProjectDataRecords(
  root: string,
  projectSlug: string,
): Promise<ProjectDataRecord[]> {
  const files = [
    "sources/external/normalized/jobs.jsonl",
    "sources/external/normalized/news.jsonl",
    "sources/external/normalized/webpages.jsonl",
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

function defaultSourceConfigs(): WorkspaceSourceConfig["sources"] {
  return [
    {
      id: "career-sites",
      type: "career_site",
      displayName: "Company Career Sites",
      description: "Collect job openings from company recruitment websites.",
      enabled: true,
      config: { companies: [] },
    },
    {
      id: "liepin",
      type: "liepin",
      displayName: "Liepin",
      description: "Collect public job listings from Liepin using a saved browser session.",
      enabled: false,
      config: { keywords: [] },
    },
    {
      id: "tavily",
      type: "tavily",
      displayName: "Tavily Search",
      description: "Search industry news, company activity, hiring trends, and market signals.",
      enabled: true,
      config: { topics: [] },
    },
    {
      id: "manual-urls",
      type: "url_import",
      displayName: "Manual URL Imports",
      description: "Import market articles, company pages, and other web references by URL.",
      enabled: true,
      config: { urls: [] },
    },
  ];
}

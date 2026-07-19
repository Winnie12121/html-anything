import path from "node:path";
import {
  appendJsonl,
  ensureDir,
  pathExists,
  writeJsonFile,
  writeTextFile,
} from "./fs";
import { projectPath, reportPath } from "./paths";
import {
  DEFAULT_HIRING_KEYWORDS,
  buildTavilyTopics,
} from "./projects";
import { readLiepinSampleRecords } from "./liepin";
import {
  WORKSPACE_SCHEMA_VERSION,
  type WorkspaceConfig,
  type WorkspaceProject,
  type WorkspaceReportMetadata,
  type WorkspaceRunManifest,
  type WorkspaceSelectionManifest,
  type WorkspaceSourceConfig,
} from "./schema";

export const DEMO_PROJECT_SLUG = "china-automotive-talent-insight";
export const DEMO_REPORT_SLUG = "china-automotive-hiring-comparison";

const DEMO_NOW = "2026-07-16T10:00:00.000Z";
const DEMO_TRACKED_COMPANIES = [
  "英飞凌",
  "德州仪器",
  "高通",
  "意法半导体",
  "恩智浦",
];

export async function ensureWorkspaceRoot(root: string): Promise<void> {
  await ensureDir(root);

  const workspaceJson: WorkspaceConfig = {
    version: WORKSPACE_SCHEMA_VERSION,
    name: "Industry Insight Studio Demo",
    projectsDir: "projects",
    templatesDir: "templates",
  };

  if (!(await pathExists(path.join(root, "workspace.json")))) {
    await writeJsonFile(root, "workspace.json", workspaceJson);
  }

  await ensureDir(path.join(root, "projects"));
  await ensureDir(path.join(root, "templates"));
}

export async function ensureDemoWorkspace(root: string): Promise<void> {
  await ensureWorkspaceRoot(root);
  await ensureProjectDirectories(root, DEMO_PROJECT_SLUG);
  await seedProjectFiles(root);
  await seedSources(root);
  await seedRuns(root);
  await seedSelections(root);
  await seedReport(root);
}

async function ensureProjectDirectories(
  root: string,
  projectSlug: string,
): Promise<void> {
  const dirs = [
    projectPath(projectSlug, "sources/external/raw/liepin"),
    projectPath(projectSlug, "sources/external/raw/tavily"),
    projectPath(projectSlug, "sources/external/normalized"),
    projectPath(projectSlug, "sources/uploaded/original"),
    projectPath(projectSlug, "sources/uploaded/parsed"),
    projectPath(projectSlug, "runs"),
    projectPath(projectSlug, "selections"),
    projectPath(projectSlug, "reports"),
  ];

  for (const dir of dirs) {
    await ensureDir(path.join(root, dir));
  }
}

async function seedProjectFiles(root: string): Promise<void> {
  const project: WorkspaceProject = {
    id: DEMO_PROJECT_SLUG,
    slug: DEMO_PROJECT_SLUG,
    name: "Automotive Semiconductor HR Market Insight",
    industry: "Automotive Semiconductor",
    region: "China",
    tags: ["Automotive Semiconductor", "China"],
    trackedCompanies: DEMO_TRACKED_COMPANIES,
    createdAt: DEMO_NOW,
    updatedAt: DEMO_NOW,
  };

  await writeIfMissing(root, projectPath(DEMO_PROJECT_SLUG, "project.json"), project);
}

async function seedSources(root: string): Promise<void> {
  const sourceConfig: WorkspaceSourceConfig = {
    version: WORKSPACE_SCHEMA_VERSION,
    sources: [
      {
        id: "liepin",
        type: "liepin",
        displayName: "Liepin scraper",
        description: "Collect and normalize Liepin job listings for tracked companies.",
        enabled: true,
        lastRunId: "RUN-20260716-001",
        config: {
          companies: DEMO_TRACKED_COMPANIES,
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
          topics: buildTavilyTopics({
            industry: "Automotive Semiconductor",
            region: "China",
            trackedCompanies: DEMO_TRACKED_COMPANIES,
          }),
        },
      },
    ],
  };

  await writeIfMissing(
    root,
    projectPath(DEMO_PROJECT_SLUG, "source-config.json"),
    sourceConfig,
  );

  await writeIfMissing(
    root,
    projectPath(DEMO_PROJECT_SLUG, "sources/uploaded/files.json"),
    {
      version: WORKSPACE_SCHEMA_VERSION,
      files: [],
    },
  );

  await seedJsonl(
    root,
    projectPath(DEMO_PROJECT_SLUG, "sources/external/normalized/jobs.jsonl"),
    await readLiepinSampleRecords(DEMO_NOW),
  );

  await seedJsonl(
    root,
    projectPath(DEMO_PROJECT_SLUG, "sources/external/normalized/news.jsonl"),
    [],
  );

  await seedJsonl(
    root,
    projectPath(DEMO_PROJECT_SLUG, "sources/external/normalized/webpages.jsonl"),
    [],
  );
}

async function seedRuns(root: string): Promise<void> {
  const runDir = projectPath(DEMO_PROJECT_SLUG, "runs/RUN-20260716-001");
  await ensureDir(path.join(root, runDir));

  const manifest: WorkspaceRunManifest = {
    id: "RUN-20260716-001",
    sourceIds: ["liepin"],
    status: "completed",
    progress: 100,
    startedAt: "2026-07-16T09:42:00.000Z",
    endedAt: "2026-07-16T09:47:00.000Z",
    recordsCreated: 150,
    warnings: [],
  };

  await writeIfMissing(root, `${runDir}/manifest.json`, manifest);
  await seedJsonl(root, `${runDir}/events.jsonl`, [
    { at: "2026-07-16T09:42:00.000Z", message: "Collection started" },
    { at: "2026-07-16T09:47:00.000Z", message: "Collection completed" },
  ]);
  await seedJsonl(root, `${runDir}/logs.jsonl`, [
    { level: "info", message: "Liepin CSV normalized 150 records" },
  ]);
}

async function seedSelections(root: string): Promise<void> {
  const selectionId = "SEL-20260716-001";
  const selectionDir = projectPath(DEMO_PROJECT_SLUG, "selections", selectionId);
  await ensureDir(path.join(root, selectionDir));
  const selectedRecordRefs = (await readLiepinSampleRecords(DEMO_NOW))
    .slice(0, 2)
    .map((record) => `sources/external/normalized/jobs.jsonl#${record.id}`);

  const manifest: WorkspaceSelectionManifest = {
    id: selectionId,
    name: "Current report evidence",
    selectedRecordRefs,
    selectedFileRefs: [],
    createdAt: DEMO_NOW,
  };

  await writeIfMissing(
    root,
    projectPath(DEMO_PROJECT_SLUG, "selections/current.json"),
    manifest,
  );
  await writeIfMissing(root, `${selectionDir}/manifest.json`, manifest);
  await seedJsonl(
    root,
    `${selectionDir}/selected-records.jsonl`,
    selectedRecordRefs.map((ref) => ({ ref })),
  );
  await writeIfMissing(root, `${selectionDir}/selected-files.json`, []);
}

async function seedReport(root: string): Promise<void> {
  const reportDir = reportPath(DEMO_PROJECT_SLUG, DEMO_REPORT_SLUG);
  await ensureDir(path.join(root, reportDir));
  await ensureDir(path.join(root, `${reportDir}/input`));
  await ensureDir(path.join(root, `${reportDir}/derived`));
  await ensureDir(path.join(root, `${reportDir}/snapshots`));

  const selectedRecordRefs = (await readLiepinSampleRecords(DEMO_NOW))
    .slice(0, 5)
    .map((record) => `sources/external/normalized/jobs.jsonl#${record.id}`);

  const metadata: WorkspaceReportMetadata = {
    id: DEMO_REPORT_SLUG,
    slug: DEMO_REPORT_SLUG,
    name: "Automotive Semiconductor Hiring Comparison",
    templateId: "competitor-hiring-comparison",
    audience: "HR leadership",
    language: "English",
    goal: "Compare semiconductor hiring activity, role demand, and market signals.",
    status: "ready",
    currentHtmlPath: "current.html",
    sections: [
      {
        id: "executive-summary",
        title: "Executive Summary",
        selector: "[data-section-id='executive-summary']",
        order: 0,
        sourceRecordRefs: selectedRecordRefs.slice(0, 2),
      },
      {
        id: "company-comparison",
        title: "Company Comparison",
        selector: "[data-section-id='company-comparison']",
        order: 1,
        sourceRecordRefs: selectedRecordRefs,
      },
    ],
    createdAt: DEMO_NOW,
    updatedAt: DEMO_NOW,
  };

  await writeIfMissing(root, `${reportDir}/report.json`, metadata);
  await writeIfMissing(root, `${reportDir}/comments.json`, []);
  await writeIfMissing(root, `${reportDir}/input/selection-manifest.json`, {
    selectionPath: "selections/current.json",
  });
  await writeIfMissing(root, `${reportDir}/derived/suggested-insights.json`, []);
  await writeTextIfMissing(root, `${reportDir}/current.html`, demoReportHtml());
}

async function writeIfMissing(
  root: string,
  relativePath: string,
  value: unknown,
): Promise<void> {
  if (await pathExists(path.join(root, relativePath))) return;
  await writeJsonFile(root, relativePath, value);
}

async function writeTextIfMissing(
  root: string,
  relativePath: string,
  value: string,
): Promise<void> {
  if (await pathExists(path.join(root, relativePath))) return;
  await writeTextFile(root, relativePath, value);
}

async function seedJsonl(
  root: string,
  relativePath: string,
  values: unknown[],
): Promise<void> {
  if (await pathExists(path.join(root, relativePath))) return;
  if (values.length === 0) {
    await writeTextFile(root, relativePath, "");
    return;
  }
  await appendJsonl(root, relativePath, values);
}

function demoReportHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Automotive Semiconductor Hiring Comparison</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; color: #20242a; background: #f4f6f8; }
    main { max-width: 920px; margin: 32px auto; background: #fff; border: 1px solid #d9dee7; padding: 40px; }
    h1 { margin: 0 0 8px; font-size: 34px; line-height: 1.15; }
    .muted { color: #707780; }
    section { border-top: 1px solid #e2e6ec; margin-top: 28px; padding-top: 24px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #e2e6ec; padding: 10px; text-align: left; }
  </style>
</head>
<body>
  <main>
    <h1>Automotive Semiconductor Hiring Comparison</h1>
    <p class="muted">Automotive Semiconductor · China · Generated from selected workspace data</p>
    <section data-section-id="executive-summary">
      <h2>Executive Summary</h2>
      <p>Selected Liepin hiring evidence indicates active semiconductor demand across sales, investment, process engineering, and device roles.</p>
    </section>
    <section data-section-id="company-comparison">
      <h2>Company Comparison</h2>
      <table>
        <thead><tr><th>Company</th><th>Signal</th><th>Role Focus</th></tr></thead>
        <tbody>
          <tr><td>浙江华熔科技有限公司</td><td>Active Liepin listing</td><td>Semiconductor sales</td></tr>
          <tr><td>上海常春藤投资控股有限公司</td><td>Active Liepin listing</td><td>AI / semiconductor investment</td></tr>
        </tbody>
      </table>
    </section>
  </main>
</body>
</html>
`;
}

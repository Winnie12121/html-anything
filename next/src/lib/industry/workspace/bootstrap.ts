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
    projectPath(projectSlug, "sources/external/raw/career-sites"),
    projectPath(projectSlug, "sources/external/raw/liepin"),
    projectPath(projectSlug, "sources/external/raw/tavily"),
    projectPath(projectSlug, "sources/external/raw/manual-urls"),
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
    name: "China Automotive Talent Insight",
    industry: "Automotive",
    region: "China",
    tags: ["Automotive", "China"],
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
        id: "career-sites",
        type: "career_site",
        displayName: "Company Career Sites",
        description: "Collect job openings from company recruitment websites.",
        enabled: true,
        lastRunId: "RUN-20260716-001",
        config: {
          companies: [
            { name: "Bosch", url: "https://www.bosch.com/careers/" },
            { name: "Continental", url: "https://www.continental.com/careers/" },
          ],
        },
      },
      {
        id: "liepin",
        type: "liepin",
        displayName: "Liepin",
        description: "Collect public job listings from Liepin using a saved browser session.",
        enabled: false,
        config: { keywords: ["ADAS", "embedded software"] },
      },
      {
        id: "tavily",
        type: "tavily",
        displayName: "Tavily Search",
        description: "Search industry news, company activity, hiring trends, and market signals.",
        enabled: true,
        lastRunId: "RUN-20260716-001",
        config: { topics: ["automotive software hiring China", "ADAS talent demand"] },
      },
      {
        id: "manual-urls",
        type: "url_import",
        displayName: "Manual URL Imports",
        description: "Import market articles, company pages, and other web references by URL.",
        enabled: true,
        config: { urls: [] },
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
    [
      {
        id: "job-001",
        sourceId: "career-sites",
        kind: "job",
        title: "ADAS Software Engineer",
        summary: "Bosch hiring signal for ADAS perception and embedded software.",
        fields: {
          company: "Bosch",
          location: "Shanghai",
          skills: ["C++", "AUTOSAR", "Python", "ROS2"],
        },
        rawText:
          "Lead development of ADAS perception modules, including sensor fusion algorithms using camera and radar data.",
        url: "https://bosch.com/careers",
        createdAt: DEMO_NOW,
      },
      {
        id: "job-002",
        sourceId: "career-sites",
        kind: "job",
        title: "Embedded Developer",
        summary: "Continental embedded software role in China.",
        fields: {
          company: "Continental",
          location: "Suzhou",
          skills: ["Embedded C", "AUTOSAR", "Linux"],
        },
        rawText: "Develop embedded control software for next-generation vehicle systems.",
        url: "https://continental.com/careers",
        createdAt: DEMO_NOW,
      },
    ],
  );

  await seedJsonl(
    root,
    projectPath(DEMO_PROJECT_SLUG, "sources/external/normalized/news.jsonl"),
    [
      {
        id: "news-001",
        sourceId: "tavily",
        kind: "news",
        title: "Automotive software hiring remains active in China",
        summary: "Market signal indicating continued demand for ADAS and platform roles.",
        fields: { company: "Market", topic: "Hiring demand" },
        rawText:
          "Recent industry coverage indicates continued automotive software and ADAS hiring demand in China.",
        url: "https://example.com/automotive-software-hiring",
        createdAt: DEMO_NOW,
      },
    ],
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
    sourceIds: ["career-sites", "tavily"],
    status: "completed",
    progress: 100,
    startedAt: "2026-07-16T09:42:00.000Z",
    endedAt: "2026-07-16T09:47:00.000Z",
    recordsCreated: 3,
    warnings: [],
  };

  await writeIfMissing(root, `${runDir}/manifest.json`, manifest);
  await seedJsonl(root, `${runDir}/events.jsonl`, [
    { at: "2026-07-16T09:42:00.000Z", message: "Collection started" },
    { at: "2026-07-16T09:47:00.000Z", message: "Collection completed" },
  ]);
  await seedJsonl(root, `${runDir}/logs.jsonl`, [
    { level: "info", message: "Career sites collected 2 records" },
    { level: "info", message: "Tavily collected 1 record" },
  ]);
}

async function seedSelections(root: string): Promise<void> {
  const selectionId = "SEL-20260716-001";
  const selectionDir = projectPath(DEMO_PROJECT_SLUG, "selections", selectionId);
  await ensureDir(path.join(root, selectionDir));

  const manifest: WorkspaceSelectionManifest = {
    id: selectionId,
    name: "Current report evidence",
    selectedRecordRefs: [
      "sources/external/normalized/jobs.jsonl#job-001",
      "sources/external/normalized/jobs.jsonl#job-002",
      "sources/external/normalized/news.jsonl#news-001",
    ],
    selectedFileRefs: [],
    createdAt: DEMO_NOW,
  };

  await writeIfMissing(
    root,
    projectPath(DEMO_PROJECT_SLUG, "selections/current.json"),
    manifest,
  );
  await writeIfMissing(root, `${selectionDir}/manifest.json`, manifest);
  await seedJsonl(root, `${selectionDir}/selected-records.jsonl`, [
    { ref: "sources/external/normalized/jobs.jsonl#job-001" },
    { ref: "sources/external/normalized/jobs.jsonl#job-002" },
    { ref: "sources/external/normalized/news.jsonl#news-001" },
  ]);
  await writeIfMissing(root, `${selectionDir}/selected-files.json`, []);
}

async function seedReport(root: string): Promise<void> {
  const reportDir = reportPath(DEMO_PROJECT_SLUG, DEMO_REPORT_SLUG);
  await ensureDir(path.join(root, reportDir));
  await ensureDir(path.join(root, `${reportDir}/input`));
  await ensureDir(path.join(root, `${reportDir}/derived`));
  await ensureDir(path.join(root, `${reportDir}/snapshots`));

  const metadata: WorkspaceReportMetadata = {
    id: DEMO_REPORT_SLUG,
    slug: DEMO_REPORT_SLUG,
    name: "China Automotive Hiring Comparison",
    templateId: "competitor-hiring-comparison",
    audience: "HR leadership",
    language: "English",
    goal: "Compare competitor hiring activity, role demand, and market signals.",
    status: "ready",
    currentHtmlPath: "current.html",
    sections: [
      {
        id: "executive-summary",
        title: "Executive Summary",
        selector: "[data-section-id='executive-summary']",
        order: 0,
        sourceRecordRefs: ["sources/external/normalized/news.jsonl#news-001"],
      },
      {
        id: "company-comparison",
        title: "Company Comparison",
        selector: "[data-section-id='company-comparison']",
        order: 1,
        sourceRecordRefs: [
          "sources/external/normalized/jobs.jsonl#job-001",
          "sources/external/normalized/jobs.jsonl#job-002",
        ],
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
  <title>China Automotive Hiring Comparison</title>
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
    <h1>China Automotive Hiring Comparison</h1>
    <p class="muted">Automotive · China · Generated from selected workspace data</p>
    <section data-section-id="executive-summary">
      <h2>Executive Summary</h2>
      <p>Selected hiring and market evidence indicates sustained demand for ADAS, embedded software, and platform engineering roles.</p>
    </section>
    <section data-section-id="company-comparison">
      <h2>Company Comparison</h2>
      <table>
        <thead><tr><th>Company</th><th>Signal</th><th>Role Focus</th></tr></thead>
        <tbody>
          <tr><td>Bosch</td><td>Active hiring</td><td>ADAS software</td></tr>
          <tr><td>Continental</td><td>Active hiring</td><td>Embedded systems</td></tr>
        </tbody>
      </table>
    </section>
  </main>
</body>
</html>
`;
}

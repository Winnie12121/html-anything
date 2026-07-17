import path from "node:path";
import {
  ensureDir,
  listDirectories,
  pathExists,
  readJsonFile,
  writeJsonFile,
  writeTextFile,
} from "./fs";
import { projectPath, reportPath, toWorkspaceSlug } from "./paths";
import { configuredWorkspaceRoot, readWorkspaceProject } from "./projects";
import { readWorkspaceData } from "./data";
import type {
  WorkspaceDataRecord,
  WorkspaceReportListItem,
  WorkspaceReportSetupView,
  WorkspaceReportsView,
  WorkspaceSuggestedInsight,
} from "./client";
import type { WorkspaceProject, WorkspaceReportMetadata } from "./schema";

export type CreateWorkspaceReportInput = {
  name: string;
  templateId: string;
  audience: string;
  language: string;
  goal: string;
  includedInsightIds: string[];
};

export type CreateWorkspaceReportResult = {
  report: WorkspaceReportMetadata;
  reportSlug: string;
};

export async function readWorkspaceReportSetup(
  projectSlug: string,
  root?: string,
): Promise<WorkspaceReportSetupView> {
  const dataView = await readWorkspaceData(projectSlug, root);
  const selectedSet = new Set(dataView.selection.selectedRecordRefs);
  const selectedRecords = dataView.records.filter((record) => selectedSet.has(record.ref));

  return {
    ...dataView,
    selectedRecords,
    suggestedInsights: suggestWorkspaceInsights(selectedRecords),
  };
}

export async function readWorkspaceReports(
  projectSlug: string,
  root?: string,
): Promise<WorkspaceReportsView> {
  const workspaceRoot = root ?? (await configuredWorkspaceRoot());
  const [projectSummary, reports] = await Promise.all([
    readWorkspaceProject(projectSlug, workspaceRoot),
    readReportMetadataList(workspaceRoot, projectSlug),
  ]);

  return {
    project: projectSummary.project,
    counts: { ...projectSummary.counts, reports: reports.length },
    reports,
  };
}

export async function createWorkspaceReport(
  projectSlug: string,
  input: CreateWorkspaceReportInput,
  root?: string,
): Promise<CreateWorkspaceReportResult> {
  const workspaceRoot = root ?? (await configuredWorkspaceRoot());
  const setup = await readWorkspaceReportSetup(projectSlug, workspaceRoot);
  const now = new Date().toISOString();
  const baseSlug = toWorkspaceSlug(input.name);
  const reportSlug = await nextReportSlug(workspaceRoot, projectSlug, baseSlug);
  const includedIds = new Set(input.includedInsightIds);
  const insights = setup.suggestedInsights.map((insight) => ({
    ...insight,
    included: includedIds.has(insight.id),
  }));
  const includedInsights = insights.filter((insight) => insight.included);
  const sections = buildSections(includedInsights, setup.selectedRecords);
  const reportDir = reportPath(projectSlug, reportSlug);

  await ensureDir(path.join(workspaceRoot, reportDir, "input"));
  await ensureDir(path.join(workspaceRoot, reportDir, "derived"));
  await ensureDir(path.join(workspaceRoot, reportDir, "snapshots"));

  const report: WorkspaceReportMetadata = {
    id: reportSlug,
    slug: reportSlug,
    name: input.name.trim() || "Untitled Insight Report",
    templateId: input.templateId,
    audience: input.audience.trim(),
    language: input.language.trim() || "English",
    goal: input.goal.trim(),
    status: "draft",
    currentHtmlPath: "current.html",
    sections,
    createdAt: now,
    updatedAt: now,
  };

  await writeJsonFile(workspaceRoot, `${reportDir}/report.json`, report);
  await writeJsonFile(workspaceRoot, `${reportDir}/comments.json`, []);
  await writeJsonFile(workspaceRoot, `${reportDir}/input/selection-manifest.json`, {
    selectionPath: "selections/current.json",
    selectedRecordRefs: setup.selection.selectedRecordRefs,
    selectedFileRefs: setup.selection.selectedFileRefs,
    capturedAt: now,
  });
  await writeTextFile(
    workspaceRoot,
    `${reportDir}/input/selected-records.jsonl`,
    setup.selectedRecords.map((record) => JSON.stringify(record)).join("\n") +
      (setup.selectedRecords.length ? "\n" : ""),
  );
  await writeJsonFile(workspaceRoot, `${reportDir}/derived/suggested-insights.json`, insights);
  await writeTextFile(
    workspaceRoot,
    `${reportDir}/current.html`,
    renderStandaloneReportHtml({
      project: setup.project,
      report,
      selectedRecords: setup.selectedRecords,
      insights: includedInsights,
    }),
  );

  const project = await readJsonFile<WorkspaceProject>(
    workspaceRoot,
    projectPath(projectSlug, "project.json"),
  );
  await writeJsonFile(
    workspaceRoot,
    projectPath(projectSlug, "project.json"),
    { ...project, updatedAt: now },
  );

  return { report, reportSlug };
}

async function readReportMetadataList(
  root: string,
  projectSlug: string,
): Promise<WorkspaceReportListItem[]> {
  let reportSlugs: string[];
  try {
    reportSlugs = await listDirectories(root, projectPath(projectSlug, "reports"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const reports: WorkspaceReportListItem[] = [];
  for (const slug of reportSlugs) {
    try {
      reports.push(
        await readJsonFile<WorkspaceReportMetadata>(
          root,
          reportPath(projectSlug, slug, "report.json"),
        ),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  return reports.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

async function nextReportSlug(
  root: string,
  projectSlug: string,
  baseSlug: string,
): Promise<string> {
  let candidate = baseSlug;
  let index = 2;
  while (await pathExists(path.join(root, reportPath(projectSlug, candidate)))) {
    candidate = `${baseSlug}-${index}`;
    index += 1;
  }
  return candidate;
}

function suggestWorkspaceInsights(
  records: WorkspaceDataRecord[],
): WorkspaceSuggestedInsight[] {
  const jobs = records.filter((record) => record.kind === "job");
  const news = records.filter((record) => record.kind === "news");
  const byCompany = topEntries(groupCount(jobs, "company"));
  const byLocation = topEntries(groupCount(jobs, "location"));
  const skillCounts = topEntries(groupArrayCount(jobs, "skills"));
  const insights: WorkspaceSuggestedInsight[] = [];

  if (jobs.length > 0) {
    insights.push({
      id: "metric-job-volume",
      type: "metric",
      title: "Hiring volume and company coverage",
      rationale: "Selected job records can support headline hiring metrics.",
      recordRefs: jobs.map((record) => record.ref),
      config: {
        jobs: jobs.length,
        companies: new Set(jobs.map((record) => String(record.fields.company ?? ""))).size,
      },
      included: true,
    });
  }

  if (byCompany.length > 0) {
    insights.push({
      id: "chart-company-comparison",
      type: "chart",
      title: "Hiring activity by company",
      rationale: "Company-level counts reveal which competitors are most active.",
      recordRefs: jobs.map((record) => record.ref),
      config: { chart: "bar", values: byCompany },
      included: true,
    });
  }

  if (skillCounts.length > 0) {
    insights.push({
      id: "table-skill-demand",
      type: "table",
      title: "Skill demand signals",
      rationale: "Skill mentions reveal repeated capability needs in selected roles.",
      recordRefs: jobs.map((record) => record.ref),
      config: { columns: ["Skill", "Records"], values: skillCounts },
      included: true,
    });
  }

  if (byLocation.length > 0) {
    insights.push({
      id: "chart-location-distribution",
      type: "chart",
      title: "Geographic distribution",
      rationale: "Location spread helps identify market concentration.",
      recordRefs: jobs.map((record) => record.ref),
      config: { chart: "bar", values: byLocation },
      included: true,
    });
  }

  if (news.length > 0) {
    insights.push({
      id: "narrative-market-signals",
      type: "narrative",
      title: "Market signals from collected news",
      rationale: "News records add context around company moves and demand signals.",
      recordRefs: news.map((record) => record.ref),
      config: { records: news.length },
      included: true,
    });
  }

  if (insights.length === 0 && records.length > 0) {
    insights.push({
      id: "narrative-selected-evidence",
      type: "narrative",
      title: "Evidence summary",
      rationale: "Selected records can anchor the report narrative.",
      recordRefs: records.map((record) => record.ref),
      config: { records: records.length },
      included: true,
    });
  }

  return insights;
}

function buildSections(
  insights: WorkspaceSuggestedInsight[],
  records: WorkspaceDataRecord[],
): WorkspaceReportMetadata["sections"] {
  const sourceRefs = records.slice(0, 12).map((record) => record.ref);
  return [
    {
      id: "executive-summary",
      title: "Executive Summary",
      selector: "[data-section-id='executive-summary']",
      order: 0,
      sourceRecordRefs: sourceRefs,
    },
    ...insights.map((insight, index) => ({
      id: insight.id,
      title: insight.title,
      selector: `[data-section-id='${insight.id}']`,
      order: index + 1,
      sourceRecordRefs: insight.recordRefs,
    })),
    {
      id: "sources",
      title: "Sources",
      selector: "[data-section-id='sources']",
      order: insights.length + 1,
      sourceRecordRefs: sourceRefs,
    },
  ];
}

function renderStandaloneReportHtml({
  project,
  report,
  selectedRecords,
  insights,
}: {
  project: WorkspaceProject;
  report: WorkspaceReportMetadata;
  selectedRecords: WorkspaceDataRecord[];
  insights: WorkspaceSuggestedInsight[];
}): string {
  const jobRecords = selectedRecords.filter((record) => record.kind === "job");
  const companyRows = topEntries(groupCount(jobRecords, "company"), 10)
    .map(({ label, value }) => `<tr><td>${escapeHtml(label)}</td><td>${value}</td></tr>`)
    .join("");
  const sourceRows = selectedRecords
    .slice(0, 20)
    .map(
      (record) =>
        `<tr><td>${escapeHtml(record.title)}</td><td>${escapeHtml(record.kind)}</td><td>${escapeHtml(record.sourceId)}</td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="${report.language.toLowerCase().startsWith("chinese") ? "zh" : "en"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(report.name)}</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; color: #20242a; background: #f5f6f8; }
    main { max-width: 940px; margin: 32px auto; background: #fff; border: 1px solid #d9dee7; padding: 40px; }
    h1 { margin: 0 0 8px; font-size: 34px; line-height: 1.15; }
    h2 { margin: 0 0 12px; font-size: 22px; }
    .muted { color: #6f7782; }
    .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 24px 0; }
    .metric { border: 1px solid #dfe4eb; padding: 16px; }
    .metric strong { display: block; color: #005ea8; font-size: 28px; }
    section { border-top: 1px solid #e3e7ed; margin-top: 28px; padding-top: 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #e3e7ed; padding: 10px; text-align: left; vertical-align: top; }
    th { background: #f6f8fa; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(report.name)}</h1>
    <p class="muted">${escapeHtml(project.industry)} · ${escapeHtml(project.region)} · ${escapeHtml(report.audience)}</p>
    <p>${escapeHtml(report.goal)}</p>
    <div class="metrics">
      <div class="metric"><strong>${selectedRecords.length}</strong><span>Records analyzed</span></div>
      <div class="metric"><strong>${jobRecords.length}</strong><span>Job records</span></div>
      <div class="metric"><strong>${insights.length}</strong><span>Included insights</span></div>
    </div>
    <section data-section-id="executive-summary">
      <h2>Executive Summary</h2>
      <p>This draft report was generated from the current workspace selection. It consolidates selected hiring, company, geography, skill, and market signal evidence into a single standalone HTML document.</p>
    </section>
    ${insights.map((insight) => renderInsightSection(insight, companyRows)).join("\n")}
    <section data-section-id="sources">
      <h2>Sources</h2>
      <table>
        <thead><tr><th>Record</th><th>Type</th><th>Source</th></tr></thead>
        <tbody>${sourceRows || "<tr><td colspan=\"3\">No selected records.</td></tr>"}</tbody>
      </table>
    </section>
  </main>
</body>
</html>`;
}

function renderInsightSection(
  insight: WorkspaceSuggestedInsight,
  companyRows: string,
): string {
  if (insight.id === "chart-company-comparison") {
    return `<section data-section-id="${escapeHtml(insight.id)}">
      <h2>${escapeHtml(insight.title)}</h2>
      <p>${escapeHtml(insight.rationale)}</p>
      <table>
        <thead><tr><th>Company</th><th>Selected records</th></tr></thead>
        <tbody>${companyRows || "<tr><td colspan=\"2\">No company field available.</td></tr>"}</tbody>
      </table>
    </section>`;
  }

  const values = Array.isArray(insight.config.values)
    ? (insight.config.values as Array<{ label: string; value: number }>)
    : [];
  const rows = values
    .map(({ label, value }) => `<tr><td>${escapeHtml(label)}</td><td>${value}</td></tr>`)
    .join("");

  return `<section data-section-id="${escapeHtml(insight.id)}">
      <h2>${escapeHtml(insight.title)}</h2>
      <p>${escapeHtml(insight.rationale)}</p>
      ${
        rows
          ? `<table><thead><tr><th>Signal</th><th>Records</th></tr></thead><tbody>${rows}</tbody></table>`
          : `<p>Included records: ${insight.recordRefs.length}</p>`
      }
    </section>`;
}

function groupCount(records: WorkspaceDataRecord[], field: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const record of records) {
    const value = record.fields[field];
    if (typeof value === "string" && value.trim()) {
      counts[value] = (counts[value] ?? 0) + 1;
    }
  }
  return counts;
}

function groupArrayCount(records: WorkspaceDataRecord[], field: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const record of records) {
    const value = record.fields[field];
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      if (typeof entry !== "string" || !entry.trim()) continue;
      counts[entry] = (counts[entry] ?? 0) + 1;
    }
  }
  return counts;
}

function topEntries(counts: Record<string, number>, limit = 5): Array<{ label: string; value: number }> {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

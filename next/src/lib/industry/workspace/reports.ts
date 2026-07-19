import path from "node:path";
import {
  ensureDir,
  listDirectories,
  pathExists,
  readJsonFile,
  readJsonlFile,
  readTextFile,
  removeWorkspacePath,
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
  WorkspaceReportStudioView,
  WorkspaceReportsView,
  WorkspaceSuggestedInsight,
} from "./client";
import type {
  WorkspaceProject,
  WorkspaceReportComment,
  WorkspaceReportMetadata,
} from "./schema";

export type CreateWorkspaceReportInput = {
  name: string;
  templateId: string;
  audience: string;
  language: string;
  goal: string;
  includedInsightIds: string[];
  generatedHtml?: string;
};

export type CreateWorkspaceReportResult = {
  report: WorkspaceReportMetadata;
  reportSlug: string;
};

export type SaveWorkspaceReportHtmlInput = {
  html: string;
};

export type AddWorkspaceReportCommentInput = {
  sectionId?: string;
  text: string;
  general?: boolean;
  refs?: Array<{
    id: string;
    tag: string;
    snippet: string;
  }>;
};

export type BuildWorkspaceReportRegenerationPromptInput = {
  instruction?: string;
  commentIds?: string[];
};

export type SaveRegeneratedWorkspaceReportHtmlInput = {
  html: string;
};

export async function buildWorkspaceReportGenerationPrompt(
  projectSlug: string,
  input: CreateWorkspaceReportInput,
  root?: string,
): Promise<string> {
  const setup = await readWorkspaceReportSetup(projectSlug, root);
  const includedIds = new Set(input.includedInsightIds);
  const includedInsights = setup.suggestedInsights.filter((insight) =>
    includedIds.has(insight.id),
  );
  const sectionPlan = buildSections(includedInsights, setup.selectedRecords);
  const records = setup.selectedRecords.slice(0, 80);
  const recordPayload = records.map((record) => ({
    ref: record.ref,
    kind: record.kind,
    title: record.title,
    summary: record.summary,
    fields: record.fields,
    rawText: record.rawText.slice(0, 1600),
    url: record.url,
  }));

  return `You are generating an editable business insight report for Industry Insight Studio.

Hard requirements:
- Output one complete standalone single-page HTML document only.
- Do not split sections into separate files.
- Do not use markdown fences and do not add explanatory text.
- First non-whitespace characters must be <!doctype html> or <!DOCTYPE html>.
- The document must include all CSS inside <style> tags and should work when opened directly from disk.
- Do not use external images. Use tables, inline SVG, or CSS for visuals.
- Use professional research-workspace styling: neutral background, subtle borders, dense readable tables, restrained accent color.
- Every report section must be represented inside this same HTML file.
- Include data-section-id attributes that match the section plan below.
- Do not invent facts beyond the selected records. If evidence is limited, say so plainly.

Project:
${JSON.stringify({
  name: setup.project.name,
  industry: setup.project.industry,
  region: setup.project.region,
  tags: setup.project.tags,
}, null, 2)}

Report metadata:
${JSON.stringify({
  name: input.name,
  templateId: input.templateId,
  audience: input.audience,
  language: input.language,
  goal: input.goal,
}, null, 2)}

Section plan:
${JSON.stringify(sectionPlan, null, 2)}

Suggested insights to include:
${JSON.stringify(includedInsights, null, 2)}

Selected records:
${JSON.stringify(recordPayload, null, 2)}

Return only the final HTML document.`;
}

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

export async function readWorkspaceReportStudio(
  projectSlug: string,
  reportSlug: string,
  root?: string,
): Promise<WorkspaceReportStudioView> {
  const workspaceRoot = root ?? (await configuredWorkspaceRoot());
  const projectSummary = await readWorkspaceProject(projectSlug, workspaceRoot);
  const report = await readJsonFile<WorkspaceReportMetadata>(
    workspaceRoot,
    reportPath(projectSlug, reportSlug, "report.json"),
  );
  const [html, comments, selectedRecords, suggestedInsights] = await Promise.all([
    readTextFile(workspaceRoot, reportPath(projectSlug, reportSlug, report.currentHtmlPath)),
    readReportComments(workspaceRoot, projectSlug, reportSlug),
    readSelectedRecords(workspaceRoot, projectSlug, reportSlug),
    readSuggestedInsights(workspaceRoot, projectSlug, reportSlug),
  ]);

  return {
    project: projectSummary.project,
    counts: projectSummary.counts,
    report,
    html,
    comments,
    selectedRecords,
    suggestedInsights,
  };
}

export async function saveWorkspaceReportHtml(
  projectSlug: string,
  reportSlug: string,
  input: SaveWorkspaceReportHtmlInput,
  root?: string,
): Promise<WorkspaceReportMetadata> {
  const workspaceRoot = root ?? (await configuredWorkspaceRoot());
  const report = await readJsonFile<WorkspaceReportMetadata>(
    workspaceRoot,
    reportPath(projectSlug, reportSlug, "report.json"),
  );
  const now = new Date().toISOString();
  const nextReport: WorkspaceReportMetadata = {
    ...report,
    updatedAt: now,
  };

  await writeTextFile(
    workspaceRoot,
    reportPath(projectSlug, reportSlug, report.currentHtmlPath),
    input.html,
  );
  await writeJsonFile(
    workspaceRoot,
    reportPath(projectSlug, reportSlug, "report.json"),
    nextReport,
  );
  await touchProject(workspaceRoot, projectSlug, now);

  return nextReport;
}

export async function buildWorkspaceReportRegenerationPrompt(
  projectSlug: string,
  reportSlug: string,
  input: BuildWorkspaceReportRegenerationPromptInput = {},
  root?: string,
): Promise<string> {
  const workspaceRoot = root ?? (await configuredWorkspaceRoot());
  const [projectSummary, report, comments] = await Promise.all([
    readWorkspaceProject(projectSlug, workspaceRoot),
    readJsonFile<WorkspaceReportMetadata>(
      workspaceRoot,
      reportPath(projectSlug, reportSlug, "report.json"),
    ),
    readReportComments(workspaceRoot, projectSlug, reportSlug),
  ]);
  const html = await readTextFile(
    workspaceRoot,
    reportPath(projectSlug, reportSlug, report.currentHtmlPath),
  );
  const requestedIds = input.commentIds?.length ? new Set(input.commentIds) : null;
  const selectedComments = comments.filter((comment) =>
    !comment.resolved && (!requestedIds || requestedIds.has(comment.id)),
  );

  if (selectedComments.length === 0) {
    throw new Error("At least one unresolved comment is required");
  }

  return `You are revising an existing standalone HTML report for Industry Insight Studio.

Hard requirements:
- Return one complete standalone HTML document only.
- Do not use markdown fences and do not add explanatory text.
- First non-whitespace characters must be <!doctype html> or <!DOCTYPE html>.
- Preserve the current visual direction, CSS, layout, and data evidence unless a comment explicitly asks for a change.
- Apply only the comments below. Do not invent facts beyond the current HTML.
- Keep report content professional for ${report.audience || "business readers"}.

Project:
${JSON.stringify({
  name: projectSummary.project.name,
  industry: projectSummary.project.industry,
  region: projectSummary.project.region,
}, null, 2)}

Report:
${JSON.stringify({
  name: report.name,
  language: report.language,
  goal: report.goal,
}, null, 2)}

${input.instruction?.trim() ? `Additional instruction:\n${input.instruction.trim()}\n\n` : ""}## CURRENT HTML

\`\`\`html
${html}
\`\`\`

## COMMENTS TO APPLY

${formatRegenerationComments(selectedComments)}

Return only the final revised HTML document.`;
}

export async function saveRegeneratedWorkspaceReportHtml(
  projectSlug: string,
  reportSlug: string,
  input: SaveRegeneratedWorkspaceReportHtmlInput,
  root?: string,
): Promise<{ report: WorkspaceReportMetadata; snapshotPath: string }> {
  const workspaceRoot = root ?? (await configuredWorkspaceRoot());
  const report = await readJsonFile<WorkspaceReportMetadata>(
    workspaceRoot,
    reportPath(projectSlug, reportSlug, "report.json"),
  );
  const previousHtml = await readTextFile(
    workspaceRoot,
    reportPath(projectSlug, reportSlug, report.currentHtmlPath),
  );
  const now = new Date().toISOString();
  const snapshotName = `${now.replace(/[:.]/g, "-")}.html`;
  const snapshotPath = reportPath(projectSlug, reportSlug, "snapshots", snapshotName);
  const nextReport: WorkspaceReportMetadata = {
    ...report,
    updatedAt: now,
  };

  await writeTextFile(workspaceRoot, snapshotPath, previousHtml);
  await writeTextFile(
    workspaceRoot,
    reportPath(projectSlug, reportSlug, report.currentHtmlPath),
    input.html,
  );
  await writeJsonFile(
    workspaceRoot,
    reportPath(projectSlug, reportSlug, "report.json"),
    nextReport,
  );
  await touchProject(workspaceRoot, projectSlug, now);

  return { report: nextReport, snapshotPath };
}

export async function addWorkspaceReportComment(
  projectSlug: string,
  reportSlug: string,
  input: AddWorkspaceReportCommentInput,
  root?: string,
): Promise<WorkspaceReportComment> {
  const workspaceRoot = root ?? (await configuredWorkspaceRoot());
  const comments = await readReportComments(workspaceRoot, projectSlug, reportSlug);
  const now = new Date().toISOString();
  const comment: WorkspaceReportComment = {
    id: `comment-${Date.now().toString(36)}`,
    ...(input.sectionId ? { sectionId: input.sectionId } : {}),
    ...(input.general ? { general: true } : {}),
    ...(input.refs?.length ? { refs: input.refs } : {}),
    text: input.text.trim(),
    resolved: false,
    createdAt: now,
  };

  await writeJsonFile(
    workspaceRoot,
    reportPath(projectSlug, reportSlug, "comments.json"),
    [...comments, comment],
  );
  await touchReportAndProject(workspaceRoot, projectSlug, reportSlug, now);

  return comment;
}

function formatRegenerationComments(comments: WorkspaceReportComment[]): string {
  const general = comments.filter((comment) => comment.general || !comment.refs?.length);
  const anchored = comments.filter((comment) => comment.refs?.length);
  const lines: string[] = [];

  if (general.length > 0) {
    lines.push("### Whole-document notes", "");
    for (const comment of general) {
      lines.push(`- ${comment.text}`);
    }
    lines.push("");
  }

  if (anchored.length > 0) {
    lines.push(`### Anchored comments (${anchored.length})`, "");
    anchored.forEach((comment, index) => {
      const targets = (comment.refs ?? [])
        .map((ref) => `<${ref.tag}> "${ref.snippet}"`)
        .join(" + ");
      lines.push(`${index + 1}. ${targets}`, `   ${comment.text}`, "");
    });
  }

  return lines.join("\n").trim();
}

export async function resolveWorkspaceReportComment(
  projectSlug: string,
  reportSlug: string,
  commentId: string,
  root?: string,
): Promise<WorkspaceReportComment[]> {
  const workspaceRoot = root ?? (await configuredWorkspaceRoot());
  const now = new Date().toISOString();
  const comments = await readReportComments(workspaceRoot, projectSlug, reportSlug);
  const nextComments = comments.map((comment) =>
    comment.id === commentId
      ? { ...comment, resolved: true, updatedAt: now }
      : comment,
  );

  await writeJsonFile(
    workspaceRoot,
    reportPath(projectSlug, reportSlug, "comments.json"),
    nextComments,
  );
  await touchReportAndProject(workspaceRoot, projectSlug, reportSlug, now);

  return nextComments;
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
    input.generatedHtml?.trim() ||
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

export async function deleteWorkspaceReport(
  projectSlug: string,
  reportSlug: string,
  root?: string,
): Promise<void> {
  const workspaceRoot = root ?? (await configuredWorkspaceRoot());
  const reportJsonPath = reportPath(projectSlug, reportSlug, "report.json");
  if (!(await pathExists(path.join(workspaceRoot, reportJsonPath)))) {
    throw notFoundError(`Report not found: ${reportSlug}`);
  }

  await removeWorkspacePath(workspaceRoot, reportPath(projectSlug, reportSlug));
  await touchProject(workspaceRoot, projectSlug, new Date().toISOString());
}

async function readReportComments(
  root: string,
  projectSlug: string,
  reportSlug: string,
): Promise<WorkspaceReportComment[]> {
  try {
    return await readJsonFile<WorkspaceReportComment[]>(
      root,
      reportPath(projectSlug, reportSlug, "comments.json"),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return [];
  }
}

async function readSelectedRecords(
  root: string,
  projectSlug: string,
  reportSlug: string,
): Promise<WorkspaceDataRecord[]> {
  try {
    return await readJsonlFile<WorkspaceDataRecord>(
      root,
      reportPath(projectSlug, reportSlug, "input/selected-records.jsonl"),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return [];
  }
}

async function readSuggestedInsights(
  root: string,
  projectSlug: string,
  reportSlug: string,
): Promise<WorkspaceSuggestedInsight[]> {
  try {
    return await readJsonFile<WorkspaceSuggestedInsight[]>(
      root,
      reportPath(projectSlug, reportSlug, "derived/suggested-insights.json"),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return [];
  }
}

async function touchReportAndProject(
  root: string,
  projectSlug: string,
  reportSlug: string,
  updatedAt: string,
): Promise<void> {
  const report = await readJsonFile<WorkspaceReportMetadata>(
    root,
    reportPath(projectSlug, reportSlug, "report.json"),
  );
  await writeJsonFile(
    root,
    reportPath(projectSlug, reportSlug, "report.json"),
    { ...report, updatedAt },
  );
  await touchProject(root, projectSlug, updatedAt);
}

async function touchProject(
  root: string,
  projectSlug: string,
  updatedAt: string,
): Promise<void> {
  const project = await readJsonFile<WorkspaceProject>(
    root,
    projectPath(projectSlug, "project.json"),
  );
  await writeJsonFile(root, projectPath(projectSlug, "project.json"), {
    ...project,
    updatedAt,
  });
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

function notFoundError(message: string): Error {
  return Object.assign(new Error(message), { code: "ENOENT" });
}

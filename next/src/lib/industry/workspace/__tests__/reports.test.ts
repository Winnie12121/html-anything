import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEMO_PROJECT_SLUG,
  ensureDemoWorkspace,
} from "../bootstrap";
import { readJsonFile } from "../fs";
import { readWorkspaceProject } from "../projects";
import {
  addWorkspaceReportComment,
  buildWorkspaceReportGenerationPrompt,
  buildWorkspaceReportRegenerationPrompt,
  createWorkspaceReport,
  deleteWorkspaceReport,
  readWorkspaceReportSetup,
  readWorkspaceReportStudio,
  readWorkspaceReports,
  resolveWorkspaceReportComment,
  saveRegeneratedWorkspaceReportHtml,
  saveWorkspaceReportHtml,
} from "../reports";
import type { WorkspaceReportComment, WorkspaceReportMetadata } from "../schema";

describe("workspace reports", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "iis-reports-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("builds report setup from current selection and suggested insights", async () => {
    await ensureDemoWorkspace(root);

    const setup = await readWorkspaceReportSetup(DEMO_PROJECT_SLUG, root);

    expect(setup.selectedRecords).toHaveLength(2);
    expect(setup.suggestedInsights.map((insight) => insight.id)).toEqual(
      expect.arrayContaining([
        "metric-job-volume",
        "chart-company-comparison",
        "chart-location-distribution",
      ]),
    );
  });

  it("creates a report directory with a single current.html document", async () => {
    await ensureDemoWorkspace(root);

    const result = await createWorkspaceReport(
      DEMO_PROJECT_SLUG,
      {
        name: "ADAS Talent Snapshot",
        templateId: "competitor-hiring-comparison",
        audience: "HR leadership",
        language: "English",
        goal: "Summarize selected talent signals.",
        includedInsightIds: ["metric-job-volume", "chart-company-comparison"],
      },
      root,
    );

    expect(result.reportSlug).toBe("adas-talent-snapshot");

    const reportRoot = path.join(
      root,
      "projects",
      DEMO_PROJECT_SLUG,
      "reports",
      result.reportSlug,
    );
    const metadata = await readJsonFile<WorkspaceReportMetadata>(
      root,
      `projects/${DEMO_PROJECT_SLUG}/reports/${result.reportSlug}/report.json`,
    );
    const html = await readFile(path.join(reportRoot, "current.html"), "utf8");

    expect(metadata.currentHtmlPath).toBe("current.html");
    expect(metadata.sections.map((section) => section.id)).toEqual(
      expect.arrayContaining(["executive-summary", "metric-job-volume", "sources"]),
    );
    expect(html).toContain("<!doctype html>");
    expect(html).toContain('data-section-id="executive-summary"');
    expect(html).toContain("ADAS Talent Snapshot");

    const reports = await readWorkspaceReports(DEMO_PROJECT_SLUG, root);
    expect(reports.reports.some((report) => report.slug === result.reportSlug)).toBe(true);
  });

  it("uses the same valid report count as the project summary", async () => {
    await ensureDemoWorkspace(root);

    const [project, reports] = await Promise.all([
      readWorkspaceProject(DEMO_PROJECT_SLUG, root),
      readWorkspaceReports(DEMO_PROJECT_SLUG, root),
    ]);

    expect(reports.counts.reports).toBe(project.counts.reports);
    expect(reports.counts.reports).toBe(reports.reports.length);
  });

  it("builds a CLI report prompt that requires one standalone HTML file", async () => {
    await ensureDemoWorkspace(root);

    const prompt = await buildWorkspaceReportGenerationPrompt(
      DEMO_PROJECT_SLUG,
      {
        name: "CLI Generated Report",
        templateId: "competitor-hiring-comparison",
        audience: "HR leadership",
        language: "English",
        goal: "Generate with a local CLI.",
        includedInsightIds: ["metric-job-volume"],
      },
      root,
    );

    expect(prompt).toContain("one complete standalone single-page HTML document");
    expect(prompt).toContain("Do not split sections into separate files");
    expect(prompt).toContain("data-section-id");
    expect(prompt).toContain("CLI Generated Report");
  });

  it("stores externally generated HTML as the report current.html", async () => {
    await ensureDemoWorkspace(root);

    const { reportSlug } = await createWorkspaceReport(
      DEMO_PROJECT_SLUG,
      {
        name: "CLI HTML Report",
        templateId: "competitor-hiring-comparison",
        audience: "HR leadership",
        language: "English",
        goal: "Use generated HTML.",
        includedInsightIds: ["metric-job-volume"],
        generatedHtml: "<!doctype html><html><body><h1>CLI Output</h1></body></html>",
      },
      root,
    );

    const studio = await readWorkspaceReportStudio(DEMO_PROJECT_SLUG, reportSlug, root);
    expect(studio.html).toBe("<!doctype html><html><body><h1>CLI Output</h1></body></html>");
  });

  it("loads and saves report studio HTML from current.html", async () => {
    await ensureDemoWorkspace(root);
    const { reportSlug } = await createWorkspaceReport(
      DEMO_PROJECT_SLUG,
      {
        name: "Editable Studio Report",
        templateId: "executive-industry-brief",
        audience: "Strategy team",
        language: "English",
        goal: "Prepare an editable report.",
        includedInsightIds: ["metric-job-volume"],
      },
      root,
    );

    const studio = await readWorkspaceReportStudio(DEMO_PROJECT_SLUG, reportSlug, root);
    expect(studio.html).toContain("Editable Studio Report");
    expect(studio.report.currentHtmlPath).toBe("current.html");

    await saveWorkspaceReportHtml(
      DEMO_PROJECT_SLUG,
      reportSlug,
      { html: "<!doctype html><html><body><h1>Edited</h1></body></html>" },
      root,
    );

    const nextStudio = await readWorkspaceReportStudio(DEMO_PROJECT_SLUG, reportSlug, root);
    expect(nextStudio.html).toContain("<h1>Edited</h1>");
  });

  it("deletes a report directory and updates the reports list", async () => {
    await ensureDemoWorkspace(root);
    const { reportSlug } = await createWorkspaceReport(
      DEMO_PROJECT_SLUG,
      {
        name: "Delete Me",
        templateId: "executive-industry-brief",
        audience: "Strategy team",
        language: "English",
        goal: "Prepare a disposable report.",
        includedInsightIds: ["metric-job-volume"],
      },
      root,
    );

    await deleteWorkspaceReport(DEMO_PROJECT_SLUG, reportSlug, root);

    const reports = await readWorkspaceReports(DEMO_PROJECT_SLUG, root);
    expect(reports.reports.some((report) => report.slug === reportSlug)).toBe(false);
    await expect(
      readWorkspaceReportStudio(DEMO_PROJECT_SLUG, reportSlug, root),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("writes and resolves report comments in comments.json", async () => {
    await ensureDemoWorkspace(root);
    const { reportSlug } = await createWorkspaceReport(
      DEMO_PROJECT_SLUG,
      {
        name: "Commented Studio Report",
        templateId: "executive-industry-brief",
        audience: "Strategy team",
        language: "English",
        goal: "Prepare comments.",
        includedInsightIds: ["metric-job-volume"],
      },
      root,
    );

    const comment = await addWorkspaceReportComment(
      DEMO_PROJECT_SLUG,
      reportSlug,
      {
        sectionId: "executive-summary",
        text: "Make the opening sharper.",
      },
      root,
    );
    expect(comment.resolved).toBe(false);

    await resolveWorkspaceReportComment(DEMO_PROJECT_SLUG, reportSlug, comment.id, root);
    const comments = await readJsonFile<WorkspaceReportComment[]>(
      root,
      `projects/${DEMO_PROJECT_SLUG}/reports/${reportSlug}/comments.json`,
    );
    expect(comments).toMatchObject([
      {
        id: comment.id,
        sectionId: "executive-summary",
        resolved: true,
      },
    ]);
  });

  it("writes anchored and general report comments", async () => {
    await ensureDemoWorkspace(root);
    const { reportSlug } = await createWorkspaceReport(
      DEMO_PROJECT_SLUG,
      {
        name: "Anchored Comments Report",
        templateId: "executive-industry-brief",
        audience: "Strategy team",
        language: "English",
        goal: "Prepare comments.",
        includedInsightIds: ["metric-job-volume"],
      },
      root,
    );

    const anchored = await addWorkspaceReportComment(
      DEMO_PROJECT_SLUG,
      reportSlug,
      {
        text: "Make this claim more specific.",
        refs: [{ id: "b12", tag: "p", snippet: "Hiring volume increased" }],
      },
      root,
    );
    const general = await addWorkspaceReportComment(
      DEMO_PROJECT_SLUG,
      reportSlug,
      {
        text: "Make the whole report more executive-ready.",
        general: true,
      },
      root,
    );

    const comments = await readJsonFile<WorkspaceReportComment[]>(
      root,
      `projects/${DEMO_PROJECT_SLUG}/reports/${reportSlug}/comments.json`,
    );
    expect(comments).toMatchObject([
      { id: anchored.id, refs: [{ id: "b12", tag: "p" }], resolved: false },
      { id: general.id, general: true, resolved: false },
    ]);
  });

  it("builds a regeneration prompt and snapshots previous HTML", async () => {
    await ensureDemoWorkspace(root);
    const { reportSlug } = await createWorkspaceReport(
      DEMO_PROJECT_SLUG,
      {
        name: "Regenerate Comments Report",
        templateId: "executive-industry-brief",
        audience: "Strategy team",
        language: "English",
        goal: "Prepare comments.",
        includedInsightIds: ["metric-job-volume"],
        generatedHtml: "<!doctype html><html><body><h1>Before</h1><p>Hiring volume increased</p></body></html>",
      },
      root,
    );
    await addWorkspaceReportComment(
      DEMO_PROJECT_SLUG,
      reportSlug,
      {
        text: "Quantify this and make it sharper.",
        refs: [{ id: "b2", tag: "p", snippet: "Hiring volume increased" }],
      },
      root,
    );

    const prompt = await buildWorkspaceReportRegenerationPrompt(DEMO_PROJECT_SLUG, reportSlug, {}, root);
    expect(prompt).toContain("Apply only the comments below");
    expect(prompt).toContain("<p> \"Hiring volume increased\"");
    expect(prompt).toContain("Quantify this and make it sharper.");
    expect(prompt).toContain("<h1>Before</h1>");

    const result = await saveRegeneratedWorkspaceReportHtml(
      DEMO_PROJECT_SLUG,
      reportSlug,
      { html: "<!doctype html><html><body><h1>After</h1></body></html>" },
      root,
    );
    const nextStudio = await readWorkspaceReportStudio(DEMO_PROJECT_SLUG, reportSlug, root);
    const snapshot = await readFile(path.join(root, result.snapshotPath), "utf8");

    expect(nextStudio.html).toContain("<h1>After</h1>");
    expect(snapshot).toContain("<h1>Before</h1>");
  });
});

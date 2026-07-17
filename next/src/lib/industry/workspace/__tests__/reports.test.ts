import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEMO_PROJECT_SLUG,
  ensureDemoWorkspace,
} from "../bootstrap";
import { readJsonFile } from "../fs";
import {
  addWorkspaceReportComment,
  createWorkspaceReport,
  readWorkspaceReportSetup,
  readWorkspaceReportStudio,
  readWorkspaceReports,
  resolveWorkspaceReportComment,
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

    expect(setup.selectedRecords).toHaveLength(3);
    expect(setup.suggestedInsights.map((insight) => insight.id)).toEqual(
      expect.arrayContaining([
        "metric-job-volume",
        "chart-company-comparison",
        "narrative-market-signals",
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
});

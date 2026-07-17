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
  createWorkspaceReport,
  readWorkspaceReportSetup,
  readWorkspaceReports,
} from "../reports";
import type { WorkspaceReportMetadata } from "../schema";

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
});

import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEMO_PROJECT_SLUG,
  DEMO_REPORT_SLUG,
  ensureDemoWorkspace,
} from "../bootstrap";
import { readJsonFile, readJsonlFile, readTextFile } from "../fs";
import type {
  WorkspaceProject,
  WorkspaceReportMetadata,
  WorkspaceSourceConfig,
} from "../schema";

describe("demo workspace bootstrap", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "iis-demo-workspace-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("creates the project workspace layout", async () => {
    await ensureDemoWorkspace(root);

    await expect(readFile(path.join(root, "workspace.json"), "utf8")).resolves.toContain(
      "Industry Insight Studio Demo",
    );

    const project = await readJsonFile<WorkspaceProject>(
      root,
      `projects/${DEMO_PROJECT_SLUG}/project.json`,
    );
    expect(project.slug).toBe(DEMO_PROJECT_SLUG);
    expect(project.name).toBe("Automotive Semiconductor HR Market Insight");
    expect(project.trackedCompanies).toEqual([
      "英飞凌",
      "德州仪器",
      "高通",
      "意法半导体",
      "恩智浦",
    ]);

    const sources = await readJsonFile<WorkspaceSourceConfig>(
      root,
      `projects/${DEMO_PROJECT_SLUG}/source-config.json`,
    );
    expect(sources.sources.map((source) => source.id)).toEqual(["liepin", "tavily"]);
    expect(sources.sources[0]?.displayName).toBe("Liepin scraper");
    expect(sources.sources[0]?.description.toLowerCase()).not.toContain("mock");

    const jobs = await readJsonlFile<{ id: string; fields: { company?: string } }>(
      root,
      `projects/${DEMO_PROJECT_SLUG}/sources/external/normalized/jobs.jsonl`,
    );
    expect(jobs).toHaveLength(150);
    expect(new Set(jobs.map((job) => job.fields.company))).toEqual(
      new Set(["英飞凌", "德州仪器", "高通", "意法半导体", "恩智浦"]),
    );
    expect(countCompanies(jobs)).toEqual({
      英飞凌: 42,
      德州仪器: 36,
      高通: 31,
      意法半导体: 23,
      恩智浦: 18,
    });
  });

  it("creates one standalone report html file with section selectors", async () => {
    await ensureDemoWorkspace(root);

    const report = await readJsonFile<WorkspaceReportMetadata>(
      root,
      `projects/${DEMO_PROJECT_SLUG}/reports/${DEMO_REPORT_SLUG}/report.json`,
    );
    expect(report.currentHtmlPath).toBe("current.html");
    expect(report.sections.map((section) => section.selector)).toEqual([
      "[data-section-id='executive-summary']",
      "[data-section-id='company-comparison']",
    ]);

    const html = await readTextFile(
      root,
      `projects/${DEMO_PROJECT_SLUG}/reports/${DEMO_REPORT_SLUG}/current.html`,
    );
    expect(html).toContain("<!doctype html>");
    expect(html).toContain('data-section-id="executive-summary"');
    expect(html).toContain('data-section-id="company-comparison"');
  });

  it("does not overwrite existing workspace files", async () => {
    await ensureDemoWorkspace(root);
    const projectPath = `projects/${DEMO_PROJECT_SLUG}/project.json`;
    const first = await readTextFile(root, projectPath);

    await ensureDemoWorkspace(root);
    await expect(readTextFile(root, projectPath)).resolves.toBe(first);
  });
});

function countCompanies(jobs: Array<{ fields: { company?: string } }>): Record<string, number> {
  return jobs.reduce<Record<string, number>>((counts, job) => {
    const company = job.fields.company ?? "";
    counts[company] = (counts[company] ?? 0) + 1;
    return counts;
  }, {});
}

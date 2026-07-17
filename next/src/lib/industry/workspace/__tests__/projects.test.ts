import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEMO_PROJECT_SLUG,
  DEMO_REPORT_SLUG,
  ensureDemoWorkspace,
} from "../bootstrap";
import { readJsonFile, readTextFile } from "../fs";
import {
  createWorkspaceProject,
  listWorkspaceProjects,
  readWorkspaceProject,
} from "../projects";
import type { WorkspaceProject, WorkspaceSourceConfig } from "../schema";

describe("workspace projects", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "iis-projects-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("lists project summaries from project directories", async () => {
    await ensureDemoWorkspace(root);

    const projects = await listWorkspaceProjects(root);

    expect(projects).toHaveLength(1);
    expect(projects[0]?.project.slug).toBe(DEMO_PROJECT_SLUG);
    expect(projects[0]?.counts).toEqual({
      companies: 2,
      dataItems: 3,
      reports: 1,
      sources: 4,
    });
  });

  it("reads one project summary", async () => {
    await ensureDemoWorkspace(root);

    const summary = await readWorkspaceProject(DEMO_PROJECT_SLUG, root);

    expect(summary.project.name).toBe("China Automotive Talent Insight");
    expect(summary.counts.reports).toBe(1);
  });

  it("creates a project workspace with relative paths and empty datasets", async () => {
    const summary = await createWorkspaceProject(
      {
        name: "Semiconductor Hiring Trends",
        industry: "Semiconductor",
        region: "APAC",
      },
      root,
    );

    expect(summary.project.slug).toBe("semiconductor-hiring-trends");
    expect(summary.project.tags).toEqual(["Semiconductor", "APAC"]);
    expect(summary.counts).toEqual({
      companies: 0,
      dataItems: 0,
      reports: 0,
      sources: 4,
    });

    const project = await readJsonFile<WorkspaceProject>(
      root,
      "projects/semiconductor-hiring-trends/project.json",
    );
    expect(project.name).toBe("Semiconductor Hiring Trends");

    const sources = await readJsonFile<WorkspaceSourceConfig>(
      root,
      "projects/semiconductor-hiring-trends/source-config.json",
    );
    expect(sources.sources.map((source) => source.id)).toEqual([
      "career-sites",
      "liepin",
      "tavily",
      "manual-urls",
    ]);

    await expect(
      readTextFile(
        root,
        "projects/semiconductor-hiring-trends/sources/external/normalized/jobs.jsonl",
      ),
    ).resolves.toBe("");
  });

  it("suffixes duplicate project slugs", async () => {
    await createWorkspaceProject(
      { name: "China Automotive Talent Insight", industry: "Automotive", region: "China" },
      root,
    );
    const second = await createWorkspaceProject(
      { name: "China Automotive Talent Insight", industry: "Automotive", region: "China" },
      root,
    );

    expect(second.project.slug).toBe("china-automotive-talent-insight-2");
  });

  it("keeps report content as one current.html file", async () => {
    await ensureDemoWorkspace(root);

    const reportHtml = await readTextFile(
      root,
      `projects/${DEMO_PROJECT_SLUG}/reports/${DEMO_REPORT_SLUG}/current.html`,
    );

    expect(reportHtml).toContain("<!doctype html>");
    expect(reportHtml).toContain('data-section-id="executive-summary"');
  });
});

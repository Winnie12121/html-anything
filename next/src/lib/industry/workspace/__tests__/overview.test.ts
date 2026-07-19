import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEMO_PROJECT_SLUG,
  ensureDemoWorkspace,
} from "../bootstrap";
import { readWorkspaceOverview } from "../overview";
import { createWorkspaceProject } from "../projects";

describe("workspace overview", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "iis-overview-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("reads project summary and activity from workspace files", async () => {
    await ensureDemoWorkspace(root);

    const overview = await readWorkspaceOverview(DEMO_PROJECT_SLUG, root);

    expect(overview.project.slug).toBe(DEMO_PROJECT_SLUG);
    expect(overview.counts).toEqual({
      companies: 5,
      dataItems: 150,
      reports: 1,
      sources: 2,
    });
    expect(overview.activity.map((item) => item.label)).toEqual([
      'Report "Automotive Semiconductor Hiring Comparison" ready',
      "Collection run RUN-20260716-001 completed with 150 records",
    ]);
    expect(overview.activity.map((item) => item.tone)).toEqual(["info", "success"]);
  });

  it("returns an empty activity list when the project has no runs or reports", async () => {
    const created = await createWorkspaceProject(
      {
        name: "New Market Scan",
        industry: "Industrial",
        region: "Global",
        trackedCompanies: ["Acme"],
      },
      root,
    );

    const overview = await readWorkspaceOverview(created.project.slug, root);

    expect(overview.activity).toEqual([]);
  });
});

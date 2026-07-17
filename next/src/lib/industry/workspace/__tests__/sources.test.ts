import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEMO_PROJECT_SLUG,
  ensureDemoWorkspace,
} from "../bootstrap";
import { readJsonFile, readJsonlFile } from "../fs";
import {
  readWorkspaceSources,
  runMockExternalCollection,
} from "../sources";
import type { WorkspaceSourceConfig } from "../schema";

describe("workspace sources", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "iis-sources-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("reads source config and run history from the project workspace", async () => {
    await ensureDemoWorkspace(root);

    const view = await readWorkspaceSources(DEMO_PROJECT_SLUG, root);

    expect(view.project.slug).toBe(DEMO_PROJECT_SLUG);
    expect(view.sourceConfig.sources.map((source) => source.id)).toEqual([
      "career-sites",
      "liepin",
      "tavily",
      "manual-urls",
    ]);
    expect(view.runs.map((run) => run.id)).toContain("RUN-20260716-001");
  });

  it("writes a completed mock collection run and normalized records", async () => {
    await ensureDemoWorkspace(root);

    const result = await runMockExternalCollection(
      DEMO_PROJECT_SLUG,
      ["career-sites", "tavily", "manual-urls"],
      root,
    );

    expect(result.recordsCreated).toBe(4);
    expect(result.run.status).toBe("completed");
    expect(result.run.progress).toBe(100);

    const manifest = await readJsonFile(
      root,
      `projects/${DEMO_PROJECT_SLUG}/runs/${result.run.id}/manifest.json`,
    );
    expect(manifest).toMatchObject({
      id: result.run.id,
      recordsCreated: 4,
      sourceIds: ["career-sites", "tavily", "manual-urls"],
    });

    const jobs = await readJsonlFile<{ id: string }>(
      root,
      `projects/${DEMO_PROJECT_SLUG}/sources/external/normalized/jobs.jsonl`,
    );
    const news = await readJsonlFile<{ id: string }>(
      root,
      `projects/${DEMO_PROJECT_SLUG}/sources/external/normalized/news.jsonl`,
    );
    const webpages = await readJsonlFile<{ id: string }>(
      root,
      `projects/${DEMO_PROJECT_SLUG}/sources/external/normalized/webpages.jsonl`,
    );

    expect(jobs.some((record) => record.id.includes(result.run.id.toLowerCase()))).toBe(true);
    expect(news.some((record) => record.id.includes(result.run.id.toLowerCase()))).toBe(true);
    expect(webpages.some((record) => record.id.includes(result.run.id.toLowerCase()))).toBe(true);

    const sourceConfig = await readJsonFile<WorkspaceSourceConfig>(
      root,
      `projects/${DEMO_PROJECT_SLUG}/source-config.json`,
    );
    expect(
      sourceConfig.sources
        .filter((source) => ["career-sites", "tavily", "manual-urls"].includes(source.id))
        .map((source) => source.lastRunId),
    ).toEqual([result.run.id, result.run.id, result.run.id]);
  });

  it("records a warning when Liepin is included in the mocked run", async () => {
    await ensureDemoWorkspace(root);

    const result = await runMockExternalCollection(
      DEMO_PROJECT_SLUG,
      ["liepin"],
      root,
    );

    expect(result.run.status).toBe("completed_with_warnings");
    expect(result.run.warnings[0]).toContain("Liepin connector is mocked");
  });
});

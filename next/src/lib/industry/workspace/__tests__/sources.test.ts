import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEMO_PROJECT_SLUG,
  ensureDemoWorkspace,
} from "../bootstrap";
import { readJsonFile, readJsonlFile, readTextFile } from "../fs";
import {
  readWorkspaceSources,
  runExternalCollection,
  runMockExternalCollection,
  type WorkspaceRunEvent,
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
    expect(view.sourceConfig.sources.map((source) => source.id)).toEqual(["liepin", "tavily"]);
    expect(view.runs.map((run) => run.id)).toContain("RUN-20260716-001");
  });

  it("loads Liepin CSV records without duplicating existing rows", async () => {
    await ensureDemoWorkspace(root);

    const first = await runMockExternalCollection(DEMO_PROJECT_SLUG, ["liepin"], root);
    const second = await runMockExternalCollection(DEMO_PROJECT_SLUG, ["liepin"], root);

    expect(first.recordsCreated).toBe(42);
    expect(first.run.status).toBe("completed");
    expect(second.recordsCreated).toBe(42);

    const jobs = await readJsonlFile<{ id: string; fields: { salary?: string } }>(
      root,
      `projects/${DEMO_PROJECT_SLUG}/sources/external/normalized/jobs.jsonl`,
    );

    expect(jobs).toHaveLength(42);
    expect(jobs[0]?.id).toMatch(/^liepin-/);
    expect(jobs.some((record) => record.fields.salary === "急聘10-25k")).toBe(true);
  });

  it("fails Tavily runs clearly when no API key is configured", async () => {
    await ensureDemoWorkspace(root);

    const result = await runExternalCollection(
      DEMO_PROJECT_SLUG,
      ["tavily"],
      { root, tavilyApiKey: "" },
    );

    expect(result.run.status).toBe("failed");
    expect(result.run.warnings[0]).toContain("TAVILY_API_KEY");
  });

  it("calls Tavily, writes markdown reports, and creates webpage records", async () => {
    await ensureDemoWorkspace(root);
    const events: WorkspaceRunEvent[] = [];
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({
        answer: "Automotive semiconductor hiring remains active.",
        request_id: "tvly-test-1",
        response_time: 0.42,
        results: [
          {
            title: "Infineon China hiring signal",
            url: "https://example.com/infineon",
            content: "Infineon is expanding automotive semiconductor hiring.",
            raw_content: "## Infineon\nHiring signal markdown.",
            score: 0.91,
          },
        ],
      }), { status: 200 }),
    ) as unknown as typeof fetch;

    const result = await runExternalCollection(
      DEMO_PROJECT_SLUG,
      ["tavily"],
      {
        root,
        fetchImpl,
        tavilyApiKey: "test-key",
        onEvent: (event) => {
          events.push(event);
        },
      },
    );

    expect(result.run.status).toBe("completed");
    expect(fetchImpl).toHaveBeenCalled();
    expect(events.some((event) => event.type === "progress" && event.sourceId === "tavily")).toBe(true);

    const webpages = await readJsonlFile<{ fields: { reportPath?: string }; url?: string }>(
      root,
      `projects/${DEMO_PROJECT_SLUG}/sources/external/normalized/webpages.jsonl`,
    );
    expect(webpages.length).toBeGreaterThan(0);
    expect(webpages[0]?.fields.reportPath).toContain("sources/external/raw/tavily");
    expect(webpages[0]?.url).toBe("https://example.com/infineon");

    const markdown = await readTextFile(
      root,
      `projects/${DEMO_PROJECT_SLUG}/${webpages[0]?.fields.reportPath}`,
    );
    expect(markdown).toContain("# Tavily Search Report");
    expect(markdown).toContain("Hiring signal markdown.");

    const sourceConfig = await readJsonFile<WorkspaceSourceConfig>(
      root,
      `projects/${DEMO_PROJECT_SLUG}/source-config.json`,
    );
    expect(sourceConfig.sources.find((source) => source.id === "tavily")?.lastRunId).toBe(result.run.id);
  });
});

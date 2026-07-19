import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEMO_PROJECT_SLUG,
  ensureDemoWorkspace,
} from "../bootstrap";
import { readWorkspaceData, writeCurrentSelection } from "../data";
import { readJsonFile, writeJsonFile, writeTextFile } from "../fs";
import type { WorkspaceSelectionManifest } from "../schema";

describe("workspace data", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "iis-data-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("reads normalized JSONL records and current selection", async () => {
    await ensureDemoWorkspace(root);

    const view = await readWorkspaceData(DEMO_PROJECT_SLUG, root);

    expect(view.records).toHaveLength(150);
    expect(view.records[0]?.sourceId).toBe("liepin");
    expect(view.records.some((record) => record.fields.keyword === "英飞凌")).toBe(true);
    expect(view.sourceCounts).toEqual({
      all: 150,
      job: 150,
      news: 0,
      web_page: 0,
    });
    expect(view.selectedCounts).toEqual({
      job: 2,
      news: 0,
      web_page: 0,
    });
  });

  it("writes selected record refs into selections/current.json", async () => {
    await ensureDemoWorkspace(root);

    const view = await readWorkspaceData(DEMO_PROJECT_SLUG, root);
    const firstRef = view.records[0]?.ref as string;
    const secondRef = view.records[1]?.ref as string;
    const selection = await writeCurrentSelection(
      DEMO_PROJECT_SLUG,
      [
        firstRef,
        firstRef,
        secondRef,
      ],
      root,
    );

    expect(selection.selectedRecordRefs).toEqual([firstRef, secondRef]);
    expect(selection.updatedAt).toBeTruthy();

    const saved = await readJsonFile<WorkspaceSelectionManifest>(
      root,
      `projects/${DEMO_PROJECT_SLUG}/selections/current.json`,
    );
    expect(saved.selectedRecordRefs).toEqual(selection.selectedRecordRefs);
  });

  it("defaults to all records selected when current selection is empty", async () => {
    await ensureDemoWorkspace(root);
    await writeJsonFile(
      root,
      `projects/${DEMO_PROJECT_SLUG}/selections/current.json`,
      {
        id: "current",
        name: "Current report evidence",
        selectedRecordRefs: [],
        selectedFileRefs: [],
        createdAt: "2026-07-19T10:00:00.000Z",
      },
    );

    const view = await readWorkspaceData(DEMO_PROJECT_SLUG, root);

    expect(view.selection.selectedRecordRefs).toHaveLength(150);
    expect(view.selectedCounts).toEqual({
      job: 150,
      news: 0,
      web_page: 0,
    });
  });

  it("loads Tavily markdown report content into webpage raw text", async () => {
    await ensureDemoWorkspace(root);
    await writeTextFile(
      root,
      `projects/${DEMO_PROJECT_SLUG}/sources/external/raw/tavily/RUN-test/topic.md`,
      "# Tavily Search Report\n\n- Query: test\n\n## Result\nMarkdown body.",
    );
    await writeTextFile(
      root,
      `projects/${DEMO_PROJECT_SLUG}/sources/external/normalized/webpages.jsonl`,
      `${JSON.stringify({
        id: "tavily-test",
        sourceId: "tavily",
        kind: "web_page",
        title: "Tavily report",
        summary: "Markdown report",
        fields: {
          reportPath: "sources/external/raw/tavily/RUN-test/topic.md",
          query: "test",
        },
        rawText: "fallback text",
        createdAt: "2026-07-19T10:00:00.000Z",
      })}\n`,
    );

    const view = await readWorkspaceData(DEMO_PROJECT_SLUG, root);
    const record = view.records.find((item) => item.id === "tavily-test");

    expect(record?.rawText).toContain("# Tavily Search Report");
    expect(record?.rawText).toContain("Markdown body.");
  });

  it("keeps Tavily fallback text when the markdown report is missing", async () => {
    await ensureDemoWorkspace(root);
    await writeTextFile(
      root,
      `projects/${DEMO_PROJECT_SLUG}/sources/external/normalized/webpages.jsonl`,
      `${JSON.stringify({
        id: "tavily-missing",
        sourceId: "tavily",
        kind: "web_page",
        title: "Tavily missing report",
        summary: "Missing markdown report",
        fields: {
          reportPath: "sources/external/raw/tavily/RUN-missing/topic.md",
          query: "test",
        },
        rawText: "fallback text",
        createdAt: "2026-07-19T10:00:00.000Z",
      })}\n`,
    );

    const view = await readWorkspaceData(DEMO_PROJECT_SLUG, root);
    const record = view.records.find((item) => item.id === "tavily-missing");

    expect(record?.rawText).toBe("fallback text");
  });
});

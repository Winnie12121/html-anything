import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEMO_PROJECT_SLUG,
  ensureDemoWorkspace,
} from "../bootstrap";
import { readWorkspaceData, writeCurrentSelection } from "../data";
import { readJsonFile } from "../fs";
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

    expect(view.records).toHaveLength(3);
    expect(view.records.map((record) => record.ref)).toEqual(
      expect.arrayContaining([
        "sources/external/normalized/jobs.jsonl#job-001",
        "sources/external/normalized/jobs.jsonl#job-002",
        "sources/external/normalized/news.jsonl#news-001",
      ]),
    );
    expect(view.sourceCounts).toEqual({
      all: 3,
      job: 2,
      news: 1,
      web_page: 0,
    });
    expect(view.selectedCounts).toEqual({
      job: 2,
      news: 1,
      web_page: 0,
    });
  });

  it("writes selected record refs into selections/current.json", async () => {
    await ensureDemoWorkspace(root);

    const selection = await writeCurrentSelection(
      DEMO_PROJECT_SLUG,
      [
        "sources/external/normalized/jobs.jsonl#job-001",
        "sources/external/normalized/jobs.jsonl#job-001",
        "sources/external/normalized/news.jsonl#news-001",
      ],
      root,
    );

    expect(selection.selectedRecordRefs).toEqual([
      "sources/external/normalized/jobs.jsonl#job-001",
      "sources/external/normalized/news.jsonl#news-001",
    ]);
    expect(selection.updatedAt).toBeTruthy();

    const saved = await readJsonFile<WorkspaceSelectionManifest>(
      root,
      `projects/${DEMO_PROJECT_SLUG}/selections/current.json`,
    );
    expect(saved.selectedRecordRefs).toEqual(selection.selectedRecordRefs);
  });
});

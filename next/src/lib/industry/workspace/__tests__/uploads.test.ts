import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEMO_PROJECT_SLUG,
  ensureDemoWorkspace,
} from "../bootstrap";
import { readWorkspaceData } from "../data";
import {
  deleteWorkspaceUpload,
  ingestWorkspaceUpload,
  readWorkspaceUploads,
} from "../uploads";

describe("workspace uploads", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "iis-uploads-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("parses uploaded CSV files into selected data records", async () => {
    await ensureDemoWorkspace(root);

    const result = await ingestWorkspaceUpload(
      DEMO_PROJECT_SLUG,
      new File(["company,role\n英飞凌,FAE\n德州仪器,Sales\n"], "sample.csv", {
        type: "text/csv",
      }),
      root,
    );
    const view = await readWorkspaceData(DEMO_PROJECT_SLUG, root);
    const uploaded = view.records.filter((record) => record.sourceId === "upload");

    expect(result.file.status).toBe("ready");
    expect(result.records).toHaveLength(2);
    expect(uploaded).toHaveLength(2);
    expect(view.sourceCounts.sheet_row).toBe(2);
    expect(view.selection.selectedRecordRefs).toEqual(
      expect.arrayContaining(result.records.map((record) => record.ref)),
    );
  });

  it("deletes an uploaded file and its normalized records", async () => {
    await ensureDemoWorkspace(root);
    const result = await ingestWorkspaceUpload(
      DEMO_PROJECT_SLUG,
      new File(["company,role\n英飞凌,FAE\n"], "delete-me.csv", {
        type: "text/csv",
      }),
      root,
    );

    await deleteWorkspaceUpload(DEMO_PROJECT_SLUG, result.file.id, root);

    const uploads = await readWorkspaceUploads(DEMO_PROJECT_SLUG, root);
    const view = await readWorkspaceData(DEMO_PROJECT_SLUG, root);

    expect(uploads.files).toEqual([]);
    expect(view.records.some((record) => record.sourceId === "upload")).toBe(false);
    expect(view.selection.selectedRecordRefs).not.toEqual(
      expect.arrayContaining(result.records.map((record) => record.ref)),
    );
  });
});

import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appendJsonl,
  listDirectories,
  readJsonFile,
  readJsonlFile,
  readTextFile,
  writeJsonFile,
  writeTextFile,
} from "../fs";

describe("workspace fs helpers", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "iis-workspace-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("reads and writes JSON with parent directory creation", async () => {
    await writeJsonFile(root, "projects/demo/project.json", { name: "Demo" });
    await expect(
      readJsonFile<{ name: string }>(root, "projects/demo/project.json"),
    ).resolves.toEqual({ name: "Demo" });
  });

  it("reads and writes text", async () => {
    await writeTextFile(root, "reports/demo/current.html", "<html></html>");
    await expect(readTextFile(root, "reports/demo/current.html")).resolves.toBe(
      "<html></html>",
    );
  });

  it("appends and reads JSONL", async () => {
    await appendJsonl(root, "sources/external/normalized/jobs.jsonl", [
      { id: "job-1" },
      { id: "job-2" },
    ]);
    await appendJsonl(root, "sources/external/normalized/jobs.jsonl", [
      { id: "job-3" },
    ]);

    await expect(
      readJsonlFile<{ id: string }>(
        root,
        "sources/external/normalized/jobs.jsonl",
      ),
    ).resolves.toEqual([{ id: "job-1" }, { id: "job-2" }, { id: "job-3" }]);
  });

  it("lists directories alphabetically", async () => {
    await writeJsonFile(root, "projects/b/project.json", {});
    await writeJsonFile(root, "projects/a/project.json", {});
    await expect(listDirectories(root, "projects")).resolves.toEqual(["a", "b"]);
  });

  it("rejects escaped relative paths", async () => {
    await expect(writeTextFile(root, "../outside.txt", "bad")).rejects.toThrow(
      "Path escapes workspace",
    );
  });
});

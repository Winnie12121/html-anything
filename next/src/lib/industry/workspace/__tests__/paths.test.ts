import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertWorkspaceSlug,
  normalizeWorkspaceRelativePath,
  projectPath,
  reportPath,
  safeJoin,
  toWorkspaceSlug,
  workspaceRelative,
} from "../paths";

describe("workspace path helpers", () => {
  it("creates stable slugs", () => {
    expect(toWorkspaceSlug("China Automotive Talent Insight")).toBe(
      "china-automotive-talent-insight",
    );
    expect(toWorkspaceSlug("  ")).toBe("untitled-project");
  });

  it("rejects invalid slugs", () => {
    expect(() => assertWorkspaceSlug("../bad")).toThrow("Invalid slug");
    expect(() => assertWorkspaceSlug("Bad Slug")).toThrow("Invalid slug");
    expect(assertWorkspaceSlug("china-automotive-talent-insight")).toBe(
      "china-automotive-talent-insight",
    );
  });

  it("normalizes only POSIX workspace-relative paths", () => {
    expect(normalizeWorkspaceRelativePath("projects/demo/../demo/project.json")).toBe(
      "projects/demo/project.json",
    );
    expect(() => normalizeWorkspaceRelativePath("/tmp/workspace")).toThrow(
      "Invalid workspace-relative path",
    );
    expect(() => normalizeWorkspaceRelativePath("projects\\demo")).toThrow(
      "Invalid workspace-relative path",
    );
    expect(() => normalizeWorkspaceRelativePath("../outside")).toThrow(
      "Path escapes workspace",
    );
  });

  it("joins paths without allowing traversal", () => {
    const root = path.resolve("/tmp/industry-workspace");
    expect(safeJoin(root, "projects/demo/project.json")).toBe(
      path.join(root, "projects/demo/project.json"),
    );
    expect(() => safeJoin(root, "projects/../../secret")).toThrow(
      "Path escapes workspace",
    );
  });

  it("builds project and report paths", () => {
    expect(projectPath("demo-project", "project.json")).toBe(
      "projects/demo-project/project.json",
    );
    expect(reportPath("demo-project", "report-one", "current.html")).toBe(
      "projects/demo-project/reports/report-one/current.html",
    );
  });

  it("converts absolute paths back to workspace-relative paths", () => {
    const root = path.resolve("/tmp/industry-workspace");
    expect(workspaceRelative(root, path.join(root, "projects/demo/project.json"))).toBe(
      "projects/demo/project.json",
    );
    expect(() => workspaceRelative(root, "/tmp/other/project.json")).toThrow(
      "outside workspace",
    );
  });
});

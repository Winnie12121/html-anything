import path from "node:path";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isWorkspaceSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}

export function assertWorkspaceSlug(value: string, label = "slug"): string {
  if (!isWorkspaceSlug(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return value;
}

export function toWorkspaceSlug(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || "untitled-project";
}

export function normalizeWorkspaceRelativePath(value: string): string {
  if (!value || path.isAbsolute(value) || value.includes("\\")) {
    throw new Error(`Invalid workspace-relative path: ${value}`);
  }

  const normalized = path.posix.normalize(value);
  if (normalized === "." || normalized.startsWith("../") || normalized === "..") {
    throw new Error(`Path escapes workspace: ${value}`);
  }

  return normalized;
}

export function safeJoin(root: string, relativePath: string): string {
  const normalized = normalizeWorkspaceRelativePath(relativePath);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, normalized);
  const rootWithSep = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : `${resolvedRoot}${path.sep}`;

  if (resolved !== resolvedRoot && !resolved.startsWith(rootWithSep)) {
    throw new Error(`Path escapes workspace: ${relativePath}`);
  }

  return resolved;
}

export function workspaceRelative(root: string, absolutePath: string): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(absolutePath);
  const rootWithSep = resolvedRoot.endsWith(path.sep)
    ? resolvedRoot
    : `${resolvedRoot}${path.sep}`;

  if (resolved !== resolvedRoot && !resolved.startsWith(rootWithSep)) {
    throw new Error(`Path is outside workspace: ${absolutePath}`);
  }

  return path.relative(resolvedRoot, resolved).split(path.sep).join("/");
}

export function projectPath(projectSlug: string, ...segments: string[]): string {
  assertWorkspaceSlug(projectSlug, "project slug");
  return normalizeWorkspaceRelativePath(
    path.posix.join("projects", projectSlug, ...segments),
  );
}

export function reportPath(
  projectSlug: string,
  reportSlug: string,
  ...segments: string[]
): string {
  assertWorkspaceSlug(projectSlug, "project slug");
  assertWorkspaceSlug(reportSlug, "report slug");
  return projectPath(projectSlug, "reports", reportSlug, ...segments);
}

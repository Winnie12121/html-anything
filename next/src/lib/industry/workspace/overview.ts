import { listDirectories, readJsonFile } from "./fs";
import { projectPath } from "./paths";
import {
  configuredWorkspaceRoot,
  readWorkspaceProject,
  type WorkspaceProjectSummary,
} from "./projects";
import type {
  WorkspaceRunManifest,
  WorkspaceReportMetadata,
} from "./schema";

export type WorkspaceActivityItem = {
  id: string;
  label: string;
  tone: "success" | "info" | "warning" | "danger";
  createdAt: string;
};

export type WorkspaceOverview = WorkspaceProjectSummary & {
  activity: WorkspaceActivityItem[];
};

export async function readWorkspaceOverview(
  projectSlug: string,
  root?: string,
): Promise<WorkspaceOverview> {
  const workspaceRoot = root ?? (await configuredWorkspaceRoot());
  const summary = await readWorkspaceProject(projectSlug, workspaceRoot);
  const activity = await readWorkspaceActivity(workspaceRoot, projectSlug);
  return { ...summary, activity };
}

async function readWorkspaceActivity(
  root: string,
  projectSlug: string,
): Promise<WorkspaceActivityItem[]> {
  const [runActivity, reportActivity] = await Promise.all([
    readRunActivity(root, projectSlug),
    readReportActivity(root, projectSlug),
  ]);

  return [...runActivity, ...reportActivity]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 8);
}

async function readRunActivity(
  root: string,
  projectSlug: string,
): Promise<WorkspaceActivityItem[]> {
  let runIds: string[];
  try {
    runIds = await listDirectories(root, projectPath(projectSlug, "runs"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const items: WorkspaceActivityItem[] = [];
  for (const runId of runIds) {
    try {
      const manifest = await readJsonFile<WorkspaceRunManifest>(
        root,
        projectPath(projectSlug, "runs", runId, "manifest.json"),
      );
      items.push({
        id: `run-${manifest.id}`,
        label: runLabel(manifest),
        tone: runTone(manifest.status),
        createdAt: manifest.endedAt ?? manifest.startedAt,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return items;
}

async function readReportActivity(
  root: string,
  projectSlug: string,
): Promise<WorkspaceActivityItem[]> {
  let reportSlugs: string[];
  try {
    reportSlugs = await listDirectories(root, projectPath(projectSlug, "reports"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const items: WorkspaceActivityItem[] = [];
  for (const reportSlug of reportSlugs) {
    try {
      const report = await readJsonFile<WorkspaceReportMetadata>(
        root,
        projectPath(projectSlug, "reports", reportSlug, "report.json"),
      );
      items.push({
        id: `report-${report.slug}`,
        label: `Report "${report.name}" ${report.status === "draft" ? "saved as draft" : "ready"}`,
        tone: report.status === "failed" ? "danger" : "info",
        createdAt: report.updatedAt,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return items;
}

function runLabel(manifest: WorkspaceRunManifest): string {
  if (manifest.status === "completed") {
    return `Collection run ${manifest.id} completed with ${manifest.recordsCreated} records`;
  }
  if (manifest.status === "completed_with_warnings") {
    return `Collection run ${manifest.id} completed with warnings`;
  }
  if (manifest.status === "failed") {
    return `Collection run ${manifest.id} failed`;
  }
  if (manifest.status === "running") {
    return `Collection run ${manifest.id} running`;
  }
  return `Collection run ${manifest.id} waiting`;
}

function runTone(status: WorkspaceRunManifest["status"]): WorkspaceActivityItem["tone"] {
  if (status === "completed") return "success";
  if (status === "completed_with_warnings") return "warning";
  if (status === "failed") return "danger";
  return "info";
}

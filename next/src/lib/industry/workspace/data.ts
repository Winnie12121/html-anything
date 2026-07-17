import {
  readJsonFile,
  readJsonlFile,
  writeJsonFile,
} from "./fs";
import { projectPath } from "./paths";
import { configuredWorkspaceRoot, readWorkspaceProject } from "./projects";
import type {
  WorkspaceDataKind,
  WorkspaceDataRecord,
  WorkspaceDataView,
} from "./client";
import type {
  WorkspaceSelectionManifest,
} from "./schema";

type RawWorkspaceRecord = Omit<WorkspaceDataRecord, "ref" | "sourcePath">;

const DATA_FILES: Array<{ path: string; kind: WorkspaceDataKind }> = [
  { path: "sources/external/normalized/jobs.jsonl", kind: "job" },
  { path: "sources/external/normalized/news.jsonl", kind: "news" },
  { path: "sources/external/normalized/webpages.jsonl", kind: "web_page" },
];

export async function readWorkspaceData(
  projectSlug: string,
  root?: string,
): Promise<WorkspaceDataView> {
  const workspaceRoot = root ?? (await configuredWorkspaceRoot());
  const [projectSummary, records, selection] = await Promise.all([
    readWorkspaceProject(projectSlug, workspaceRoot),
    readDataRecords(workspaceRoot, projectSlug),
    readCurrentSelection(workspaceRoot, projectSlug),
  ]);

  const selectedSet = new Set(selection.selectedRecordRefs);
  const selectedCounts = makeKindCounts(
    records.filter((record) => selectedSet.has(record.ref)),
  );
  const sourceCounts = {
    all: records.length,
    ...makeKindCounts(records),
  };

  return {
    project: projectSummary.project,
    counts: projectSummary.counts,
    records,
    selection,
    sourceCounts,
    selectedCounts,
  };
}

export async function writeCurrentSelection(
  projectSlug: string,
  selectedRecordRefs: string[],
  root?: string,
): Promise<WorkspaceSelectionManifest> {
  const workspaceRoot = root ?? (await configuredWorkspaceRoot());
  const current = await readCurrentSelection(workspaceRoot, projectSlug);
  const uniqueRefs = Array.from(new Set(selectedRecordRefs));
  const now = new Date().toISOString();
  const next: WorkspaceSelectionManifest = {
    ...current,
    id: current.id || "current",
    name: current.name || "Current report evidence",
    selectedRecordRefs: uniqueRefs,
    selectedFileRefs: current.selectedFileRefs ?? [],
    createdAt: current.createdAt || now,
    updatedAt: now,
  };

  await writeJsonFile(
    workspaceRoot,
    projectPath(projectSlug, "selections/current.json"),
    next,
  );
  return next;
}

async function readDataRecords(
  root: string,
  projectSlug: string,
): Promise<WorkspaceDataRecord[]> {
  const records: WorkspaceDataRecord[] = [];

  for (const file of DATA_FILES) {
    try {
      const rows = await readJsonlFile<RawWorkspaceRecord>(
        root,
        projectPath(projectSlug, file.path),
      );
      records.push(
        ...rows.map((row) => ({
          ...row,
          kind: row.kind ?? file.kind,
          sourcePath: file.path,
          ref: `${file.path}#${row.id}`,
        })),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  return records.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

async function readCurrentSelection(
  root: string,
  projectSlug: string,
): Promise<WorkspaceSelectionManifest> {
  try {
    return await readJsonFile<WorkspaceSelectionManifest>(
      root,
      projectPath(projectSlug, "selections/current.json"),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const now = new Date().toISOString();
  return {
    id: "current",
    name: "Current report evidence",
    selectedRecordRefs: [],
    selectedFileRefs: [],
    createdAt: now,
    updatedAt: now,
  };
}

function makeKindCounts(
  records: WorkspaceDataRecord[],
): Record<WorkspaceDataKind, number> {
  return records.reduce<Record<WorkspaceDataKind, number>>(
    (acc, record) => {
      acc[record.kind] += 1;
      return acc;
    },
    { job: 0, news: 0, web_page: 0 },
  );
}

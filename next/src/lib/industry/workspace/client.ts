import type {
  WorkspaceProject,
  WorkspaceReportMetadata,
  WorkspaceRunManifest,
  WorkspaceSelectionManifest,
  WorkspaceSourceConfig,
} from "./schema";

export type {
  WorkspaceProject,
  WorkspaceReportMetadata,
  WorkspaceRunManifest,
  WorkspaceSelectionManifest,
  WorkspaceSourceConfig,
} from "./schema";

export type WorkspaceProjectCounts = {
  companies: number;
  dataItems: number;
  reports: number;
  sources: number;
};

export type WorkspaceProjectSummary = {
  project: WorkspaceProject;
  counts: WorkspaceProjectCounts;
};

export type WorkspaceActivityItem = {
  id: string;
  label: string;
  tone: "success" | "info" | "warning" | "danger";
  createdAt: string;
};

export type WorkspaceOverview = WorkspaceProjectSummary & {
  activity: WorkspaceActivityItem[];
};

export type WorkspaceSourcesView = {
  project: WorkspaceProject;
  counts: WorkspaceProjectCounts;
  sourceConfig: WorkspaceSourceConfig;
  runs: WorkspaceRunManifest[];
};

export type WorkspaceDataKind = "job" | "news" | "web_page";

export type WorkspaceDataRecord = {
  id: string;
  ref: string;
  sourcePath: string;
  sourceId: string;
  kind: WorkspaceDataKind;
  title: string;
  summary: string;
  fields: Record<string, string | number | boolean | string[] | null>;
  rawText: string;
  url?: string;
  createdAt: string;
};

export type WorkspaceDataView = {
  project: WorkspaceProject;
  counts: WorkspaceProjectCounts;
  records: WorkspaceDataRecord[];
  selection: WorkspaceSelectionManifest;
  sourceCounts: Record<"all" | WorkspaceDataKind, number>;
  selectedCounts: Record<WorkspaceDataKind, number>;
};

export type WorkspaceReportListItem = WorkspaceReportMetadata;

export function formatWorkspaceDataKind(kind: WorkspaceDataKind): string {
  if (kind === "job") return "Jobs";
  if (kind === "news") return "News";
  return "Web Pages";
}

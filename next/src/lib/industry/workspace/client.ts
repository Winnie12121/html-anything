import type {
  WorkspaceProject,
  WorkspaceReportComment,
  WorkspaceReportMetadata,
  WorkspaceRunManifest,
  WorkspaceSelectionManifest,
  WorkspaceSourceConfig,
} from "./schema";

export type {
  WorkspaceProject,
  WorkspaceReportComment,
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

export type WorkspaceDataKind =
  | "job"
  | "news"
  | "web_page"
  | "sheet_row"
  | "pdf_page"
  | "markdown"
  | "text"
  | "json"
  | "image";

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

export type WorkspaceSuggestedInsight = {
  id: string;
  type: "metric" | "table" | "chart" | "narrative";
  title: string;
  rationale: string;
  recordRefs: string[];
  config: Record<string, unknown>;
  included: boolean;
};

export type WorkspaceReportSetupView = WorkspaceDataView & {
  selectedRecords: WorkspaceDataRecord[];
  suggestedInsights: WorkspaceSuggestedInsight[];
};

export type WorkspaceReportsView = {
  project: WorkspaceProject;
  counts: WorkspaceProjectCounts;
  reports: WorkspaceReportListItem[];
};

export type WorkspaceReportStudioView = {
  project: WorkspaceProject;
  counts: WorkspaceProjectCounts;
  report: WorkspaceReportMetadata;
  html: string;
  comments: WorkspaceReportComment[];
  selectedRecords: WorkspaceDataRecord[];
  suggestedInsights: WorkspaceSuggestedInsight[];
};

export function formatWorkspaceDataKind(kind: WorkspaceDataKind): string {
  if (kind === "job") return "Jobs";
  if (kind === "news") return "News";
  if (kind === "web_page") return "Web Pages";
  if (kind === "sheet_row") return "Sheet Rows";
  if (kind === "pdf_page") return "PDF Pages";
  if (kind === "markdown") return "Markdown";
  if (kind === "text") return "Text";
  if (kind === "json") return "JSON";
  if (kind === "image") return "Images";
  return kind;
}

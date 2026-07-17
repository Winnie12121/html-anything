export type SourceType =
  | "career_site"
  | "liepin"
  | "tavily"
  | "url_import"
  | "upload";

export type RunStatus =
  | "waiting"
  | "running"
  | "completed"
  | "completed_with_warnings"
  | "failed";

export type DataKind =
  | "job"
  | "news"
  | "web_page"
  | "sheet_row"
  | "pdf_page"
  | "markdown"
  | "text"
  | "image";

export type InsightType = "metric" | "table" | "chart" | "narrative";

export type ReportStatus = "draft" | "ready" | "generating" | "failed";

export type Project = {
  id: string;
  name: string;
  industry: string;
  region: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
};

export type SourceConfig = {
  id: string;
  projectId: string;
  type: SourceType;
  displayName: string;
  description: string;
  enabled: boolean;
  config: Record<string, unknown>;
  lastRunId?: string;
};

export type SourceRun = {
  id: string;
  projectId: string;
  sourceIds: string[];
  status: RunStatus;
  progress: number;
  startedAt: number;
  endedAt?: number;
  recordsCreated: number;
  warnings: string[];
  log: string[];
};

export type DataItem = {
  id: string;
  projectId: string;
  sourceId: string;
  kind: DataKind;
  title: string;
  summary: string;
  fields: Record<string, string | number | boolean | string[] | null>;
  rawText: string;
  fileRef?: string;
  url?: string;
  createdAt: number;
};

export type UploadedFile = {
  id: string;
  projectId: string;
  name: string;
  mimeType: string;
  size: number;
  status: "parsing" | "ready" | "failed";
  parsedItemIds: string[];
  blobRef?: string;
  uploadedAt: number;
};

export type SelectionSet = {
  projectId: string;
  selectedItemIds: string[];
  countsByKind: Partial<Record<DataKind, number>>;
  updatedAt: number;
};

export type SuggestedInsight = {
  id: string;
  type: InsightType;
  title: string;
  rationale: string;
  dataItemIds: string[];
  config: Record<string, unknown>;
  included: boolean;
};

export type ReportComment = {
  id: string;
  sectionId: string;
  text: string;
  resolved: boolean;
  createdAt: number;
};

export type ReportSection = {
  id: string;
  title: string;
  html: string;
  sourceItemIds: string[];
  comments: ReportComment[];
  order: number;
};

export type Report = {
  id: string;
  projectId: string;
  name: string;
  templateId: string;
  audience: string;
  language: string;
  goal: string;
  status: ReportStatus;
  html: string;
  sections: ReportSection[];
  insightIds: string[];
  selectedItemIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type ActivityItem = {
  id: string;
  projectId: string;
  label: string;
  tone: "success" | "info" | "warning" | "danger";
  createdAt: number;
};

export type ProjectCounts = {
  companies: number;
  dataItems: number;
  reports: number;
  sources: number;
};

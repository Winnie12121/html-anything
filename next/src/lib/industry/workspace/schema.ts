export const WORKSPACE_SCHEMA_VERSION = 1;

export type WorkspaceConfig = {
  version: typeof WORKSPACE_SCHEMA_VERSION;
  name: string;
  projectsDir: "projects";
  templatesDir: "templates";
};

export type AppWorkspaceConfig = {
  version: typeof WORKSPACE_SCHEMA_VERSION;
  workspaceRoot: string;
  updatedAt: string;
};

export type WorkspaceProject = {
  id: string;
  slug: string;
  name: string;
  industry: string;
  region: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceSourceConfig = {
  version: typeof WORKSPACE_SCHEMA_VERSION;
  sources: Array<{
    id: string;
    type: "career_site" | "liepin" | "tavily" | "url_import";
    displayName: string;
    description: string;
    enabled: boolean;
    config: Record<string, unknown>;
    lastRunId?: string;
  }>;
};

export type WorkspaceRunManifest = {
  id: string;
  status: "waiting" | "running" | "completed" | "completed_with_warnings" | "failed";
  sourceIds: string[];
  progress: number;
  startedAt: string;
  endedAt?: string;
  recordsCreated: number;
  warnings: string[];
};

export type WorkspaceSelectionManifest = {
  id: string;
  name: string;
  selectedRecordRefs: string[];
  selectedFileRefs: string[];
  createdAt: string;
};

export type WorkspaceReportMetadata = {
  id: string;
  slug: string;
  name: string;
  templateId: string;
  audience: string;
  language: string;
  goal: string;
  status: "draft" | "ready" | "generating" | "failed";
  currentHtmlPath: "current.html";
  sections: Array<{
    id: string;
    title: string;
    selector: string;
    order: number;
    sourceRecordRefs: string[];
  }>;
  createdAt: string;
  updatedAt: string;
};

"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  seedActivity,
  seedDataItems,
  seedProjects,
  seedReports,
  seedRuns,
  seedSelections,
  seedSources,
  seedUploadedFiles,
} from "./fixtures";
import { makeSelectionSet } from "./selection";
import type {
  ActivityItem,
  DataItem,
  Project,
  ProjectCounts,
  Report,
  ReportComment,
  SourceConfig,
  SourceRun,
  UploadedFile,
} from "./types";

type SourceTab = "external" | "uploads" | "history";

type State = {
  projects: Project[];
  sources: SourceConfig[];
  runs: SourceRun[];
  dataItems: DataItem[];
  uploadedFiles: UploadedFile[];
  selections: ReturnType<typeof makeSelectionSet>[];
  reports: Report[];
  activity: ActivityItem[];
  activeProjectId: string;
  sourceTab: SourceTab;
  selectedDataSourceId: string;
  activeDataItemId?: string;
  activeReportSectionId?: string;

  createProject: (input: {
    name: string;
    industry: string;
    region: string;
    tags?: string[];
  }) => string;
  setActiveProject: (projectId: string) => void;
  setSourceTab: (tab: SourceTab) => void;
  setSelectedDataSource: (sourceId: string) => void;
  setActiveDataItem: (itemId?: string) => void;
  toggleSource: (sourceId: string) => void;
  startDemoRun: (projectId: string, sourceIds: string[]) => string;
  addUploadedFile: (file: UploadedFile, items: DataItem[]) => void;
  toggleDataSelection: (projectId: string, itemId: string) => void;
  setSelection: (projectId: string, itemIds: string[]) => void;
  createReport: (input: {
    projectId: string;
    name: string;
    templateId: string;
    audience: string;
    language: string;
    goal: string;
    insightIds: string[];
    selectedItemIds: string[];
  }) => string;
  setReportHtml: (reportId: string, html: string) => void;
  setReportStatus: (reportId: string, status: Report["status"]) => void;
  setActiveReportSection: (sectionId?: string) => void;
  updateReportSection: (reportId: string, sectionId: string, html: string) => void;
  addSectionComment: (reportId: string, sectionId: string, text: string) => void;
  resolveComment: (reportId: string, sectionId: string, commentId: string) => void;
  deleteReportSection: (reportId: string, sectionId: string) => void;
  moveReportSection: (reportId: string, sectionId: string, direction: "up" | "down") => void;
};

function id(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function touch<T extends { updatedAt: number }>(value: T): T {
  return { ...value, updatedAt: Date.now() };
}

function updateSelection(
  selections: State["selections"],
  projectId: string,
  itemIds: string[],
  allItems: DataItem[],
) {
  const projectItems = allItems.filter((item) => item.projectId === projectId);
  const next = makeSelectionSet(projectId, itemIds, projectItems);
  const exists = selections.some((selection) => selection.projectId === projectId);
  return exists
    ? selections.map((selection) =>
        selection.projectId === projectId ? next : selection,
      )
    : [...selections, next];
}

function buildReportHtml(args: {
  name: string;
  audience: string;
  language: string;
  goal: string;
  selectedItems: DataItem[];
}): string {
  const companies = Array.from(
    new Set(
      args.selectedItems
        .map((item) => item.fields.company)
        .filter((value): value is string => typeof value === "string"),
    ),
  );
  const rows = companies
    .map((company) => {
      const count = args.selectedItems.filter((item) => item.fields.company === company).length;
      return `<tr><td>${company}</td><td>${count}</td><td>${count > 1 ? "High" : "Emerging"}</td></tr>`;
    })
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${args.name}</title><style>body{font-family:Inter,Arial,sans-serif;margin:0;background:#f6f7f9;color:#1f2937}.report{max-width:860px;margin:32px auto;background:#fff;border:1px solid #d9dee7;padding:42px}h1{font-size:38px;line-height:1.12;margin:0 0 12px}.muted{color:#6b7280}.kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:28px 0}.kpi{border:1px solid #d9dee7;padding:18px}.kpi strong{font-size:30px;color:#075da0}.section{border-top:1px solid #e5e7eb;margin-top:28px;padding-top:24px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #e5e7eb;padding:10px;text-align:left}</style></head><body><main class="report"><h1>${args.name}</h1><p class="muted">${args.audience} · ${args.language} · ${args.selectedItems.length} selected records</p><p>${args.goal}</p><div class="kpis"><div class="kpi"><strong>${args.selectedItems.filter((item) => item.kind === "job").length}</strong><br>Jobs analyzed</div><div class="kpi"><strong>${companies.length}</strong><br>Companies tracked</div><div class="kpi"><strong>${args.selectedItems.filter((item) => item.kind === "news").length}</strong><br>Market signals</div></div><section class="section"><h2>Company Comparison</h2><table><thead><tr><th>Company</th><th>Selected Records</th><th>Signal</th></tr></thead><tbody>${rows || "<tr><td>Selected evidence</td><td>" + args.selectedItems.length + "</td><td>Review</td></tr>"}</tbody></table></section><section class="section"><h2>Key Implications</h2><p>The selected evidence points to concentrated demand around software, ADAS, embedded systems, and platform capabilities. Use this report as a starting point for editable insight development.</p></section></main></body></html>`;
}

function buildSections(reportId: string, itemIds: string[]): Report["sections"] {
  return [
    {
      id: `${reportId}-summary`,
      title: "Executive Summary",
      html: "<h2>Executive Summary</h2><p>The selected data indicates concentrated hiring demand in automotive software and ADAS functions.</p>",
      sourceItemIds: itemIds.slice(0, 5),
      comments: [],
      order: 0,
    },
    {
      id: `${reportId}-comparison`,
      title: "Company Comparison",
      html: "<h2>Company Comparison</h2><p>Company-level evidence should be reviewed for competitor hiring intensity and role mix.</p>",
      sourceItemIds: itemIds.slice(0, 6),
      comments: [],
      order: 1,
    },
    {
      id: `${reportId}-implications`,
      title: "Key Implications",
      html: "<h2>Key Implications</h2><p>Translate hiring and market signals into practical workforce planning recommendations.</p>",
      sourceItemIds: itemIds,
      comments: [],
      order: 2,
    },
  ];
}

export const useIndustryStore = create<State>()(
  persist(
    (set, get) => ({
      projects: seedProjects,
      sources: seedSources,
      runs: seedRuns,
      dataItems: seedDataItems,
      uploadedFiles: seedUploadedFiles,
      selections: seedSelections,
      reports: seedReports,
      activity: seedActivity,
      activeProjectId: seedProjects[0]?.id ?? "",
      sourceTab: "external",
      selectedDataSourceId: "all",
      activeDataItemId: "di-job-5",
      activeReportSectionId: "sec-company",

      createProject: (input) => {
        const projectId = id("project");
        const now = Date.now();
        const tags = input.tags?.length
          ? input.tags
          : [input.industry, input.region].filter(Boolean);
        const project: Project = {
          id: projectId,
          name: input.name.trim() || "Untitled Industry Project",
          industry: input.industry.trim() || "Industry",
          region: input.region.trim() || "Region",
          tags,
          createdAt: now,
          updatedAt: now,
        };
        const baseSources: SourceConfig[] = [
          {
            id: id("src_careers"),
            projectId,
            type: "career_site",
            displayName: "Company Career Sites",
            description: "Collect job openings from company recruitment websites.",
            enabled: true,
            config: { companies: [] },
          },
          {
            id: id("src_liepin"),
            projectId,
            type: "liepin",
            displayName: "Liepin",
            description: "Collect public job listings from Liepin using a saved browser session.",
            enabled: false,
            config: { keywords: [] },
          },
          {
            id: id("src_tavily"),
            projectId,
            type: "tavily",
            displayName: "Tavily Search",
            description: "Search industry news, company activity, hiring trends, and market signals.",
            enabled: true,
            config: { topics: [] },
          },
          {
            id: id("src_upload"),
            projectId,
            type: "upload",
            displayName: "Uploaded Files",
            description: "Internal files added to this project.",
            enabled: true,
            config: {},
          },
        ];
        set((state) => ({
          projects: [project, ...state.projects],
          sources: [...state.sources, ...baseSources],
          selections: updateSelection(state.selections, projectId, [], state.dataItems),
          activeProjectId: projectId,
        }));
        return projectId;
      },
      setActiveProject: (projectId) => set({ activeProjectId: projectId }),
      setSourceTab: (tab) => set({ sourceTab: tab }),
      setSelectedDataSource: (sourceId) => set({ selectedDataSourceId: sourceId }),
      setActiveDataItem: (itemId) => set({ activeDataItemId: itemId }),
      toggleSource: (sourceId) =>
        set((state) => ({
          sources: state.sources.map((source) =>
            source.id === sourceId ? { ...source, enabled: !source.enabled } : source,
          ),
        })),
      startDemoRun: (projectId, sourceIds) => {
        const runId = `RUN-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(get().runs.length + 1).padStart(3, "0")}`;
        const run: SourceRun = {
          id: runId,
          projectId,
          sourceIds,
          status: "running",
          progress: 12,
          startedAt: Date.now(),
          recordsCreated: 0,
          warnings: [],
          log: ["Collection queued.", "Preparing source configuration."],
        };
        set((state) => ({
          runs: [run, ...state.runs],
          sources: state.sources.map((source) =>
            sourceIds.includes(source.id) ? { ...source, lastRunId: runId } : source,
          ),
          activity: [
            {
              id: id("act"),
              projectId,
              label: "Collection run started",
              tone: "info",
              createdAt: Date.now(),
            },
            ...state.activity,
          ],
        }));
        return runId;
      },
      addUploadedFile: (file, items) =>
        set((state) => ({
          uploadedFiles: [file, ...state.uploadedFiles],
          dataItems: [...items, ...state.dataItems],
          activity: [
            {
              id: id("act"),
              projectId: file.projectId,
              label: `${file.name} uploaded and parsed`,
              tone: "success",
              createdAt: Date.now(),
            },
            ...state.activity,
          ],
        })),
      toggleDataSelection: (projectId, itemId) =>
        set((state) => {
          const selection =
            state.selections.find((entry) => entry.projectId === projectId)?.selectedItemIds ?? [];
          const next = selection.includes(itemId)
            ? selection.filter((id) => id !== itemId)
            : [...selection, itemId];
          return { selections: updateSelection(state.selections, projectId, next, state.dataItems) };
        }),
      setSelection: (projectId, itemIds) =>
        set((state) => ({
          selections: updateSelection(state.selections, projectId, itemIds, state.dataItems),
        })),
      createReport: (input) => {
        const reportId = id("report");
        const selectedItems = get().dataItems.filter((item) =>
          input.selectedItemIds.includes(item.id),
        );
        const html = buildReportHtml({ ...input, selectedItems });
        const now = Date.now();
        const report: Report = {
          ...input,
          id: reportId,
          status: "ready",
          html,
          sections: buildSections(reportId, input.selectedItemIds),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          reports: [report, ...state.reports],
          activity: [
            {
              id: id("act"),
              projectId: input.projectId,
              label: `Report "${input.name}" generated`,
              tone: "info",
              createdAt: now,
            },
            ...state.activity,
          ],
          activeReportSectionId: report.sections[0]?.id,
        }));
        return reportId;
      },
      setReportHtml: (reportId, html) =>
        set((state) => ({
          reports: state.reports.map((report) =>
            report.id === reportId ? touch({ ...report, html }) : report,
          ),
        })),
      setReportStatus: (reportId, status) =>
        set((state) => ({
          reports: state.reports.map((report) =>
            report.id === reportId ? touch({ ...report, status }) : report,
          ),
        })),
      setActiveReportSection: (sectionId) => set({ activeReportSectionId: sectionId }),
      updateReportSection: (reportId, sectionId, html) =>
        set((state) => ({
          reports: state.reports.map((report) =>
            report.id === reportId
              ? touch({
                  ...report,
                  sections: report.sections.map((section) =>
                    section.id === sectionId ? { ...section, html } : section,
                  ),
                })
              : report,
          ),
        })),
      addSectionComment: (reportId, sectionId, text) =>
        set((state) => ({
          reports: state.reports.map((report) => {
            if (report.id !== reportId) return report;
            const comment: ReportComment = {
              id: id("comment"),
              sectionId,
              text,
              resolved: false,
              createdAt: Date.now(),
            };
            return touch({
              ...report,
              sections: report.sections.map((section) =>
                section.id === sectionId
                  ? { ...section, comments: [...section.comments, comment] }
                  : section,
              ),
            });
          }),
        })),
      resolveComment: (reportId, sectionId, commentId) =>
        set((state) => ({
          reports: state.reports.map((report) =>
            report.id === reportId
              ? touch({
                  ...report,
                  sections: report.sections.map((section) =>
                    section.id === sectionId
                      ? {
                          ...section,
                          comments: section.comments.map((comment) =>
                            comment.id === commentId ? { ...comment, resolved: true } : comment,
                          ),
                        }
                      : section,
                  ),
                })
              : report,
          ),
        })),
      deleteReportSection: (reportId, sectionId) =>
        set((state) => ({
          reports: state.reports.map((report) =>
            report.id === reportId
              ? touch({
                  ...report,
                  sections: report.sections
                    .filter((section) => section.id !== sectionId)
                    .map((section, index) => ({ ...section, order: index })),
                })
              : report,
          ),
        })),
      moveReportSection: (reportId, sectionId, direction) =>
        set((state) => ({
          reports: state.reports.map((report) => {
            if (report.id !== reportId) return report;
            const sections = [...report.sections].sort((a, b) => a.order - b.order);
            const index = sections.findIndex((section) => section.id === sectionId);
            const target = direction === "up" ? index - 1 : index + 1;
            if (index < 0 || target < 0 || target >= sections.length) return report;
            const tmp = sections[index];
            sections[index] = sections[target]!;
            sections[target] = tmp!;
            return touch({
              ...report,
              sections: sections.map((section, order) => ({ ...section, order })),
            });
          }),
        })),
    }),
    {
      name: "industry-insight-studio-store",
      version: 1,
    },
  ),
);

export function useIndustryHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(useIndustryStore.persist.hasHydrated());
    return useIndustryStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}

export function getProjectCounts(state: Pick<State, "sources" | "dataItems" | "reports">, projectId: string): ProjectCounts {
  const projectItems = state.dataItems.filter((item) => item.projectId === projectId);
  const companies = new Set(
    projectItems
      .map((item) => item.fields.company)
      .filter((value): value is string => typeof value === "string" && value.length > 0),
  );
  return {
    companies: companies.size,
    dataItems: projectItems.length,
    reports: state.reports.filter((report) => report.projectId === projectId).length,
    sources: state.sources.filter((source) => source.projectId === projectId).length,
  };
}

export function getProjectSelection(state: Pick<State, "selections">, projectId: string) {
  return (
    state.selections.find((selection) => selection.projectId === projectId) ?? {
      projectId,
      selectedItemIds: [],
      countsByKind: {},
      updatedAt: 0,
    }
  );
}

"use client";

import Link from "next/link";
import { ExternalLink, FileText, Image, Search } from "lucide-react";
import { formatKindLabel } from "@/lib/industry/selection";
import { getProjectSelection, useIndustryStore } from "@/lib/industry/store";
import type { DataItem, DataKind } from "@/lib/industry/types";
import { ProjectShell } from "./shell";

export function DataWorkspacePage({ projectId }: { projectId: string }) {
  const state = useIndustryStore((s) => s);
  const items = state.dataItems.filter((item) => item.projectId === projectId);
  const sources = state.sources.filter((source) => source.projectId === projectId);
  const selectedSourceId = state.selectedDataSourceId;
  const activeItem = items.find((item) => item.id === state.activeDataItemId) ?? items[0];
  const selection = getProjectSelection(state, projectId);
  const filtered =
    selectedSourceId === "all"
      ? items
      : items.filter((item) => item.sourceId === selectedSourceId || item.kind === selectedSourceId);

  return (
    <ProjectShell projectId={projectId} section="Data">
      <div className="-m-[38px_48px_68px] grid h-[calc(100vh-52px)] min-h-[620px] grid-cols-[260px_minmax(420px,1fr)_340px] overflow-hidden bg-white">
        <aside className="min-w-0 overflow-auto border-r border-[var(--iis-border)] bg-white py-5">
          <h2 className="mx-5 mb-4 mt-0 text-[17px] font-semibold">Data Sources</h2>
          <button
            className={`grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-5 py-2.5 text-left ${
              selectedSourceId === "all" ? "bg-[#eef6ff] text-[var(--iis-text)]" : "text-[var(--iis-muted)]"
            }`}
            onClick={() => state.setSelectedDataSource("all")}
            type="button"
          >
            <span className="text-[14px] font-semibold">▦ All Data</span>
            <em className="text-[14px] not-italic">{items.length}</em>
            <small className="col-start-2 text-[12px] text-[var(--iis-accent)]">{selection.selectedItemIds.length} sel</small>
          </button>
          <DataSourceGroup title="External">
            <SourceButton sourceId="job" label="Jobs" kind="job" projectId={projectId} />
            <SourceButton sourceId="news" label="News" kind="news" projectId={projectId} />
            <SourceButton sourceId="web_page" label="Web Pages" kind="web_page" projectId={projectId} />
          </DataSourceGroup>
          <DataSourceGroup title="Uploaded">
            {sources
              .filter((source) => source.type === "upload")
              .map((source) => (
                <button
                  key={source.id}
                  className={`grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-5 py-2.5 text-left ${
                    selectedSourceId === source.id ? "bg-[#eef6ff] text-[var(--iis-text)]" : "text-[var(--iis-muted)]"
                  }`}
                  onClick={() => state.setSelectedDataSource(source.id)}
                  type="button"
                >
                  <span className="flex items-center gap-2 text-[14px] font-semibold"><FileText size={16} /> Uploaded Files</span>
                  <em className="text-[14px] not-italic">{items.filter((item) => item.sourceId === source.id).length}</em>
                  <small className="col-start-2 text-[12px] text-[var(--iis-accent)]">
                    {items.filter((item) => selection.selectedItemIds.includes(item.id) && item.sourceId === source.id).length} sel
                  </small>
                </button>
              ))}
            <SourceButton sourceId="pdf_page" label="PDF Pages" kind="pdf_page" projectId={projectId} />
            <SourceButton sourceId="image" label="Images" kind="image" projectId={projectId} />
          </DataSourceGroup>
        </aside>

        <section className="flex min-w-0 flex-col border-r border-[var(--iis-border)] bg-white">
          <div className="border-b border-[var(--iis-border)] px-6 py-5">
            <h1 className="m-0 text-[22px] font-semibold">{selectedSourceId === "all" ? "All Data" : titleForSource(selectedSourceId)}</h1>
            <p className="mt-2 text-[14px] text-[var(--iis-muted)]">{filtered.length} records</p>
          </div>
          <div className="grid grid-cols-[44px_180px_auto] gap-2 border-b border-[var(--iis-border)] px-6 py-3">
            <button className="grid place-items-center rounded-md border border-[var(--iis-border)] bg-white text-[var(--iis-muted)]" type="button"><Search size={18} /></button>
            <select className="rounded-md border border-[var(--iis-border)] bg-white px-3 text-[14px]" defaultValue="all">
              <option value="all">All</option>
              <option value="selected">Selected</option>
              <option value="jobs">Jobs</option>
            </select>
            <button className="iis-button iis-button-ghost" type="button">More Filters</button>
          </div>
          <StructuredRecordsTable projectId={projectId} items={filtered} activeItemId={activeItem?.id} />
        </section>

        <DataDetailsPanel projectId={projectId} item={activeItem} />
      </div>
      <SelectionSummaryBar projectId={projectId} />
    </ProjectShell>
  );
}

function DataSourceGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mx-5 mb-2 mt-5 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--iis-muted)]">{title}</h3>
      {children}
    </div>
  );
}

function SourceButton({
  sourceId,
  label,
  kind,
  projectId,
}: {
  sourceId: string;
  label: string;
  kind: DataKind;
  projectId: string;
}) {
  const state = useIndustryStore((s) => s);
  const items = state.dataItems.filter((item) => item.projectId === projectId && item.kind === kind);
  const selection = getProjectSelection(state, projectId);
  return (
    <button
      className={`grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 px-5 py-2.5 text-left ${
        state.selectedDataSourceId === sourceId ? "bg-[#eef6ff] text-[var(--iis-text)]" : "text-[var(--iis-muted)]"
      }`}
      onClick={() => state.setSelectedDataSource(sourceId)}
      type="button"
    >
      <span className="flex items-center gap-2 text-[14px] font-semibold">{kind === "image" ? <Image size={16} /> : <FileText size={16} />} {label}</span>
      <em className="text-[14px] not-italic">{items.length}</em>
      <small className="col-start-2 text-[12px] text-[var(--iis-accent)]">{items.filter((item) => selection.selectedItemIds.includes(item.id)).length} sel</small>
    </button>
  );
}

function StructuredRecordsTable({
  projectId,
  items,
  activeItemId,
}: {
  projectId: string;
  items: DataItem[];
  activeItemId?: string;
}) {
  const state = useIndustryStore((s) => s);
  const selection = getProjectSelection(state, projectId);
  return (
    <table className="w-full border-collapse bg-white text-[14px]">
      <thead>
        <tr>
          <th className="w-10 bg-[#fafbfc] px-5 py-3 text-left text-[12px] uppercase tracking-wide text-[var(--iis-muted)]"><input type="checkbox" aria-label="Select all" /></th>
          <th className="bg-[#fafbfc] px-4 py-3 text-left text-[12px] uppercase tracking-wide text-[var(--iis-muted)]">Title</th>
          <th className="bg-[#fafbfc] px-4 py-3 text-left text-[12px] uppercase tracking-wide text-[var(--iis-muted)]">Company</th>
          <th className="bg-[#fafbfc] px-4 py-3 text-left text-[12px] uppercase tracking-wide text-[var(--iis-muted)]">Location</th>
          <th className="bg-[#fafbfc] px-4 py-3 text-left text-[12px] uppercase tracking-wide text-[var(--iis-muted)]">Kind</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const checked = selection.selectedItemIds.includes(item.id);
          return (
            <tr key={item.id} className={`cursor-pointer border-b border-[var(--iis-border)] ${activeItemId === item.id ? "bg-[#eef6ff]" : ""}`} onClick={() => state.setActiveDataItem(item.id)}>
              <td className="w-10 px-5 py-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    event.stopPropagation();
                    state.toggleDataSelection(projectId, item.id);
                  }}
                  onClick={(event) => event.stopPropagation()}
                  aria-label={`Select ${item.title}`}
                />
              </td>
              <td className="px-4 py-3"><strong className="block text-[14px]">{item.title}</strong><small className="block max-w-[380px] truncate text-[12px] text-[var(--iis-muted)]">{item.summary}</small></td>
              <td className="px-4 py-3">{String(item.fields.company ?? "-")}</td>
              <td className="px-4 py-3">{String(item.fields.location ?? "-")}</td>
              <td className="px-4 py-3">{formatKindLabel(item.kind)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function DataDetailsPanel({ projectId, item }: { projectId: string; item?: DataItem }) {
  const state = useIndustryStore((s) => s);
  const selection = getProjectSelection(state, projectId);
  if (!item) {
    return <aside className="min-w-0 overflow-auto bg-white p-6"><p>Select a data item to preview details.</p></aside>;
  }
  const checked = selection.selectedItemIds.includes(item.id);
  return (
    <aside className="min-w-0 overflow-auto bg-white p-6">
      <div className="iis-tabs-flat">
        <button className="active" type="button">Details</button>
        <button type="button">Raw</button>
      </div>
      <h2>{item.title}</h2>
      <p>{String(item.fields.company ?? formatKindLabel(item.kind))} · {String(item.fields.location ?? "Project data")}</p>
      <dl>
        <dt>Source</dt>
        <dd>{item.url ?? item.fileRef ?? item.sourceId}</dd>
        {Object.entries(item.fields).map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{Array.isArray(value) ? value.join(", ") : String(value ?? "-")}</dd>
          </div>
        ))}
      </dl>
      <h3>{item.kind === "job" ? "Job Description" : "Preview"}</h3>
      <p>{item.rawText}</p>
      {item.url && (
        <a className="iis-open-source" href={item.url} target="_blank" rel="noreferrer">
          <ExternalLink size={18} /> Open Source
        </a>
      )}
      <label className="iis-include-check">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => state.toggleDataSelection(projectId, item.id)}
        />
        Include in Report
      </label>
    </aside>
  );
}

function SelectionSummaryBar({ projectId }: { projectId: string }) {
  const state = useIndustryStore((s) => s);
  const selection = getProjectSelection(state, projectId);
  const counts = Object.entries(selection.countsByKind);
  return (
    <div className="iis-selection-bar">
      <strong>{selection.selectedItemIds.length} items selected</strong>
      <div>
        {counts.map(([kind, count]) => (
          <span key={kind}>{count} {formatKindLabel(kind as DataKind)}</span>
        ))}
      </div>
      <Link className="iis-button iis-button-ghost" href={`/projects/${projectId}/reports/new`}>
        Review Selection
      </Link>
      <Link className="iis-button iis-button-primary" href={`/projects/${projectId}/reports/new`}>
        + Create Report
      </Link>
    </div>
  );
}

function titleForSource(sourceId: string) {
  if (sourceId === "job") return "Jobs";
  if (sourceId === "news") return "News";
  if (sourceId === "web_page") return "Web Pages";
  if (sourceId === "pdf_page") return "PDF Pages";
  if (sourceId === "image") return "Images";
  return "Uploaded Files";
}

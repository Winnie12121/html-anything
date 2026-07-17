"use client";

import { useMemo, useState } from "react";
import { List, Play, Settings2, Upload, X } from "lucide-react";
import { parseFile } from "@/lib/parsers/file";
import type { DataItem, DataKind, UploadedFile } from "@/lib/industry/types";
import { formatBytes, relativeTime } from "@/lib/industry/format";
import { useIndustryStore } from "@/lib/industry/store";
import {
  PageHeader,
  ProjectShell,
  SourceIcon,
  StatusBadge,
} from "./shell";

const TABS = [
  { id: "external", label: "External Sources" },
  { id: "uploads", label: "Uploaded Files" },
  { id: "history", label: "Run History" },
] as const;

export function SourcesPage({ projectId }: { projectId: string }) {
  const tab = useIndustryStore((s) => s.sourceTab);
  const setTab = useIndustryStore((s) => s.setSourceTab);

  return (
    <ProjectShell projectId={projectId} section="Sources">
      <div className="mb-7 flex items-start justify-between gap-6">
        <div>
          <h1 className="m-0 text-[24px] font-semibold leading-tight">Sources</h1>
          <p className="mt-2 text-[15px] text-[var(--iis-muted)]">
            Configure and run data collection for this project.
          </p>
        </div>
        <div className="inline-flex shrink-0 items-center rounded-md bg-[var(--iis-surface-muted)] p-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              className={`h-8 rounded px-4 text-[13px] font-semibold ${
                tab === item.id ? "bg-white text-[var(--iis-text)] shadow-sm" : "text-[var(--iis-muted)]"
              }`}
              onClick={() => setTab(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {tab === "external" && <ExternalSources projectId={projectId} />}
      {tab === "uploads" && <UploadedFiles projectId={projectId} />}
      {tab === "history" && <RunHistory projectId={projectId} />}
    </ProjectShell>
  );
}

function ExternalSources({ projectId }: { projectId: string }) {
  const allSources = useIndustryStore((s) => s.sources);
  const allRuns = useIndustryStore((s) => s.runs);
  const sources = useMemo(
    () => allSources.filter((source) => source.projectId === projectId && source.type !== "upload"),
    [allSources, projectId],
  );
  const runs = useMemo(
    () => allRuns.filter((run) => run.projectId === projectId),
    [allRuns, projectId],
  );
  const toggleSource = useIndustryStore((s) => s.toggleSource);
  const startDemoRun = useIndustryStore((s) => s.startDemoRun);
  const currentRun = runs.find((run) => run.status === "running");
  const selected = sources.filter((source) => source.enabled);

  return (
    <div className="grid gap-4">
      {currentRun && (
        <section className="overflow-hidden rounded-lg border border-[var(--iis-border)] bg-white">
          <header className="flex items-center justify-between gap-4 border-b border-[var(--iis-border)] px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="iis-spinner" />
              <strong className="text-[16px]">Collection Run</strong>
              <code className="rounded bg-[var(--iis-surface-muted)] px-2 py-1 font-mono text-[12px] text-[var(--iis-muted)]">{currentRun.id}</code>
            </div>
            <div className="flex items-center gap-2">
              <button className="iis-button iis-button-ghost" type="button">
                <List size={18} /> View Details
              </button>
              <button className="iis-button iis-button-danger" type="button">
                <X size={18} /> Stop Run
              </button>
            </div>
          </header>
          <div className="grid grid-cols-[minmax(0,1fr)_44px] items-center gap-4 px-6 pb-3 pt-6">
            <div className="h-1.5 rounded-full bg-[var(--iis-surface-muted)]">
              <div className="h-1.5 rounded-full bg-[var(--iis-accent)]" style={{ width: `${currentRun.progress}%` }} />
            </div>
            <strong className="text-[15px]">{currentRun.progress}%</strong>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-x-8 gap-y-3 px-6 py-4 text-[14px]">
            <span>Career Sites <em className="ml-5 text-[var(--iis-muted)] not-italic">5 / 5 companies</em></span>
            <span className="flex items-center gap-3">326 records <StatusBadge status="completed" /></span>
            <span>Tavily <em className="ml-5 text-[var(--iis-muted)] not-italic">8 / 12 queries</em></span>
            <span className="flex items-center gap-3">31 records <StatusBadge status="running" /></span>
            <span>Liepin <em className="ml-5 text-[var(--iis-muted)] not-italic">-</em></span>
            <span className="flex items-center gap-3">- <StatusBadge status="waiting" /></span>
          </div>
          <p className="mx-6 mb-5 rounded bg-[var(--iis-surface-muted)] px-3 py-2 text-[14px] text-[var(--iis-muted)]">
            Current: <strong className="text-[var(--iis-text)]">Extracting Continental job details</strong>
          </p>
        </section>
      )}

      <div className="flex items-center justify-between gap-4 text-[14px] text-[var(--iis-muted)]">
        <span>{selected.length} sources selected</span>
        <button
          className="iis-button iis-button-primary"
          type="button"
          onClick={() => startDemoRun(projectId, selected.map((source) => source.id))}
        >
          <Play size={18} /> Run Selected Sources
        </button>
      </div>

      {sources.map((source) => {
        const lastRun = runs.find((run) => run.id === source.lastRunId);
        return (
          <section
            key={source.id}
            className={`grid grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-4 rounded-lg border bg-white p-5 ${
              source.enabled ? "border-[#9fc8ee] bg-[#f2f8ff]" : "border-[var(--iis-border)]"
            }`}
          >
            <label className="grid justify-items-center gap-3">
              <input
                type="checkbox"
                checked={source.enabled}
                onChange={() => toggleSource(source.id)}
              />
              <span>
                <SourceIcon type={source.type} />
              </span>
            </label>
            <div className="min-w-0">
              <h2 className="m-0 text-[17px] font-semibold leading-tight">{source.displayName}</h2>
              <p className="my-2 text-[14px] leading-relaxed text-[var(--iis-muted)]">{source.description}</p>
              <small className="text-[13px] text-[var(--iis-muted)]">
                {describeConfig(source.config)}
                {lastRun && <> · Last run {relativeTime(lastRun.startedAt)} · {lastRun.recordsCreated} records</>}
                {lastRun?.status === "completed_with_warnings" && <> · <b>Last run completed with warnings</b></>}
              </small>
            </div>
            <div className="flex items-center gap-2">
              <button className="iis-button iis-button-ghost" type="button">
                <Settings2 size={18} /> Configure
              </button>
              <button className="iis-button iis-button-ghost" type="button" onClick={() => startDemoRun(projectId, [source.id])}>
                <Play size={18} /> Run
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function UploadedFiles({ projectId }: { projectId: string }) {
  const allFiles = useIndustryStore((s) => s.uploadedFiles);
  const files = useMemo(
    () => allFiles.filter((file) => file.projectId === projectId),
    [allFiles, projectId],
  );
  const addUploadedFile = useIndustryStore((s) => s.addUploadedFile);
  const [dragging, setDragging] = useState(false);

  const ingest = async (fileList: FileList | null) => {
    if (!fileList) return;
    for (const file of Array.from(fileList)) {
      const parsed = await parseFile(file);
      const itemId = `di-upload-${crypto.randomUUID()}`;
      const fileId = `file-${crypto.randomUUID()}`;
      const kind = mapFormatToKind(parsed.format);
      const item: DataItem = {
        id: itemId,
        projectId,
        sourceId: "src-upload",
        kind,
        title: parsed.filename,
        summary: parsed.text.slice(0, 180).replace(/\s+/g, " "),
        fields: { format: parsed.format },
        rawText: parsed.text,
        fileRef: fileId,
        createdAt: Date.now(),
      };
      const uploaded: UploadedFile = {
        id: fileId,
        projectId,
        name: parsed.filename,
        mimeType: file.type || parsed.format,
        size: file.size,
        status: "ready",
        parsedItemIds: [itemId],
        blobRef: parsed.dataUrl,
        uploadedAt: Date.now(),
      };
      addUploadedFile(uploaded, [item]);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="m-0 text-[14px] text-[var(--iis-muted)]">Add internal Excel, PDF, Markdown, text, and image files to this project.</p>
        <label className="iis-button iis-button-primary">
          <Upload size={18} /> Upload Files
          <input hidden type="file" multiple onChange={(event) => void ingest(event.currentTarget.files)} />
        </label>
      </div>
      <label
        className={`grid min-h-[150px] cursor-pointer place-items-center gap-2 rounded-lg border-2 border-dashed border-[#9fc8ee] bg-white text-center text-[var(--iis-muted)] ${dragging ? "bg-[#eef7ff]" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void ingest(event.dataTransfer.files);
        }}
      >
        <Upload size={38} />
        <strong>Drag and drop files here</strong>
        <span>Supports Excel, CSV, PDF, Markdown, TXT, Images</span>
        <input hidden type="file" multiple onChange={(event) => void ingest(event.currentTarget.files)} />
      </label>

      <table className="iis-table">
        <thead>
          <tr>
            <th>File Name</th>
            <th>Type</th>
            <th>Status</th>
            <th>Size</th>
            <th>Uploaded</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.id}>
              <td>{file.name}</td>
              <td><span className="iis-mini-chip">{file.mimeType.includes("pdf") ? "PDF" : file.mimeType.includes("image") ? "Image" : file.name.split(".").pop()}</span></td>
              <td><StatusBadge status={file.status === "failed" ? "failed" : file.status === "parsing" ? "parsing" : "ready"} /></td>
              <td>{formatBytes(file.size)}</td>
              <td>{relativeTime(file.uploadedAt)}</td>
              <td><button className="iis-link-button" type="button">Open</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RunHistory({ projectId }: { projectId: string }) {
  const allRuns = useIndustryStore((s) => s.runs);
  const runs = useMemo(
    () => allRuns.filter((run) => run.projectId === projectId),
    [allRuns, projectId],
  );
  const sources = useIndustryStore((s) => s.sources);
  return (
    <table className="iis-table iis-run-table">
      <thead>
        <tr>
          <th>Run ID</th>
          <th>Source</th>
          <th>Status</th>
          <th>Records</th>
          <th>Duration</th>
          <th>Started At</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {runs.map((run) => (
          <tr key={run.id}>
            <td><code>{run.id}</code></td>
            <td>{run.sourceIds.length > 1 ? "All Sources" : sources.find((source) => source.id === run.sourceIds[0])?.displayName ?? "Source"}</td>
            <td><StatusBadge status={run.status} /></td>
            <td>{run.recordsCreated || "-"}</td>
            <td>{run.endedAt ? `${Math.round((run.endedAt - run.startedAt) / 1000)}s` : "-"}</td>
            <td>{relativeTime(run.startedAt)}</td>
            <td><button className="iis-link-button" type="button">Details</button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function describeConfig(config: Record<string, unknown>) {
  if (Array.isArray(config.companies)) return `${config.companies.length} companies configured`;
  if (Array.isArray(config.keywords)) return `${config.keywords.length} keywords configured`;
  if (Array.isArray(config.topics)) return `${config.topics.length} search topics configured`;
  if (Array.isArray(config.urls)) return `${config.urls.length} URLs configured`;
  return "Configured";
}

function mapFormatToKind(format: string): DataKind {
  if (format === "pdf") return "pdf_page";
  if (format === "csv" || format === "xlsx" || format === "xls") return "sheet_row";
  if (format === "markdown" || format === "md") return "markdown";
  if (format === "image") return "image";
  return "text";
}

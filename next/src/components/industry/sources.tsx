"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { List, Play, Trash2, Upload } from "lucide-react";
import { relativeTime } from "@/lib/industry/format";
import type { WorkspaceUploadedFile } from "@/lib/industry/workspace/uploads";
import type {
  WorkspaceRunManifest,
  WorkspaceSourcesView,
} from "@/lib/industry/workspace/client";
import {
  ProjectShell,
  SourceIcon,
  StatusBadge,
} from "./shell";

const TABS = [
  { id: "external", label: "External Sources" },
  { id: "uploads", label: "Uploaded Files" },
  { id: "history", label: "Run History" },
] as const;

type SourceTab = (typeof TABS)[number]["id"];

export function SourcesPage({
  projectId,
  sourcesView,
}: {
  projectId: string;
  sourcesView?: WorkspaceSourcesView;
}) {
  const [tab, setTab] = useState<SourceTab>("external");

  if (!sourcesView) {
    return (
      <ProjectShell projectId={projectId} section="Sources">
        <div className="iis-missing">
          <h1>Project sources not found</h1>
        </div>
      </ProjectShell>
    );
  }

  return (
    <ProjectShell
      projectId={projectId}
      projectName={sourcesView.project.name}
      counts={sourcesView.counts}
      section="Sources"
    >
      <div className="iis-page-header">
        <div>
          <h1>Sources</h1>
          <p>Run data collection for this project.</p>
        </div>
        <div className="iis-segmented">
          {TABS.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "active" : ""}
              onClick={() => setTab(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "external" && (
        <ExternalSources projectId={projectId} sourcesView={sourcesView} />
      )}
      {tab === "uploads" && <UploadedFiles projectId={projectId} />}
      {tab === "history" && <RunHistory runs={sourcesView.runs} />}
    </ProjectShell>
  );
}

function ExternalSources({
  projectId,
  sourcesView,
}: {
  projectId: string;
  sourcesView: WorkspaceSourcesView;
}) {
  const router = useRouter();
  const externalSources = sourcesView.sourceConfig.sources;
  const [selectedIds, setSelectedIds] = useState<string[]>(
    externalSources.filter((source) => source.enabled).map((source) => source.id),
  );
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveRun, setLiveRun] = useState<WorkspaceRunManifest | null>(null);
  const [liveMessages, setLiveMessages] = useState<string[]>([]);
  const latestRun = sourcesView.runs[0];

  const selectedCount = selectedIds.length;

  async function runCollection(sourceIds: string[]) {
    setRunning(true);
    setError(null);
    setLiveRun(null);
    setLiveMessages([]);
    try {
      const res = await fetch(`/api/projects/${projectId}/sources/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceIds }),
      });
      if (!res.ok || !res.body) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Collection failed");
      }
      await readRunStream(res.body, (event) => {
        if (event.run) setLiveRun(event.run);
        if (event.message) {
          setLiveMessages((current) => [...current.slice(-5), event.message as string]);
        }
        if (event.type === "failed") {
          setError(event.error ?? event.message ?? "Collection failed");
        }
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="iis-stack">
      {(liveRun ?? latestRun) && (
        <CollectionRunPanel
          run={(liveRun ?? latestRun) as WorkspaceRunManifest}
          messages={liveMessages}
        />
      )}

      <div className="iis-source-toolbar">
        <span>{selectedCount} sources selected</span>
        <button
          className="iis-button iis-button-primary"
          type="button"
          disabled={running || selectedIds.length === 0}
          onClick={() => void runCollection(selectedIds)}
        >
          <Play size={18} /> {running ? "Collecting..." : "Run Selected Sources"}
        </button>
      </div>
      {error && <p className="iis-form-error">{error}</p>}

      {externalSources.map((source) => {
        const checked = selectedIds.includes(source.id);
        const lastRun = source.lastRunId
          ? sourcesView.runs.find((run) => run.id === source.lastRunId)
          : undefined;
        return (
          <section
            key={source.id}
            className={checked ? "iis-source-card selected" : "iis-source-card"}
          >
            <label className="iis-source-check">
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  setSelectedIds((current) =>
                    current.includes(source.id)
                      ? current.filter((id) => id !== source.id)
                      : [...current, source.id],
                  )
                }
              />
              <SourceIcon type={source.type} />
            </label>
            <div>
              <h2>{source.displayName}</h2>
              <p>{source.description}</p>
              <small>
                {describeConfig(source.config)}
                {lastRun && (
                  <>
                    {" · "}Last run {relativeTime(Date.parse(lastRun.startedAt))}
                    {" · "}
                    {lastRun.recordsCreated} records
                  </>
                )}
              </small>
            </div>
          </section>
        );
      })}
    </div>
  );
}

type RunStreamEvent = {
  type?: string;
  run?: WorkspaceRunManifest;
  message?: string;
  error?: string;
};

async function readRunStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: RunStreamEvent) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      onEvent(JSON.parse(line) as RunStreamEvent);
    }
  }

  if (buffer.trim()) onEvent(JSON.parse(buffer) as RunStreamEvent);
}

function CollectionRunPanel({
  run,
  messages,
}: {
  run: WorkspaceRunManifest;
  messages?: string[];
}) {
  return (
    <section className="iis-card iis-run-panel">
      <header>
        <div>
          <strong>Latest Collection Run</strong>
          <code>{run.id}</code>
        </div>
        <div>
          <button className="iis-button iis-button-ghost" type="button">
            <List size={18} /> View Details
          </button>
          <StatusBadge status={run.status} />
        </div>
      </header>
      <div className="iis-progress-line">
        <span style={{ width: `${run.progress}%` }} />
        <strong>{run.progress}%</strong>
      </div>
      <div className="iis-run-steps">
        <span>{run.sourceIds.length > 1 ? "Multiple sources" : run.sourceIds[0]}</span>
        <span>{run.recordsCreated} records</span>
        <span>{run.warnings.length ? "Warnings or errors recorded" : "Ready"}</span>
      </div>
      {messages && messages.length > 0 && (
        <ol className="iis-run-log">
          {messages.map((message, index) => (
            <li key={`${index}-${message}`}>{message}</li>
          ))}
        </ol>
      )}
      {run.warnings.length > 0 && (
        <p>
          Current: <strong>{run.warnings[0]}</strong>
        </p>
      )}
    </section>
  );
}

function UploadedFiles({ projectId }: { projectId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<WorkspaceUploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function loadUploads() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectId}/uploads`);
        const payload = (await res.json()) as {
          uploads?: { files: WorkspaceUploadedFile[] };
          error?: string;
        };
        if (!res.ok) throw new Error(payload.error ?? "Failed to load uploads");
        if (alive) setFiles(payload.uploads?.files ?? []);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (alive) setLoading(false);
      }
    }
    void loadUploads();
    return () => {
      alive = false;
    };
  }, [projectId]);

  async function uploadFiles(fileList: FileList | null) {
    const selected = Array.from(fileList ?? []);
    if (!selected.length) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      selected.forEach((file) => form.append("files", file));
      const res = await fetch(`/api/projects/${projectId}/uploads`, {
        method: "POST",
        body: form,
      });
      const payload = (await res.json()) as {
        uploads?: { files: WorkspaceUploadedFile[] };
        recordsCreated?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error ?? "Upload failed");
      setFiles(payload.uploads?.files ?? []);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function deleteUpload(fileId: string) {
    setDeletingId(fileId);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/uploads/${fileId}`, {
        method: "DELETE",
      });
      const payload = (await res.json()) as {
        uploads?: { files: WorkspaceUploadedFile[] };
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error ?? "Delete failed");
      setFiles(payload.uploads?.files ?? []);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="iis-stack">
      <label className="iis-dropzone">
        <Upload size={34} />
        <strong>{uploading ? "Uploading and parsing..." : "Upload project evidence"}</strong>
        <span>CSV, Excel, PDF, Markdown, text, JSON, and image files are supported.</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          disabled={uploading}
          onChange={(event) => void uploadFiles(event.target.files)}
        />
      </label>
      {error && <p className="iis-form-error">{error}</p>}
      <table className="iis-table">
        <thead>
          <tr>
            <th>File Name</th>
            <th>Type</th>
            <th>Status</th>
            <th>Records</th>
            <th>Size</th>
            <th>Uploaded</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={7}>Loading uploaded files...</td>
            </tr>
          ) : files.length ? (
            files.map((file) => (
              <tr key={file.id}>
                <td>{file.name}</td>
                <td>{file.mimeType || file.name.split(".").pop() || "file"}</td>
                <td><StatusBadge status={file.status === "ready" ? "completed" : file.status} /></td>
                <td>{file.parsedRecordRefs.length}</td>
                <td>{formatBytes(file.size)}</td>
                <td>{relativeTime(Date.parse(file.uploadedAt))}</td>
                <td>
                  <button
                    className="iis-link-button"
                    type="button"
                    disabled={deletingId === file.id}
                    onClick={() => void deleteUpload(file.id)}
                  >
                    <Trash2 size={16} /> {deletingId === file.id ? "Deleting..." : "Delete"}
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7}>No uploaded files yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RunHistory({ runs }: { runs: WorkspaceRunManifest[] }) {
  const rows = useMemo(() => runs, [runs]);
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
        {rows.length ? (
          rows.map((run) => (
            <tr key={run.id}>
              <td><code>{run.id}</code></td>
              <td>{run.sourceIds.length > 1 ? "Selected Sources" : run.sourceIds[0]}</td>
              <td><StatusBadge status={run.status} /></td>
              <td>{run.recordsCreated || "-"}</td>
              <td>{formatDuration(run)}</td>
              <td>{relativeTime(Date.parse(run.startedAt))}</td>
              <td><button className="iis-link-button" type="button">Details</button></td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={7}>No collection runs yet.</td>
          </tr>
        )}
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

function formatDuration(run: WorkspaceRunManifest): string {
  if (!run.endedAt) return "-";
  const seconds = Math.max(1, Math.round((Date.parse(run.endedAt) - Date.parse(run.startedAt)) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

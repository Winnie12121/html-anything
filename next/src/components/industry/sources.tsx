"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { List, Play, Settings2, Upload } from "lucide-react";
import { relativeTime } from "@/lib/industry/format";
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
          <p>Configure and run data collection for this project.</p>
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
      {tab === "uploads" && <UploadedFiles />}
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
  const latestRun = sourcesView.runs[0];

  const selectedCount = selectedIds.length;

  async function runCollection(sourceIds: string[]) {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/sources/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceIds }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Collection failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="iis-stack">
      {latestRun && <CollectionRunPanel run={latestRun} />}

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
            <div className="iis-source-actions">
              <button className="iis-button iis-button-ghost" type="button">
                <Settings2 size={18} /> Configure
              </button>
              <button
                className="iis-button iis-button-ghost"
                type="button"
                disabled={running}
                onClick={() => void runCollection([source.id])}
              >
                <Play size={18} /> Run
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CollectionRunPanel({ run }: { run: WorkspaceRunManifest }) {
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
        <span>{run.warnings.length ? "Completed with warnings" : "Ready"}</span>
      </div>
      {run.warnings.length > 0 && (
        <p>
          Current: <strong>{run.warnings[0]}</strong>
        </p>
      )}
    </section>
  );
}

function UploadedFiles() {
  return (
    <div className="iis-stack">
      <div className="iis-dropzone">
        <Upload size={34} />
        <strong>Upload workspace files in a later milestone</strong>
        <span>Milestone 4 focuses on external mock collection.</span>
      </div>
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
          <tr>
            <td colSpan={6}>No uploaded files yet.</td>
          </tr>
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

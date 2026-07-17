"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Database, ExternalLink, FileText, Image, Search } from "lucide-react";
import type {
  WorkspaceDataKind,
  WorkspaceDataRecord,
  WorkspaceDataView,
} from "@/lib/industry/workspace/client";
import { formatWorkspaceDataKind } from "@/lib/industry/workspace/client";
import { ProjectShell } from "./shell";

type SourceFilter = "all" | WorkspaceDataKind;

export function DataWorkspacePage({
  projectId,
  dataView,
}: {
  projectId: string;
  dataView?: WorkspaceDataView;
}) {
  const router = useRouter();
  const [selectedSourceId, setSelectedSourceId] = useState<SourceFilter>("all");
  const [activeRecordId, setActiveRecordId] = useState<string | undefined>(
    dataView?.records[0]?.id,
  );
  const [selectedRefs, setSelectedRefs] = useState<string[]>(
    dataView?.selection.selectedRecordRefs ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!dataView) {
    return (
      <ProjectShell projectId={projectId} section="Data">
        <div className="iis-missing">
          <h1>Project data not found</h1>
        </div>
      </ProjectShell>
    );
  }

  const selectedSet = new Set(selectedRefs);
  const filtered =
    selectedSourceId === "all"
      ? dataView.records
      : dataView.records.filter((record) => record.kind === selectedSourceId);
  const activeRecord =
    dataView.records.find((record) => record.id === activeRecordId) ??
    filtered[0] ??
    dataView.records[0];
  const selectedCounts = countSelectedByKind(dataView.records, selectedSet);

  async function persistSelection(nextRefs: string[]) {
    setSelectedRefs(nextRefs);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/selections/current`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedRecordRefs: nextRefs }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Selection save failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function toggleRecord(ref: string) {
    const next = selectedSet.has(ref)
      ? selectedRefs.filter((item) => item !== ref)
      : [...selectedRefs, ref];
    void persistSelection(next);
  }

  return (
    <ProjectShell
      projectId={projectId}
      projectName={dataView.project.name}
      counts={dataView.counts}
      section="Data"
    >
      <div className="iis-data-shell">
        <aside className="iis-data-sources">
          <h2>Data Sources</h2>
          <DataSourceButton
            active={selectedSourceId === "all"}
            label="All Data"
            count={dataView.sourceCounts.all}
            selectedCount={selectedRefs.length}
            icon={<Database size={16} />}
            onClick={() => setSelectedSourceId("all")}
          />
          <DataSourceGroup title="External">
            <DataSourceButton
              active={selectedSourceId === "job"}
              label="Jobs"
              count={dataView.sourceCounts.job}
              selectedCount={selectedCounts.job}
              icon={<FileText size={16} />}
              onClick={() => setSelectedSourceId("job")}
            />
            <DataSourceButton
              active={selectedSourceId === "news"}
              label="News"
              count={dataView.sourceCounts.news}
              selectedCount={selectedCounts.news}
              icon={<FileText size={16} />}
              onClick={() => setSelectedSourceId("news")}
            />
            <DataSourceButton
              active={selectedSourceId === "web_page"}
              label="Web Pages"
              count={dataView.sourceCounts.web_page}
              selectedCount={selectedCounts.web_page}
              icon={<ExternalLink size={16} />}
              onClick={() => setSelectedSourceId("web_page")}
            />
          </DataSourceGroup>
          <DataSourceGroup title="Uploaded">
            <DataSourceButton
              active={false}
              label="Uploaded Files"
              count={0}
              selectedCount={0}
              icon={<Image size={16} />}
              onClick={() => {}}
            />
          </DataSourceGroup>
        </aside>

        <section className="iis-data-preview">
          <div className="iis-page-header">
            <div>
              <h1>{selectedSourceId === "all" ? "All Data" : formatWorkspaceDataKind(selectedSourceId)}</h1>
              <p>{filtered.length} records</p>
            </div>
          </div>
          <div className="iis-data-toolbar">
            <button className="iis-search-button" type="button" aria-label="Search">
              <Search size={18} />
            </button>
            <select defaultValue="all">
              <option value="all">All</option>
              <option value="selected">Selected</option>
            </select>
            <button className="iis-button iis-button-ghost" type="button">More Filters</button>
          </div>
          <StructuredRecordsTable
            records={filtered}
            activeRecordId={activeRecord?.id}
            selectedRefs={selectedSet}
            onActivate={setActiveRecordId}
            onToggle={toggleRecord}
          />
        </section>

        <DataDetailsPanel
          record={activeRecord}
          checked={activeRecord ? selectedSet.has(activeRecord.ref) : false}
          onToggle={() => activeRecord && toggleRecord(activeRecord.ref)}
        />
      </div>
      <SelectionSummaryBar
        projectId={projectId}
        selectedCount={selectedRefs.length}
        counts={selectedCounts}
        saving={saving}
        error={error}
      />
    </ProjectShell>
  );
}

function DataSourceGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="iis-data-source-group">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function DataSourceButton({
  active,
  label,
  count,
  selectedCount,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  selectedCount: number;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button className={active ? "active" : ""} onClick={onClick} type="button">
      <span>{icon} {label}</span>
      <em>{count}</em>
      <small>{selectedCount} sel</small>
    </button>
  );
}

function StructuredRecordsTable({
  records,
  activeRecordId,
  selectedRefs,
  onActivate,
  onToggle,
}: {
  records: WorkspaceDataRecord[];
  activeRecordId?: string;
  selectedRefs: Set<string>;
  onActivate: (recordId: string) => void;
  onToggle: (ref: string) => void;
}) {
  return (
    <table className="iis-data-table">
      <thead>
        <tr>
          <th><input type="checkbox" aria-label="Select all" /></th>
          <th>Title</th>
          <th>Company</th>
          <th>Location</th>
          <th>Kind</th>
        </tr>
      </thead>
      <tbody>
        {records.length ? (
          records.map((record) => {
            const checked = selectedRefs.has(record.ref);
            return (
              <tr
                key={record.ref}
                className={activeRecordId === record.id ? "active" : ""}
                onClick={() => onActivate(record.id)}
              >
                <td>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      event.stopPropagation();
                      onToggle(record.ref);
                    }}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Select ${record.title}`}
                  />
                </td>
                <td>
                  <strong>{record.title}</strong>
                  <small>{record.summary}</small>
                </td>
                <td>{String(record.fields.company ?? "-")}</td>
                <td>{String(record.fields.location ?? record.fields.region ?? "-")}</td>
                <td>{formatWorkspaceDataKind(record.kind)}</td>
              </tr>
            );
          })
        ) : (
          <tr>
            <td colSpan={5}>No data collected yet.</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function DataDetailsPanel({
  record,
  checked,
  onToggle,
}: {
  record?: WorkspaceDataRecord;
  checked: boolean;
  onToggle: () => void;
}) {
  if (!record) {
    return (
      <aside className="iis-data-details">
        <p>Select a data item to preview details.</p>
      </aside>
    );
  }

  return (
    <aside className="iis-data-details">
      <div className="iis-tabs-flat">
        <button className="active" type="button">Details</button>
        <button type="button">Raw</button>
      </div>
      <h2>{record.title}</h2>
      <p>{String(record.fields.company ?? formatWorkspaceDataKind(record.kind))} · {String(record.fields.location ?? record.fields.region ?? "Project data")}</p>
      <dl>
        <div>
          <dt>Source</dt>
          <dd>{record.url ?? record.sourceId}</dd>
        </div>
        {Object.entries(record.fields).map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{Array.isArray(value) ? value.join(", ") : String(value ?? "-")}</dd>
          </div>
        ))}
      </dl>
      <h3>{record.kind === "job" ? "Job Description" : "Preview"}</h3>
      <p>{record.rawText}</p>
      {record.url && (
        <a className="iis-open-source" href={record.url} target="_blank" rel="noreferrer">
          <ExternalLink size={18} /> Open Source
        </a>
      )}
      <label className="iis-include-check">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
        />
        Include in Report
      </label>
    </aside>
  );
}

function SelectionSummaryBar({
  projectId,
  selectedCount,
  counts,
  saving,
  error,
}: {
  projectId: string;
  selectedCount: number;
  counts: Record<WorkspaceDataKind, number>;
  saving: boolean;
  error: string | null;
}) {
  return (
    <div className="iis-selection-bar">
      <strong>{selectedCount} items selected</strong>
      <div>
        {Object.entries(counts)
          .filter(([, count]) => count > 0)
          .map(([kind, count]) => (
            <span key={kind}>{count} {formatWorkspaceDataKind(kind as WorkspaceDataKind)}</span>
          ))}
        {saving && <span>Saving...</span>}
        {error && <span className="iis-selection-error">{error}</span>}
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

function countSelectedByKind(
  records: WorkspaceDataRecord[],
  selectedRefs: Set<string>,
): Record<WorkspaceDataKind, number> {
  return records.reduce<Record<WorkspaceDataKind, number>>(
    (acc, record) => {
      if (selectedRefs.has(record.ref)) acc[record.kind] += 1;
      return acc;
    },
    { job: 0, news: 0, web_page: 0 },
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DOMPurify from "dompurify";
import { CheckSquare, ExternalLink, FileText, Image, Search, X } from "lucide-react";
import { marked } from "marked";
import type {
  WorkspaceDataKind,
  WorkspaceDataRecord,
  WorkspaceDataView,
} from "@/lib/industry/workspace/client";
import { formatWorkspaceDataKind } from "@/lib/industry/workspace/client";
import { ProjectShell } from "./shell";

type SourceFilter = "job" | "news" | "uploaded";
type SelectionFilter = "all" | "selected";
const JOBS_PAGE_SIZE = 25;
const UPLOADED_KINDS = new Set<WorkspaceDataKind>([
  "sheet_row",
  "pdf_page",
  "markdown",
  "text",
  "json",
  "image",
]);

export function DataWorkspacePage({
  projectId,
  dataView,
}: {
  projectId: string;
  dataView?: WorkspaceDataView;
}) {
  const router = useRouter();
  const initialSourceId: SourceFilter =
    (dataView?.sourceCounts.job ?? 0) > 0
      ? "job"
      : (dataView?.sourceCounts.web_page ?? 0) + (dataView?.sourceCounts.news ?? 0) > 0
        ? "news"
        : "uploaded";
  const [selectedSourceId, setSelectedSourceId] = useState<SourceFilter>(initialSourceId);
  const [activeRecordKey, setActiveRecordKey] = useState<string | undefined>(
    dataView?.records[0] ? getRecordRowKey(dataView.records[0], 0) : undefined,
  );
  const [selectedRefs, setSelectedRefs] = useState<string[]>(
    dataView?.selection.selectedRecordRefs.length
      ? dataView.selection.selectedRecordRefs
      : dataView?.records.map((record) => record.ref) ?? [],
  );
  const [selectionFilter, setSelectionFilter] = useState<SelectionFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedSourceId, searchQuery, selectionFilter, companyFilter, locationFilter]);

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
  const sectionRecords = dataView.records.filter((record) =>
    recordMatchesSection(record, selectedSourceId),
  );
  const filtered = sectionRecords.filter((record) =>
    matchesSearch(record, searchQuery) &&
    matchesFieldFilter(record, "company", companyFilter) &&
    matchesLocationFilter(record, locationFilter) &&
    (selectionFilter === "all" || selectedSet.has(record.ref)),
  );
  const isJobsSection = selectedSourceId === "job";
  const pageCount = isJobsSection
    ? Math.max(1, Math.ceil(filtered.length / JOBS_PAGE_SIZE))
    : 1;
  const boundedPage = Math.min(currentPage, pageCount);
  const pageStart = isJobsSection ? (boundedPage - 1) * JOBS_PAGE_SIZE : 0;
  const pageEnd = isJobsSection ? pageStart + JOBS_PAGE_SIZE : filtered.length;
  const visibleRecords = isJobsSection ? filtered.slice(pageStart, pageEnd) : filtered;
  const activeRecord =
    visibleRecords.find((record, index) => getRecordRowKey(record, index) === activeRecordKey) ??
    visibleRecords[0] ??
    dataView.records[0];
  const sectionCounts = countBySection(dataView.records);
  const selectedCounts = countSelectedBySection(dataView.records, selectedSet);
  const visibleRefs = visibleRecords.map((record) => record.ref);
  const allVisibleSelected =
    visibleRefs.length > 0 && visibleRefs.every((ref) => selectedSet.has(ref));

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

  function toggleVisibleRecords() {
    if (!visibleRefs.length) return;
    const visibleSet = new Set(visibleRefs);
    const next = allVisibleSelected
      ? selectedRefs.filter((ref) => !visibleSet.has(ref))
      : Array.from(new Set([...selectedRefs, ...visibleRefs]));
    void persistSelection(next);
  }

  function clearFilters() {
    setSearchQuery("");
    setSelectionFilter("all");
    setCompanyFilter("");
    setLocationFilter("");
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
          <DataSourceGroup title="External">
            <DataSourceButton
              active={selectedSourceId === "job"}
              label="Jobs"
              count={sectionCounts.job}
              selectedCount={selectedCounts.job}
              icon={<FileText size={16} />}
              onClick={() => setSelectedSourceId("job")}
            />
            <DataSourceButton
              active={selectedSourceId === "news"}
              label="News"
              count={sectionCounts.news}
              selectedCount={selectedCounts.news}
              icon={<FileText size={16} />}
              onClick={() => setSelectedSourceId("news")}
            />
          </DataSourceGroup>
          <DataSourceGroup title="Uploaded">
            <DataSourceButton
              active={selectedSourceId === "uploaded"}
              label="Uploaded Files"
              count={sectionCounts.uploaded}
              selectedCount={selectedCounts.uploaded}
              icon={<Image size={16} />}
              onClick={() => setSelectedSourceId("uploaded")}
            />
          </DataSourceGroup>
        </aside>

        <section className="iis-data-preview">
          <div className="iis-page-header">
            <div>
              <h1>{formatSectionLabel(selectedSourceId)}</h1>
              <p>{formatRecordRangeLabel({
                filteredCount: filtered.length,
                totalCount: sectionRecords.length,
                pageStart,
                visibleCount: visibleRecords.length,
                paginated: isJobsSection,
              })}</p>
            </div>
          </div>
          <div className="iis-data-toolbar">
            <label className="iis-data-search-field">
              <Search size={18} />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search records"
                type="search"
              />
            </label>
            <select
              value={selectionFilter}
              onChange={(event) => setSelectionFilter(event.target.value as SelectionFilter)}
            >
              <option value="all">All</option>
              <option value="selected">Selected</option>
            </select>
            <button
              className="iis-button iis-button-ghost"
              type="button"
              onClick={() => setShowFilters((value) => !value)}
            >
              More Filters
            </button>
            <button
              className="iis-button iis-button-ghost"
              type="button"
              disabled={visibleRefs.length === 0}
              onClick={toggleVisibleRecords}
            >
              <CheckSquare size={18} />
              {allVisibleSelected ? "Clear Visible" : "Select Visible"}
            </button>
          </div>
          {showFilters && (
            <div className="iis-data-filter-panel">
              <label>
                Company
                <input
                  value={companyFilter}
                  onChange={(event) => setCompanyFilter(event.target.value)}
                  placeholder="Any company"
                />
              </label>
              <label>
                Location / Region
                <input
                  value={locationFilter}
                  onChange={(event) => setLocationFilter(event.target.value)}
                  placeholder="Any location"
                />
              </label>
              <button
                className="iis-button iis-button-ghost"
                type="button"
                onClick={clearFilters}
              >
                <X size={18} /> Clear
              </button>
            </div>
          )}
          <StructuredRecordsTable
            section={selectedSourceId}
            records={visibleRecords}
            activeRecordKey={activeRecordKey}
            selectedRefs={selectedSet}
            onActivate={setActiveRecordKey}
            onToggle={toggleRecord}
            onToggleAll={toggleVisibleRecords}
            allVisibleSelected={allVisibleSelected}
          />
          {isJobsSection && filtered.length > JOBS_PAGE_SIZE && (
            <PaginationControls
              page={boundedPage}
              pageCount={pageCount}
              onPageChange={setCurrentPage}
            />
          )}
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

function getRecordRowKey(record: WorkspaceDataRecord, index: number): string {
  return `${record.ref}:${record.createdAt}:${index}`;
}

function StructuredRecordsTable({
  section,
  records,
  activeRecordKey,
  selectedRefs,
  onActivate,
  onToggle,
  onToggleAll,
  allVisibleSelected,
}: {
  section: SourceFilter;
  records: WorkspaceDataRecord[];
  activeRecordKey?: string;
  selectedRefs: Set<string>;
  onActivate: (recordKey: string) => void;
  onToggle: (ref: string) => void;
  onToggleAll: () => void;
  allVisibleSelected: boolean;
}) {
  const isJobs = section === "job";
  const isUploaded = section === "uploaded";
  const tableClassName = isJobs
    ? "iis-data-table"
    : isUploaded
      ? "iis-data-table iis-data-table-uploaded"
      : "iis-data-table iis-data-table-news";

  return (
    <div className="iis-data-table-wrap">
      <table className={tableClassName}>
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                aria-label={allVisibleSelected ? "Clear visible records" : "Select visible records"}
                checked={allVisibleSelected}
                onChange={onToggleAll}
              />
            </th>
            <th>Title</th>
            {isJobs ? (
              <>
                <th>Company</th>
                <th>Location</th>
                <th>Salary</th>
                <th>Experience</th>
                <th>Education</th>
              </>
            ) : isUploaded ? (
              <>
                <th>Type</th>
                <th>File</th>
              </>
            ) : (
              <>
                <th>Source</th>
                <th>Report</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {records.length ? (
            records.map((record, index) => {
              const checked = selectedRefs.has(record.ref);
              const rowKey = getRecordRowKey(record, index);
              return (
                <tr
                  key={rowKey}
                  className={activeRecordKey === rowKey ? "active" : ""}
                  onClick={() => onActivate(rowKey)}
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
                    {!isUploaded && <small>{record.summary}</small>}
                  </td>
                  {isJobs ? (
                    <>
                      <td>{String(record.fields.company ?? "-")}</td>
                      <td>{String(record.fields.location ?? record.fields.region ?? "-")}</td>
                      <td>{String(record.fields.salary ?? "-")}</td>
                      <td>{String(record.fields.experience ?? "-")}</td>
                      <td>{String(record.fields.education ?? "-")}</td>
                    </>
                  ) : isUploaded ? (
                    <>
                      <td>{formatWorkspaceDataKind(record.kind)}</td>
                      <td>{String(record.fields.fileName ?? "-")}</td>
                    </>
                  ) : (
                    <>
                      <td>{formatRecordSource(record)}</td>
                      <td>{formatReportLabel(record.fields.reportPath)}</td>
                    </>
                  )}
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={isJobs ? 7 : 4}>No data collected yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function PaginationControls({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="iis-data-pagination">
      <button
        className="iis-button iis-button-ghost"
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </button>
      <span>Page {page} of {pageCount}</span>
      <button
        className="iis-button iis-button-ghost"
        type="button"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </div>
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
  const [tab, setTab] = useState<"details" | "raw">("details");
  const isMarkdownRecord = Boolean(
    record &&
    (record.sourceId === "tavily" ||
      record.kind === "markdown" ||
      (record.kind === "web_page" && typeof record.fields.reportPath === "string")),
  );
  const markdownHtml = useMemo(() => {
    if (!record || !isMarkdownRecord) return "";
    const html = marked.parse(record.rawText, {
      async: false,
      gfm: true,
      breaks: false,
    }) as string;
    return DOMPurify.sanitize(html);
  }, [isMarkdownRecord, record]);

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
        <button
          className={tab === "details" ? "active" : ""}
          type="button"
          onClick={() => setTab("details")}
        >
          Details
        </button>
        <button
          className={tab === "raw" ? "active" : ""}
          type="button"
          onClick={() => setTab("raw")}
        >
          Raw
        </button>
      </div>
      <h2>{record.title}</h2>
      <p>{formatRecordSubtitle(record)}</p>
      <dl>
        <div>
          <dt>Source</dt>
          <dd>{formatRecordSource(record)}</dd>
        </div>
        {getDetailFields(record).map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{Array.isArray(value) ? value.join(", ") : String(value ?? "-")}</dd>
          </div>
        ))}
      </dl>
      {tab === "details" ? (
        <>
          <h3>{record.kind === "job" ? "Job Description" : "Preview"}</h3>
          {isMarkdownRecord ? (
            <div
              className="iis-markdown-preview"
              dangerouslySetInnerHTML={{ __html: markdownHtml }}
            />
          ) : (
            <p className="iis-record-text">{record.rawText}</p>
          )}
        </>
      ) : (
        <>
          <h3>Raw</h3>
          <pre className="iis-raw-preview">{record.rawText}</pre>
        </>
      )}
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
  counts: Record<SourceFilter, number>;
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
            <span key={kind}>{count} {formatSectionLabel(kind as SourceFilter)}</span>
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

function formatSectionLabel(filter: SourceFilter): string {
  if (filter === "job") return "Jobs";
  if (filter === "news") return "News";
  return "Uploaded Files";
}

function formatRecordRangeLabel({
  filteredCount,
  totalCount,
  pageStart,
  visibleCount,
  paginated,
}: {
  filteredCount: number;
  totalCount: number;
  pageStart: number;
  visibleCount: number;
  paginated: boolean;
}): string {
  if (!paginated || filteredCount === 0) {
    return `${filteredCount} of ${totalCount} records`;
  }
  const first = pageStart + 1;
  const last = pageStart + visibleCount;
  return `${first}-${last} of ${filteredCount} records`;
}

function formatRecordSource(record: WorkspaceDataRecord): string {
  if (record.sourceId === "tavily") return "Tavily Search";
  if (record.sourceId === "liepin") return "Liepin scraper";
  if (isUploadedRecord(record)) return "Uploaded File";
  return record.sourceId || formatWorkspaceDataKind(record.kind);
}

function formatReportLabel(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "-";
  return value.split("/").pop() ?? value;
}

function formatRecordSubtitle(record: WorkspaceDataRecord): string {
  if (record.kind === "job") {
    return `${String(record.fields.company ?? "Job")} · ${String(record.fields.location ?? record.fields.region ?? "Project data")}`;
  }
  if (isUploadedRecord(record)) {
    return `${formatWorkspaceDataKind(record.kind)} · ${String(record.fields.fileName ?? "Uploaded evidence")}`;
  }
  return `${formatRecordSource(record)} · ${String(record.fields.query ?? record.url ?? "Project data")}`;
}

function getDetailFields(record: WorkspaceDataRecord): Array<[string, unknown]> {
  if (record.kind === "job") {
    return Object.entries(record.fields);
  }

  if (isUploadedRecord(record)) {
    const fields: Array<[string, unknown]> = [
      ["Type", formatWorkspaceDataKind(record.kind)],
    ];
    if (record.summary) fields.push(["Summary", record.summary]);
    if (typeof record.fields.fileName === "string") fields.push(["File", record.fields.fileName]);
    if (typeof record.fields.originalPath === "string") fields.push(["Original path", record.fields.originalPath]);
    if (typeof record.fields.parsedPath === "string") fields.push(["Parsed path", record.fields.parsedPath]);
    if (typeof record.fields.sheetName === "string") fields.push(["Sheet", record.fields.sheetName]);
    if (typeof record.fields.page === "number") fields.push(["Page", record.fields.page]);
    return fields;
  }

  const fields: Array<[string, unknown]> = [];
  if (typeof record.fields.query === "string") fields.push(["Query", record.fields.query]);
  if (typeof record.fields.reportPath === "string") {
    fields.push(["Report path", record.fields.reportPath]);
  }
  if (record.url) fields.push(["URL", record.url]);
  return fields;
}

function countBySection(records: WorkspaceDataRecord[]): Record<SourceFilter, number> {
  return records.reduce<Record<SourceFilter, number>>(
    (acc, record) => {
      if (recordMatchesSection(record, "job")) acc.job += 1;
      else if (recordMatchesSection(record, "uploaded")) acc.uploaded += 1;
      else acc.news += 1;
      return acc;
    },
    { job: 0, news: 0, uploaded: 0 },
  );
}

function countSelectedBySection(
  records: WorkspaceDataRecord[],
  selectedRefs: Set<string>,
): Record<SourceFilter, number> {
  return records.reduce<Record<SourceFilter, number>>(
    (acc, record) => {
      if (!selectedRefs.has(record.ref)) return acc;
      if (recordMatchesSection(record, "job")) acc.job += 1;
      else if (recordMatchesSection(record, "uploaded")) acc.uploaded += 1;
      else acc.news += 1;
      return acc;
    },
    { job: 0, news: 0, uploaded: 0 },
  );
}

function recordMatchesSection(record: WorkspaceDataRecord, section: SourceFilter): boolean {
  if (section === "job") return record.kind === "job";
  if (section === "uploaded") return isUploadedRecord(record);
  return record.kind !== "job" && !isUploadedRecord(record);
}

function isUploadedRecord(record: WorkspaceDataRecord): boolean {
  return record.sourceId === "upload" || UPLOADED_KINDS.has(record.kind);
}

function matchesSearch(record: WorkspaceDataRecord, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    record.title,
    record.summary,
    record.rawText,
    record.url,
    ...Object.values(record.fields).flatMap((value) =>
      Array.isArray(value) ? value : [value],
    ),
  ]
    .filter((value): value is string | number | boolean => value !== null && value !== undefined)
    .some((value) => String(value).toLowerCase().includes(normalized));
}

function matchesFieldFilter(
  record: WorkspaceDataRecord,
  field: string,
  value: string,
): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  const fieldValue = record.fields[field];
  return String(fieldValue ?? "").toLowerCase().includes(normalized);
}

function matchesLocationFilter(record: WorkspaceDataRecord, value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  return [
    record.fields.location,
    record.fields.region,
  ].some((fieldValue) => String(fieldValue ?? "").toLowerCase().includes(normalized));
}

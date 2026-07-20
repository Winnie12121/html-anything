import path from "node:path";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  appendJsonl,
  pathExists,
  readJsonFile,
  readJsonlFile,
  removeWorkspacePath,
  writeBinaryFile,
  writeJsonFile,
  writeTextFile,
} from "./fs";
import { configuredWorkspaceRoot } from "./projects";
import { projectPath, toWorkspaceSlug } from "./paths";
import { readWorkspaceData, writeCurrentSelection } from "./data";
import { WORKSPACE_SCHEMA_VERSION } from "./schema";
import type { WorkspaceDataKind, WorkspaceDataRecord } from "./client";

const UPLOAD_RECORDS_PATH = "sources/uploaded/normalized/records.jsonl";
const UPLOAD_FILES_PATH = "sources/uploaded/files.json";

export type WorkspaceUploadedFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  status: "parsing" | "ready" | "failed";
  originalPath: string;
  parsedPath?: string;
  parsedRecordRefs: string[];
  error?: string;
  uploadedAt: string;
};

export type WorkspaceUploadsManifest = {
  version: typeof WORKSPACE_SCHEMA_VERSION;
  files: WorkspaceUploadedFile[];
};

type ParsedUpload = {
  format: string;
  markdown: string;
  records: Array<Omit<WorkspaceDataRecord, "ref" | "sourcePath">>;
};

export async function readWorkspaceUploads(
  projectSlug: string,
  root?: string,
): Promise<WorkspaceUploadsManifest> {
  const workspaceRoot = root ?? (await configuredWorkspaceRoot());
  return readUploadsManifest(workspaceRoot, projectSlug);
}

export async function ingestWorkspaceUpload(
  projectSlug: string,
  file: File,
  root?: string,
): Promise<{ file: WorkspaceUploadedFile; records: WorkspaceDataRecord[] }> {
  const workspaceRoot = root ?? (await configuredWorkspaceRoot());
  const now = new Date().toISOString();
  const fileId = `upload-${Date.now().toString(36)}-${hashString(file.name).slice(0, 6)}`;
  const safeName = safeFilename(file.name);
  const originalPath = `sources/uploaded/original/${fileId}-${safeName}`;
  const parsedPath = `sources/uploaded/parsed/${fileId}.md`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const manifest = await readUploadsManifest(workspaceRoot, projectSlug);
  const parsingFile: WorkspaceUploadedFile = {
    id: fileId,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    status: "parsing",
    originalPath,
    parsedRecordRefs: [],
    uploadedAt: now,
  };

  await writeBinaryFile(workspaceRoot, projectPath(projectSlug, originalPath), bytes);
  await writeUploadsManifest(workspaceRoot, projectSlug, {
    ...manifest,
    files: [parsingFile, ...manifest.files.filter((item) => item.id !== fileId)],
  });

  try {
    const parsed = await parseUploadedBytes({
      id: fileId,
      name: file.name,
      mimeType: file.type,
      bytes,
      createdAt: now,
    });
    const rawRecords = parsed.records.map((record) => ({
      ...record,
      fields: {
        ...record.fields,
        fileId,
        fileName: file.name,
        parsedPath,
        originalPath,
      },
    }));
    const refs = rawRecords.map((record) =>
      `${UPLOAD_RECORDS_PATH}#${record.id}`,
    );
    const readyFile: WorkspaceUploadedFile = {
      ...parsingFile,
      status: "ready",
      parsedPath,
      parsedRecordRefs: refs,
    };

    await writeTextFile(workspaceRoot, projectPath(projectSlug, parsedPath), parsed.markdown);
    await appendJsonl(
      workspaceRoot,
      projectPath(projectSlug, UPLOAD_RECORDS_PATH),
      rawRecords,
    );
    await writeUploadsManifest(workspaceRoot, projectSlug, {
      version: WORKSPACE_SCHEMA_VERSION,
      files: [readyFile, ...manifest.files.filter((item) => item.id !== fileId)],
    });
    const view = await readWorkspaceData(projectSlug, workspaceRoot);
    await writeCurrentSelection(
      projectSlug,
      Array.from(new Set([...view.selection.selectedRecordRefs, ...refs])),
      workspaceRoot,
    );

    return {
      file: readyFile,
      records: rawRecords.map((record) => ({
        ...record,
        ref: `${UPLOAD_RECORDS_PATH}#${record.id}`,
        sourcePath: UPLOAD_RECORDS_PATH,
      })),
    };
  } catch (error) {
    const failedFile: WorkspaceUploadedFile = {
      ...parsingFile,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
    await writeUploadsManifest(workspaceRoot, projectSlug, {
      version: WORKSPACE_SCHEMA_VERSION,
      files: [failedFile, ...manifest.files.filter((item) => item.id !== fileId)],
    });
    throw error;
  }
}

export async function deleteWorkspaceUpload(
  projectSlug: string,
  fileId: string,
  root?: string,
): Promise<WorkspaceUploadsManifest> {
  const workspaceRoot = root ?? (await configuredWorkspaceRoot());
  const manifest = await readUploadsManifest(workspaceRoot, projectSlug);
  const file = manifest.files.find((item) => item.id === fileId);
  if (!file) {
    throw Object.assign(new Error(`Upload not found: ${fileId}`), { code: "ENOENT" });
  }
  const records = await readUploadedRawRecords(workspaceRoot, projectSlug);
  const nextRecords = records.filter((record) => record.fields?.fileId !== fileId);
  const removedRefs = new Set(file.parsedRecordRefs);
  const dataView = await readWorkspaceData(projectSlug, workspaceRoot);
  const nextSelection = dataView.selection.selectedRecordRefs.filter((ref) => !removedRefs.has(ref));

  await writeTextFile(
    workspaceRoot,
    projectPath(projectSlug, UPLOAD_RECORDS_PATH),
    nextRecords.map((record) => JSON.stringify(record)).join("\n") +
      (nextRecords.length ? "\n" : ""),
  );
  await writeCurrentSelection(projectSlug, nextSelection, workspaceRoot);
  await removeWorkspacePath(workspaceRoot, projectPath(projectSlug, file.originalPath));
  if (file.parsedPath) {
    await removeWorkspacePath(workspaceRoot, projectPath(projectSlug, file.parsedPath));
  }

  const nextManifest: WorkspaceUploadsManifest = {
    version: WORKSPACE_SCHEMA_VERSION,
    files: manifest.files.filter((item) => item.id !== fileId),
  };
  await writeUploadsManifest(workspaceRoot, projectSlug, nextManifest);
  return nextManifest;
}

async function parseUploadedBytes(input: {
  id: string;
  name: string;
  mimeType: string;
  bytes: Uint8Array;
  createdAt: string;
}): Promise<ParsedUpload> {
  const extension = fileExtension(input.name);
  if (["xlsx", "xls", "xlsm", "ods"].includes(extension)) {
    return parseWorkbookUpload(input);
  }
  if (extension === "csv" || extension === "tsv" || input.mimeType.includes("csv")) {
    return parseDelimitedUpload(input, extension === "tsv" ? "\t" : ",");
  }
  if (extension === "pdf" || input.mimeType === "application/pdf") {
    return parsePdfUpload(input);
  }
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(extension)) {
    return parseImageUpload(input);
  }
  const text = new TextDecoder().decode(input.bytes);
  if (extension === "json" || input.mimeType.includes("json")) {
    return parseJsonUpload(input, text);
  }
  const kind: WorkspaceDataKind = extension === "md" || extension === "markdown" ? "markdown" : "text";
  const markdown = [
    `# Uploaded File: ${input.name}`,
    "",
    `Format: ${kind}`,
    "",
    text,
  ].join("\n");
  return {
    format: kind,
    markdown,
    records: [makeDocumentRecord(input, kind, input.name, summarizeText(text), text)],
  };
}

function parseDelimitedUpload(
  input: { id: string; name: string; bytes: Uint8Array; createdAt: string },
  delimiter: "," | "\t",
): ParsedUpload {
  const text = new TextDecoder().decode(input.bytes).replace(/^\uFEFF/, "");
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter,
    dynamicTyping: true,
  });
  const rows = result.data;
  const fields = result.meta.fields ?? [];
  const markdown = [
    `# Uploaded Table: ${input.name}`,
    "",
    `Rows: ${rows.length}`,
    `Fields: ${fields.join(", ")}`,
    "",
    "## Sample Rows",
    "",
    "```json",
    JSON.stringify(rows.slice(0, 20), null, 2),
    "```",
  ].join("\n");
  return {
    format: delimiter === "\t" ? "tsv" : "csv",
    markdown,
    records: rows.map((row, index) => makeRowRecord(input, row, index)),
  };
}

function parseWorkbookUpload(input: {
  id: string;
  name: string;
  bytes: Uint8Array;
  createdAt: string;
}): ParsedUpload {
  const workbook = XLSX.read(input.bytes, { type: "array" });
  const records: Array<Omit<WorkspaceDataRecord, "ref" | "sourcePath">> = [];
  const markdown: string[] = [`# Uploaded Workbook: ${input.name}`];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    markdown.push("", `## Sheet: ${sheetName}`, "", `Rows: ${rows.length}`, "", "```json", JSON.stringify(rows.slice(0, 20), null, 2), "```");
    rows.forEach((row, index) => records.push(makeRowRecord(input, row, index, sheetName)));
  }
  return { format: "xlsx", markdown: markdown.join("\n"), records };
}

async function parsePdfUpload(input: {
  id: string;
  name: string;
  mimeType: string;
  bytes: Uint8Array;
  createdAt: string;
}): Promise<ParsedUpload> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(input.bytes);
  try {
    const { totalPages, text } = await extractText(pdf, { mergePages: false });
    const pages = Array.from({ length: Math.max(totalPages, text.length) }, (_, index) =>
      (text[index] ?? "").trim(),
    );
    const markdown = [
      `# Uploaded PDF: ${input.name}`,
      "",
      `Pages: ${pages.length}`,
      ...pages.flatMap((page, index) => ["", `## Page ${index + 1}`, "", page || "_No extractable text on this page._"]),
    ].join("\n");
    return {
      format: "pdf",
      markdown,
      records: pages.map((page, index) => ({
        id: `${input.id}-page-${index + 1}`,
        sourceId: "upload",
        kind: "pdf_page",
        title: `${input.name} - Page ${index + 1}`,
        summary: summarizeText(page || "No extractable text on this page."),
        fields: { page: index + 1, totalPages: pages.length },
        rawText: page || "No extractable text on this page.",
        createdAt: input.createdAt,
      })),
    };
  } finally {
    await pdf.destroy?.();
  }
}

function parseImageUpload(input: {
  id: string;
  name: string;
  mimeType: string;
  bytes: Uint8Array;
  createdAt: string;
}): ParsedUpload {
  const rawText = `Image uploaded: ${input.name}\nMIME type: ${input.mimeType || "unknown"}\nSize: ${input.bytes.byteLength} bytes`;
  return {
    format: "image",
    markdown: `# Uploaded Image: ${input.name}\n\n${rawText}`,
    records: [makeDocumentRecord(input, "image", input.name, "Uploaded image file.", rawText)],
  };
}

function parseJsonUpload(
  input: { id: string; name: string; createdAt: string },
  text: string,
): ParsedUpload {
  const parsed = JSON.parse(text);
  const values = Array.isArray(parsed) ? parsed : [parsed];
  const markdown = [
    `# Uploaded JSON: ${input.name}`,
    "",
    `Records: ${values.length}`,
    "",
    "```json",
    JSON.stringify(parsed, null, 2).slice(0, 20_000),
    "```",
  ].join("\n");
  return {
    format: "json",
    markdown,
    records: values.map((value, index) =>
      makeDocumentRecord(
        input,
        "json",
        `${input.name} item ${index + 1}`,
        summarizeText(JSON.stringify(value)),
        JSON.stringify(value, null, 2),
        { index: index + 1 },
      ),
    ),
  };
}

function makeRowRecord(
  input: { id: string; name: string; createdAt: string },
  row: Record<string, unknown>,
  index: number,
  sheetName?: string,
): Omit<WorkspaceDataRecord, "ref" | "sourcePath"> {
  const rowText = JSON.stringify(row, null, 2);
  return {
    id: `${input.id}-row-${sheetName ? `${toWorkspaceSlug(sheetName)}-` : ""}${index + 1}`,
    sourceId: "upload",
    kind: "sheet_row",
    title: `${input.name}${sheetName ? ` / ${sheetName}` : ""} row ${index + 1}`,
    summary: summarizeRow(row),
    fields: {
      rowNumber: index + 1,
      ...(sheetName ? { sheetName } : {}),
      ...normalizeFields(row),
    },
    rawText: rowText,
    createdAt: input.createdAt,
  };
}

function makeDocumentRecord(
  input: { id: string; name: string; createdAt: string },
  kind: WorkspaceDataKind,
  title: string,
  summary: string,
  rawText: string,
  fields: Record<string, string | number | boolean | string[] | null> = {},
): Omit<WorkspaceDataRecord, "ref" | "sourcePath"> {
  return {
    id: `${input.id}-${kind}`,
    sourceId: "upload",
    kind,
    title,
    summary,
    fields,
    rawText,
    createdAt: input.createdAt,
  };
}

async function readUploadsManifest(root: string, projectSlug: string): Promise<WorkspaceUploadsManifest> {
  try {
    return await readJsonFile<WorkspaceUploadsManifest>(
      root,
      projectPath(projectSlug, UPLOAD_FILES_PATH),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return { version: WORKSPACE_SCHEMA_VERSION, files: [] };
  }
}

async function writeUploadsManifest(
  root: string,
  projectSlug: string,
  manifest: WorkspaceUploadsManifest,
) {
  await writeJsonFile(root, projectPath(projectSlug, UPLOAD_FILES_PATH), manifest);
}

async function readUploadedRawRecords(
  root: string,
  projectSlug: string,
): Promise<Array<Omit<WorkspaceDataRecord, "ref" | "sourcePath">>> {
  if (!(await pathExists(path.join(root, projectPath(projectSlug, UPLOAD_RECORDS_PATH))))) {
    return [];
  }
  return readJsonlFile(root, projectPath(projectSlug, UPLOAD_RECORDS_PATH));
}

function normalizeFields(row: Record<string, unknown>): Record<string, string | number | boolean | string[] | null> {
  const fields: Record<string, string | number | boolean | string[] | null> = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      fields[key] = value;
    } else if (Array.isArray(value)) {
      fields[key] = value.map((item) => String(item));
    } else if (value !== undefined) {
      fields[key] = JSON.stringify(value);
    }
  }
  return fields;
}

function summarizeRow(row: Record<string, unknown>): string {
  return Object.entries(row)
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${String(value ?? "-")}`)
    .join(" · ") || "Uploaded table row";
}

function summarizeText(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "No text extracted.";
  return normalized.length > 220 ? `${normalized.slice(0, 220).trim()}...` : normalized;
}

function fileExtension(name: string): string {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index + 1).toLowerCase() : "";
}

function safeFilename(name: string): string {
  const ext = fileExtension(name);
  const base = toWorkspaceSlug(name.replace(/\.[^.]+$/, ""));
  return `${base || "upload"}${ext ? `.${ext}` : ""}`;
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(i) | 0;
  }
  return Math.abs(hash).toString(16);
}

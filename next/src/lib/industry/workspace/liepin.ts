import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";
import type { WorkspaceDataRecord } from "./client";

type LiepinCsvRow = {
  job_title?: string;
  company_name?: string;
  salary?: string;
  location?: string;
  experience?: string;
  education?: string;
  job_url?: string;
  post_date?: string;
  company_tags?: string;
  keyword?: string;
  search_keyword?: string;
  target_company?: string;
  crawl_time?: string;
};

export type LiepinJobRecord = Omit<WorkspaceDataRecord, "ref" | "sourcePath">;

export async function readLiepinSampleRecords(
  createdAt = new Date().toISOString(),
): Promise<LiepinJobRecord[]> {
  const csv = await readFile(resolveLiepinSampleCsvPath(), "utf8");
  return parseLiepinCsv(csv, createdAt);
}

export function parseLiepinCsv(
  csv: string,
  fallbackCreatedAt: string,
): LiepinJobRecord[] {
  const parsed = Papa.parse<LiepinCsvRow>(csv.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
  });

  if (parsed.errors.length) {
    const first = parsed.errors[0];
    throw new Error(`Failed to parse Liepin CSV: ${first?.message ?? "unknown error"}`);
  }

  return parsed.data
    .filter((row) => row.job_title?.trim() || row.company_name?.trim())
    .map((row, index) => liepinRowToRecord(row, index, fallbackCreatedAt));
}

function liepinRowToRecord(
  row: LiepinCsvRow,
  index: number,
  fallbackCreatedAt: string,
): LiepinJobRecord {
  const title = clean(row.job_title) || "Untitled Liepin role";
  const company = clean(row.company_name) || "Unknown company";
  const location = clean(row.location);
  const salary = clean(row.salary);
  const experience = clean(row.experience);
  const education = clean(row.education);
  const companyTags = clean(row.company_tags);
  const keyword = clean(row.keyword) || clean(row.search_keyword) || clean(row.target_company);
  const postDate = clean(row.post_date);
  const crawlTime = clean(row.crawl_time);
  const url = clean(row.job_url);
  const createdAt = parseLiepinTimestamp(crawlTime) ?? fallbackCreatedAt;

  return {
    id: stableLiepinId(row, index),
    sourceId: "liepin",
    kind: "job",
    title,
    summary: [
      company,
      location,
      salary,
      experience,
      education,
    ].filter(Boolean).join(" · "),
    fields: {
      company,
      location,
      salary,
      experience,
      education,
      postDate,
      companyTags,
      keyword,
      crawlTime,
    },
    rawText: [
      title,
      `${company}${location ? ` - ${location}` : ""}`,
      salary ? `Salary: ${salary}` : "",
      experience ? `Experience: ${experience}` : "",
      education ? `Education: ${education}` : "",
      companyTags ? `Company tags: ${companyTags}` : "",
      postDate ? `Liepin status: ${postDate}` : "",
      keyword ? `Keyword: ${keyword}` : "",
      crawlTime ? `Crawled at: ${crawlTime}` : "",
    ].filter(Boolean).join("\n"),
    url: url || undefined,
    createdAt,
  };
}

function stableLiepinId(row: LiepinCsvRow, index: number): string {
  const hash = createHash("sha1")
    .update([
      row.company_name ?? "",
      row.job_title ?? "",
      row.location ?? "",
      row.salary ?? "",
      row.crawl_time ?? "",
      String(index),
    ].join("|"))
    .digest("hex")
    .slice(0, 12);
  return `liepin-${hash}`;
}

function parseLiepinTimestamp(value: string): string | undefined {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second] = match;
  return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`).toISOString();
}

function clean(value: string | undefined): string {
  return value?.trim() ?? "";
}

function resolveLiepinSampleCsvPath(): string {
  const relative = path.join(
    "src",
    "lib",
    "industry",
    "workspace",
    "fixtures",
    "liepin",
    "test_single_page.csv",
  );
  if (process.cwd().endsWith(`${path.sep}next`)) {
    return path.join(process.cwd(), relative);
  }
  return path.join(process.cwd(), "next", relative);
}

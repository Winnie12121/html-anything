import type { DataItem, SuggestedInsight } from "./types";

function groupCount(items: DataItem[], field: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const value = item.fields[field];
    if (typeof value === "string" && value.trim()) {
      counts[value] = (counts[value] ?? 0) + 1;
    }
  }
  return counts;
}

function topEntries(counts: Record<string, number>, limit = 5) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));
}

export function suggestInsights(items: DataItem[]): SuggestedInsight[] {
  const selectedIds = items.map((item) => item.id);
  const jobs = items.filter((item) => item.kind === "job");
  const news = items.filter((item) => item.kind === "news");
  const byCompany = topEntries(groupCount(jobs, "company"));
  const byLocation = topEntries(groupCount(jobs, "location"));
  const byFunction = topEntries(groupCount(jobs, "function"));

  const insights: SuggestedInsight[] = [];
  if (jobs.length > 0) {
    insights.push({
      id: "metric-job-volume",
      type: "metric",
      title: "Hiring volume and company coverage",
      rationale: "Selected job records can support headline hiring metrics.",
      dataItemIds: jobs.map((item) => item.id),
      config: {
        jobs: jobs.length,
        companies: new Set(jobs.map((item) => item.fields.company)).size,
      },
      included: true,
    });
  }
  if (byCompany.length > 0) {
    insights.push({
      id: "chart-company-comparison",
      type: "chart",
      title: "Hiring activity by company",
      rationale: "Company-level counts reveal which competitors are most active.",
      dataItemIds: jobs.map((item) => item.id),
      config: { chart: "bar", values: byCompany },
      included: true,
    });
  }
  if (byFunction.length > 0) {
    insights.push({
      id: "table-function-demand",
      type: "table",
      title: "Role function demand",
      rationale: "Grouped role functions clarify talent demand patterns.",
      dataItemIds: jobs.map((item) => item.id),
      config: { columns: ["Function", "Records"], values: byFunction },
      included: true,
    });
  }
  if (byLocation.length > 0) {
    insights.push({
      id: "chart-location-distribution",
      type: "chart",
      title: "Geographic distribution",
      rationale: "Location spread helps identify market concentration.",
      dataItemIds: jobs.map((item) => item.id),
      config: { chart: "bar", values: byLocation },
      included: true,
    });
  }
  if (news.length > 0) {
    insights.push({
      id: "narrative-market-signals",
      type: "narrative",
      title: "Market signals from collected news",
      rationale: "News records add context around company moves and demand signals.",
      dataItemIds: news.map((item) => item.id),
      config: { records: news.length },
      included: true,
    });
  }
  if (insights.length === 0 && items.length > 0) {
    insights.push({
      id: "narrative-selected-evidence",
      type: "narrative",
      title: "Evidence summary",
      rationale: "Selected files and records can anchor the report narrative.",
      dataItemIds: selectedIds,
      config: { records: items.length },
      included: true,
    });
  }
  return insights;
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, FileText, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import type { WorkspaceReportSetupView } from "@/lib/industry/workspace/client";
import { formatWorkspaceDataKind } from "@/lib/industry/workspace/client";
import { PageHeader, ProjectShell } from "./shell";

const TEMPLATES = [
  { id: "competitor-hiring-comparison", label: "Competitor Hiring Comparison" },
  { id: "executive-industry-brief", label: "Executive Industry Brief" },
  { id: "talent-market-dashboard", label: "Talent Market Dashboard" },
];

export function ReportSetupPage({
  projectId,
  setupView,
}: {
  projectId: string;
  setupView: WorkspaceReportSetupView;
}) {
  const router = useRouter();
  const selectedAgentId = useStore((s) => s.selectedAgent);
  const agents = useStore((s) => s.agents);
  const agentModels = useStore((s) => s.agentModels);
  const agentBinOverrides = useStore((s) => s.agentBinOverrides);
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);
  const selectedModel = selectedAgentId ? agentModels[selectedAgentId] ?? "default" : "default";
  const selectedBinOverride = selectedAgentId
    ? agentBinOverrides[selectedAgentId]?.trim() || undefined
    : undefined;
  const [templateId, setTemplateId] = useState(TEMPLATES[0]!.id);
  const [name, setName] = useState(defaultReportName(setupView.project.name));
  const [audience, setAudience] = useState("HR leadership");
  const [language, setLanguage] = useState("English");
  const [goal, setGoal] = useState(
    "Compare competitor hiring activity, role demand, and market signals.",
  );
  const [included, setIncluded] = useState(
    () => new Set(setupView.suggestedInsights.filter((i) => i.included).map((i) => i.id)),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedCounts = setupView.selectedCounts;
  const selectedSummary = useMemo(
    () =>
      (["job", "news", "web_page"] as const)
        .map((kind) => ({
          kind,
          label: formatWorkspaceDataKind(kind),
          count: selectedCounts[kind] ?? 0,
        }))
        .filter((item) => item.count > 0),
    [selectedCounts],
  );

  async function generateReport() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/reports/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          templateId,
          audience,
          language,
          goal,
          includedInsightIds: Array.from(included),
          ...(selectedAgent && !selectedAgent.unsupported ? { agent: selectedAgent.id } : {}),
          ...(selectedModel !== "default" ? { model: selectedModel } : {}),
          ...(selectedBinOverride ? { binOverride: selectedBinOverride } : {}),
        }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to generate report");
      router.push(`/projects/${projectId}/reports`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ProjectShell
      projectId={projectId}
      projectName={setupView.project.name}
      counts={setupView.counts}
      section="Report Setup"
    >
      <PageHeader
        title="Report Setup"
        description="Configure the HTML insight report and choose suggested insights to include."
      />

      <div className="iis-setup-grid">
        <section className="iis-card iis-setup-form">
          <h2>Report Details</h2>
          <label>
            Template
            <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
              {TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Report name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <div className="iis-two-cols">
            <label>
              Audience
              <input value={audience} onChange={(event) => setAudience(event.target.value)} />
            </label>
            <label>
              Language
              <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                <option>English</option>
                <option>Chinese</option>
              </select>
            </label>
          </div>
          <label>
            Goal
            <textarea value={goal} onChange={(event) => setGoal(event.target.value)} />
          </label>
          <p className="iis-generation-note">
            Generation uses the top-bar CLI connection:
            {" "}
            <strong>{selectedAgent && !selectedAgent.unsupported ? selectedAgent.label : "Local draft fallback"}</strong>
            {selectedAgent && selectedModel !== "default" && <span> · {selectedModel}</span>}
          </p>
          {error && <p className="iis-form-error">{error}</p>}
          <button
            className="iis-button iis-button-primary"
            type="button"
            disabled={submitting || setupView.selectedRecords.length === 0}
            onClick={() => void generateReport()}
          >
            <Sparkles size={18} /> {submitting ? "Generating..." : selectedAgent ? "Generate with CLI" : "Generate Local Draft"}
          </button>
        </section>

        <section className="iis-card iis-selection-review">
          <h2>Selected Data</h2>
          <strong>{setupView.selectedRecords.length} records selected</strong>
          <div className="iis-selection-kinds">
            {selectedSummary.length ? (
              selectedSummary.map((item) => (
                <span key={item.kind}>
                  {item.count} {item.label}
                </span>
              ))
            ) : (
              <span>No selected records yet</span>
            )}
          </div>
          <div className="iis-selected-list">
            {setupView.selectedRecords.slice(0, 8).map((record) => (
              <p key={record.ref}>
                <FileText size={16} /> {record.title}
              </p>
            ))}
          </div>
        </section>

        <section className="iis-card iis-insights">
          <h2>Suggested Insights</h2>
          {setupView.suggestedInsights.length ? (
            setupView.suggestedInsights.map((insight) => (
              <label key={insight.id} className="iis-insight-row">
                <input
                  type="checkbox"
                  checked={included.has(insight.id)}
                  onChange={() =>
                    setIncluded((prev) => {
                      const next = new Set(prev);
                      if (next.has(insight.id)) next.delete(insight.id);
                      else next.add(insight.id);
                      return next;
                    })
                  }
                />
                <BarChart3 size={20} />
                <span>
                  <strong>{insight.title}</strong>
                  <small>{insight.rationale}</small>
                </span>
              </label>
            ))
          ) : (
            <p className="iis-empty-note">Select records in Data before generating a report.</p>
          )}
        </section>
      </div>
    </ProjectShell>
  );
}

function defaultReportName(projectName: string): string {
  if (projectName.toLowerCase().includes("automotive")) {
    return "China Automotive Hiring Comparison";
  }
  return `${projectName} Insight Report`;
}

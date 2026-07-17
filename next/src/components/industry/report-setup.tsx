"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, FileText, Sparkles } from "lucide-react";
import { suggestInsights } from "@/lib/industry/insights";
import { formatKindLabel } from "@/lib/industry/selection";
import { getProjectSelection, useIndustryStore } from "@/lib/industry/store";
import { PageHeader, ProjectShell } from "./shell";

const TEMPLATES = [
  { id: "competitor-hiring-comparison", label: "Competitor Hiring Comparison" },
  { id: "executive-industry-brief", label: "Executive Industry Brief" },
  { id: "talent-market-dashboard", label: "Talent Market Dashboard" },
];

export function ReportSetupPage({ projectId }: { projectId: string }) {
  const router = useRouter();
  const state = useIndustryStore((s) => s);
  const createReport = useIndustryStore((s) => s.createReport);
  const selection = getProjectSelection(state, projectId);
  const selectedItems = state.dataItems.filter((item) => selection.selectedItemIds.includes(item.id));
  const insights = useMemo(() => suggestInsights(selectedItems), [selectedItems]);
  const [templateId, setTemplateId] = useState(TEMPLATES[0]!.id);
  const [name, setName] = useState("China Automotive Hiring Comparison");
  const [audience, setAudience] = useState("HR leadership");
  const [language, setLanguage] = useState("English");
  const [goal, setGoal] = useState("Compare competitor hiring activity, role demand, and market signals.");
  const [included, setIncluded] = useState(() => new Set(insights.filter((i) => i.included).map((i) => i.id)));

  return (
    <ProjectShell projectId={projectId} section="Report Setup">
      <PageHeader
        title="Report Setup"
        description="Configure the HTML insight report and choose suggested insights to include."
      />
      <div className="grid grid-cols-[minmax(420px,0.95fr)_minmax(320px,0.75fr)] gap-5">
        <section className="grid gap-4 rounded-lg border border-[var(--iis-border)] bg-white p-6">
          <h2 className="m-0 text-[17px] font-semibold">Report Details</h2>
          <label className="grid gap-2 text-[12px] font-bold uppercase tracking-wide text-[var(--iis-muted)]">
            Template
            <select
              className="h-10 rounded-md border border-[var(--iis-border)] bg-white px-3 text-[14px] font-medium normal-case tracking-normal text-[var(--iis-text)]"
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
            >
              {TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>{template.label}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-[12px] font-bold uppercase tracking-wide text-[var(--iis-muted)]">
            Report name
            <input
              className="h-10 rounded-md border border-[var(--iis-border)] bg-white px-3 text-[14px] font-medium normal-case tracking-normal text-[var(--iis-text)]"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="grid gap-2 text-[12px] font-bold uppercase tracking-wide text-[var(--iis-muted)]">
              Audience
              <input
                className="h-10 rounded-md border border-[var(--iis-border)] bg-white px-3 text-[14px] font-medium normal-case tracking-normal text-[var(--iis-text)]"
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-[12px] font-bold uppercase tracking-wide text-[var(--iis-muted)]">
              Language
              <select
                className="h-10 rounded-md border border-[var(--iis-border)] bg-white px-3 text-[14px] font-medium normal-case tracking-normal text-[var(--iis-text)]"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
              >
                <option>English</option>
                <option>Chinese</option>
              </select>
            </label>
          </div>
          <label className="grid gap-2 text-[12px] font-bold uppercase tracking-wide text-[var(--iis-muted)]">
            Goal
            <textarea
              className="min-h-[96px] resize-y rounded-md border border-[var(--iis-border)] bg-white px-3 py-2 text-[14px] font-medium normal-case leading-relaxed tracking-normal text-[var(--iis-text)]"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
            />
          </label>
          <button
            className="iis-button iis-button-primary"
            type="button"
            onClick={() => {
              const reportId = createReport({
                projectId,
                name,
                templateId,
                audience,
                language,
                goal,
                selectedItemIds: selection.selectedItemIds,
                insightIds: Array.from(included),
              });
              router.push(`/projects/${projectId}/reports/${reportId}/studio`);
            }}
          >
            <Sparkles size={18} /> Generate HTML Report
          </button>
        </section>

        <section className="grid content-start gap-4 rounded-lg border border-[var(--iis-border)] bg-white p-6">
          <h2 className="m-0 text-[17px] font-semibold">Selected Data</h2>
          <strong className="text-[24px] leading-none">{selectedItems.length} records selected</strong>
          <div className="flex flex-wrap gap-2 text-[13px] text-[var(--iis-muted)]">
            {Object.entries(selection.countsByKind).map(([kind, count]) => (
              <span key={kind}>{count} {formatKindLabel(kind as never)}</span>
            ))}
          </div>
          <div className="grid gap-2">
            {selectedItems.slice(0, 8).map((item) => (
              <p key={item.id} className="m-0 flex items-center gap-2 text-[13px] text-[var(--iis-muted)]"><FileText size={16} /> {item.title}</p>
            ))}
          </div>
        </section>

        <section className="col-span-2 grid gap-3 rounded-lg border border-[var(--iis-border)] bg-white p-6">
          <h2 className="m-0 text-[17px] font-semibold">Suggested Insights</h2>
          {insights.map((insight) => (
            <label key={insight.id} className="flex items-center gap-3 rounded-lg border border-[var(--iis-border)] p-4">
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
              <span className="grid gap-1">
                <strong className="text-[14px]">{insight.title}</strong>
                <small className="text-[12px] text-[var(--iis-muted)]">{insight.rationale}</small>
              </span>
            </label>
          ))}
        </section>
      </div>
    </ProjectShell>
  );
}

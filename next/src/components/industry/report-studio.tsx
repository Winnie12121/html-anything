"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Code2,
  Download,
  FileText,
  MessageSquare,
  Save,
  Trash2,
} from "lucide-react";
import { previewHtml } from "@/lib/extract-html";
import { useIndustryStore } from "@/lib/industry/store";
import { AppTopBar, ProjectSidebar } from "./shell";

export function ReportStudioPage({
  projectId,
  reportId,
}: {
  projectId: string;
  reportId: string;
}) {
  const report = useIndustryStore((s) => s.reports.find((r) => r.id === reportId));
  const setActiveSection = useIndustryStore((s) => s.setActiveReportSection);
  const activeSectionId = useIndustryStore((s) => s.activeReportSectionId);
  const [leftTab, setLeftTab] = useState<"outline" | "sources" | "charts">("outline");
  const [rightTab, setRightTab] = useState<"edit" | "comment" | "refine">("edit");
  const [previewMode, setPreviewMode] = useState<"preview" | "html">("preview");

  const activeSection = useMemo(() => {
    if (!report) return undefined;
    return report.sections.find((section) => section.id === activeSectionId) ?? report.sections[0];
  }, [activeSectionId, report]);

  if (!report) {
    return (
      <main className="iis-app">
        <AppTopBar projectId={projectId} section="Report Studio" />
        <div className="iis-missing">
          <h1>Report not found</h1>
          <Link className="iis-button iis-button-primary" href={`/projects/${projectId}/reports`}>
            Back to reports
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="iis-app">
      <AppTopBar projectId={projectId} section="Report Studio" />
      <div className="iis-studio-frame">
        <ProjectSidebar projectId={projectId} />
        <aside className="iis-studio-left">
          <div className="iis-tabs-flat">
            {(["outline", "sources", "charts"] as const).map((tab) => (
              <button key={tab} className={leftTab === tab ? "active" : ""} onClick={() => setLeftTab(tab)} type="button">
                {tab[0]!.toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          {leftTab === "outline" && (
            <div className="iis-outline">
              {report.sections
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((section) => (
                  <button
                    key={section.id}
                    className={activeSection?.id === section.id ? "active" : ""}
                    onClick={() => setActiveSection(section.id)}
                    type="button"
                  >
                    <span>::</span>
                    {section.title}
                    {section.comments.some((c) => !c.resolved) && <em><MessageSquare size={15} /> {section.comments.filter((c) => !c.resolved).length}</em>}
                  </button>
                ))}
            </div>
          )}
          {leftTab === "sources" && <StudioSources reportId={reportId} />}
          {leftTab === "charts" && <StudioCharts />}
        </aside>

        <section className="iis-studio-preview">
          <div className="iis-studio-preview-toolbar">
            <div className="iis-tabs-flat">
              <button className={previewMode === "preview" ? "active" : ""} onClick={() => setPreviewMode("preview")} type="button">
                <FileText size={17} /> Edit
              </button>
              <button className={previewMode === "html" ? "active" : ""} onClick={() => setPreviewMode("html")} type="button">
                <Code2 size={17} /> HTML
              </button>
            </div>
            <button className="iis-button iis-button-muted" type="button">Claude Code</button>
          </div>
          {previewMode === "preview" ? (
            <iframe title={report.name} srcDoc={previewHtml(report.html)} className="iis-report-iframe" />
          ) : (
            <HtmlEditor reportId={report.id} html={report.html} />
          )}
        </section>

        <aside className="iis-studio-right">
          <div className="iis-tabs-flat">
            {(["edit", "comment", "refine"] as const).map((tab) => (
              <button key={tab} className={rightTab === tab ? "active" : ""} onClick={() => setRightTab(tab)} type="button">
                {tab[0]!.toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          {activeSection && rightTab === "edit" && (
            <SectionEditPanel reportId={report.id} sectionId={activeSection.id} />
          )}
          {activeSection && rightTab === "comment" && (
            <CommentPanel reportId={report.id} sectionId={activeSection.id} />
          )}
          {activeSection && rightTab === "refine" && (
            <RefinePanel reportId={report.id} sectionId={activeSection.id} />
          )}
        </aside>
      </div>
      <div className="iis-studio-footer">
        <span>Saved 1 min ago</span>
        <button className="iis-button iis-button-ghost" type="button">Snapshot</button>
        <button
          className="iis-button iis-button-primary"
          type="button"
          onClick={() => {
            const blob = new Blob([report.html], { type: "text/html" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${report.name.replace(/\W+/g, "-").toLowerCase() || "report"}.html`;
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download size={18} /> Export HTML
        </button>
      </div>
    </main>
  );
}

function StudioSources({ reportId }: { reportId: string }) {
  const report = useIndustryStore((s) => s.reports.find((r) => r.id === reportId));
  const allItems = useIndustryStore((s) => s.dataItems);
  const items = useMemo(
    () => allItems.filter((item) => report?.selectedItemIds.includes(item.id)),
    [allItems, report],
  );
  return (
    <div className="iis-studio-list">
      {items.map((item) => (
        <p key={item.id}><FileText size={16} /> {item.title}</p>
      ))}
    </div>
  );
}

function StudioCharts() {
  return (
    <div className="iis-studio-list">
      <p>Hiring activity by company</p>
      <p>Top skills in demand</p>
      <p>Geographic distribution</p>
    </div>
  );
}

function HtmlEditor({ reportId, html }: { reportId: string; html: string }) {
  const setReportHtml = useIndustryStore((s) => s.setReportHtml);
  return (
    <textarea
      className="iis-html-editor"
      value={html}
      onChange={(event) => setReportHtml(reportId, event.target.value)}
      spellCheck={false}
    />
  );
}

function SectionEditPanel({ reportId, sectionId }: { reportId: string; sectionId: string }) {
  const report = useIndustryStore((s) => s.reports.find((r) => r.id === reportId));
  const update = useIndustryStore((s) => s.updateReportSection);
  const move = useIndustryStore((s) => s.moveReportSection);
  const remove = useIndustryStore((s) => s.deleteReportSection);
  const section = report?.sections.find((s) => s.id === sectionId);
  if (!section) return null;
  return (
    <div className="iis-panel-stack">
      <h2>{section.title}</h2>
      <p>Click directly in the report to edit text inline. Changes auto-save on blur.</p>
      <div className="iis-format-box">
        <strong>Formatting</strong>
        <div>
          <button type="button">B</button>
          <button type="button"><i>I</i></button>
          <button type="button">↗</button>
          <button type="button">≡</button>
        </div>
      </div>
      <label>
        Section Content
        <textarea value={section.html} onChange={(event) => update(reportId, sectionId, event.target.value)} />
      </label>
      <div className="iis-section-actions">
        <button className="iis-icon-button" onClick={() => move(reportId, sectionId, "up")} type="button" aria-label="Move up"><ArrowUp size={18} /></button>
        <button className="iis-icon-button" onClick={() => move(reportId, sectionId, "down")} type="button" aria-label="Move down"><ArrowDown size={18} /></button>
        <button className="iis-icon-button danger" onClick={() => remove(reportId, sectionId)} type="button" aria-label="Delete section"><Trash2 size={18} /></button>
      </div>
    </div>
  );
}

function CommentPanel({ reportId, sectionId }: { reportId: string; sectionId: string }) {
  const report = useIndustryStore((s) => s.reports.find((r) => r.id === reportId));
  const add = useIndustryStore((s) => s.addSectionComment);
  const resolve = useIndustryStore((s) => s.resolveComment);
  const section = report?.sections.find((s) => s.id === sectionId);
  const [text, setText] = useState("");
  if (!section) return null;
  return (
    <div className="iis-panel-stack">
      <h2>Comments</h2>
      {section.comments.map((comment) => (
        <div key={comment.id} className="iis-comment">
          <p>{comment.text}</p>
          {!comment.resolved && <button className="iis-link-button" type="button" onClick={() => resolve(reportId, sectionId, comment.id)}>Resolve</button>}
        </div>
      ))}
      <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Add a comment to this section" />
      <button
        className="iis-button iis-button-primary"
        type="button"
        onClick={() => {
          if (!text.trim()) return;
          add(reportId, sectionId, text.trim());
          setText("");
        }}
      >
        <Save size={18} /> Add Comment
      </button>
    </div>
  );
}

function RefinePanel({ reportId, sectionId }: { reportId: string; sectionId: string }) {
  const report = useIndustryStore((s) => s.reports.find((r) => r.id === reportId));
  const update = useIndustryStore((s) => s.updateReportSection);
  const section = report?.sections.find((s) => s.id === sectionId);
  const [instruction, setInstruction] = useState("Make this section more executive-ready and quantify the implication.");
  if (!section) return null;
  return (
    <div className="iis-panel-stack">
      <h2>Refine Selected Section</h2>
      <p>Refinement is scoped to this section and its related data.</p>
      <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} />
      <button
        className="iis-button iis-button-primary"
        type="button"
        onClick={() =>
          update(
            reportId,
            sectionId,
            `${section.html}<p><strong>Refinement note:</strong> ${instruction}</p>`,
          )
        }
      >
        Refine Section
      </button>
    </div>
  );
}

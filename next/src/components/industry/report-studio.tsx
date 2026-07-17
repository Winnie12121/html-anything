"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Code2,
  Download,
  FileText,
  MessageSquare,
  Save,
} from "lucide-react";
import { previewHtml } from "@/lib/extract-html";
import type {
  WorkspaceReportComment,
  WorkspaceReportStudioView,
} from "@/lib/industry/workspace/client";
import { AppTopBar, ProjectSidebar } from "./shell";

export function ReportStudioPage({
  projectId,
  reportId,
  studioView,
}: {
  projectId: string;
  reportId: string;
  studioView: WorkspaceReportStudioView;
}) {
  const router = useRouter();
  const [leftTab, setLeftTab] = useState<"outline" | "sources" | "charts">("outline");
  const [rightTab, setRightTab] = useState<"edit" | "comment" | "refine">("edit");
  const [previewMode, setPreviewMode] = useState<"preview" | "html">("preview");
  const [activeSectionId, setActiveSectionId] = useState(
    studioView.report.sections[0]?.id ?? "document",
  );
  const [html, setHtml] = useState(studioView.html);
  const [comments, setComments] = useState(studioView.comments);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(studioView.report.updatedAt);

  const activeSection = useMemo(
    () =>
      studioView.report.sections.find((section) => section.id === activeSectionId) ??
      studioView.report.sections[0],
    [activeSectionId, studioView.report.sections],
  );
  const commentsBySection = useMemo(() => {
    const map = new Map<string, WorkspaceReportComment[]>();
    for (const comment of comments) {
      const items = map.get(comment.sectionId) ?? [];
      items.push(comment);
      map.set(comment.sectionId, items);
    }
    return map;
  }, [comments]);

  async function saveHtml() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/reports/${reportId}/html`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html }),
      });
      const payload = (await res.json()) as { updatedAt?: string; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to save HTML");
      setSavedAt(payload.updatedAt ?? new Date().toISOString());
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="iis-app">
      <AppTopBar
        projectId={projectId}
        projectName={studioView.project.name}
        section="Report Studio"
      />
      <div className="iis-studio-frame">
        <ProjectSidebar
          projectId={projectId}
          counts={studioView.counts}
        />
        <aside className="iis-studio-left">
          <div className="iis-tabs-flat">
            {(["outline", "sources", "charts"] as const).map((tab) => (
              <button
                key={tab}
                className={leftTab === tab ? "active" : ""}
                onClick={() => setLeftTab(tab)}
                type="button"
              >
                {tab[0]!.toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          {leftTab === "outline" && (
            <div className="iis-outline">
              {studioView.report.sections
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((section) => {
                  const openCount = (commentsBySection.get(section.id) ?? []).filter(
                    (comment) => !comment.resolved,
                  ).length;
                  return (
                    <button
                      key={section.id}
                      className={activeSection?.id === section.id ? "active" : ""}
                      onClick={() => setActiveSectionId(section.id)}
                      type="button"
                    >
                      <span>::</span>
                      {section.title}
                      {openCount > 0 && (
                        <em>
                          <MessageSquare size={15} /> {openCount}
                        </em>
                      )}
                    </button>
                  );
                })}
            </div>
          )}
          {leftTab === "sources" && <StudioSources studioView={studioView} />}
          {leftTab === "charts" && <StudioCharts studioView={studioView} />}
        </aside>

        <section className="iis-studio-preview">
          <div className="iis-studio-preview-toolbar">
            <div className="iis-tabs-flat">
              <button
                className={previewMode === "preview" ? "active" : ""}
                onClick={() => setPreviewMode("preview")}
                type="button"
              >
                <FileText size={17} /> Preview
              </button>
              <button
                className={previewMode === "html" ? "active" : ""}
                onClick={() => setPreviewMode("html")}
                type="button"
              >
                <Code2 size={17} /> HTML
              </button>
            </div>
            <button
              className="iis-button iis-button-primary"
              type="button"
              disabled={saving}
              onClick={() => void saveHtml()}
            >
              <Save size={17} /> {saving ? "Saving..." : "Save HTML"}
            </button>
          </div>
          {previewMode === "preview" ? (
            <iframe
              title={studioView.report.name}
              srcDoc={previewHtml(html)}
              className="iis-report-iframe"
            />
          ) : (
            <textarea
              className="iis-html-editor"
              value={html}
              onChange={(event) => setHtml(event.target.value)}
              spellCheck={false}
            />
          )}
        </section>

        <aside className="iis-studio-right">
          <div className="iis-tabs-flat">
            {(["edit", "comment", "refine"] as const).map((tab) => (
              <button
                key={tab}
                className={rightTab === tab ? "active" : ""}
                onClick={() => setRightTab(tab)}
                type="button"
              >
                {tab[0]!.toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          {activeSection && rightTab === "edit" && (
            <SectionEditPanel section={activeSection} />
          )}
          {activeSection && rightTab === "comment" && (
            <CommentPanel
              projectId={projectId}
              reportId={reportId}
              sectionId={activeSection.id}
              comments={comments}
              onCommentsChange={setComments}
            />
          )}
          {activeSection && rightTab === "refine" && (
            <RefinePanel sectionTitle={activeSection.title} />
          )}
        </aside>
      </div>
      <div className="iis-studio-footer">
        <span>
          Saved {new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
        {saveError && <span className="iis-selection-error">{saveError}</span>}
        <button
          className="iis-button iis-button-primary"
          type="button"
          onClick={() => exportHtml(studioView.report.name, html)}
        >
          <Download size={18} /> Export HTML
        </button>
      </div>
    </main>
  );
}

function StudioSources({ studioView }: { studioView: WorkspaceReportStudioView }) {
  return (
    <div className="iis-studio-list">
      {studioView.selectedRecords.length ? (
        studioView.selectedRecords.map((record) => (
          <p key={record.ref}>
            <FileText size={16} /> {record.title}
          </p>
        ))
      ) : (
        <p>No captured source records.</p>
      )}
    </div>
  );
}

function StudioCharts({ studioView }: { studioView: WorkspaceReportStudioView }) {
  const insights = studioView.suggestedInsights.filter((insight) => insight.included);
  return (
    <div className="iis-studio-list">
      {insights.length ? (
        insights.map((insight) => <p key={insight.id}>{insight.title}</p>)
      ) : (
        <p>No suggested insights were included.</p>
      )}
    </div>
  );
}

function SectionEditPanel({
  section,
}: {
  section: WorkspaceReportStudioView["report"]["sections"][number];
}) {
  return (
    <div className="iis-panel-stack">
      <h2>{section.title}</h2>
      <p>
        Edit the standalone HTML document in the center pane. This section is
        identified by <code>{section.selector}</code>.
      </p>
      <div className="iis-format-box">
        <strong>Related data</strong>
        <p>{section.sourceRecordRefs.length} source records linked in metadata.</p>
      </div>
    </div>
  );
}

function CommentPanel({
  projectId,
  reportId,
  sectionId,
  comments,
  onCommentsChange,
}: {
  projectId: string;
  reportId: string;
  sectionId: string;
  comments: WorkspaceReportComment[];
  onCommentsChange: (comments: WorkspaceReportComment[]) => void;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const sectionComments = comments.filter((comment) => comment.sectionId === sectionId);

  async function addComment() {
    if (!text.trim()) return;
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/reports/${reportId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId, text }),
      });
      const payload = (await res.json()) as {
        comment?: WorkspaceReportComment;
        error?: string;
      };
      if (!res.ok || !payload.comment) throw new Error(payload.error ?? "Failed to add comment");
      onCommentsChange([...comments, payload.comment]);
      setText("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function resolveComment(commentId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/reports/${reportId}/comments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentId }),
      });
      const payload = (await res.json()) as {
        comments?: WorkspaceReportComment[];
        error?: string;
      };
      if (!res.ok || !payload.comments) {
        throw new Error(payload.error ?? "Failed to resolve comment");
      }
      onCommentsChange(payload.comments);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="iis-panel-stack">
      <h2>Comments</h2>
      {sectionComments.length ? (
        sectionComments.map((comment) => (
          <div key={comment.id} className="iis-comment">
            <p>{comment.text}</p>
            {!comment.resolved ? (
              <button
                className="iis-link-button"
                type="button"
                onClick={() => void resolveComment(comment.id)}
              >
                Resolve
              </button>
            ) : (
              <small>Resolved</small>
            )}
          </div>
        ))
      ) : (
        <p>No comments on this section.</p>
      )}
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Add a comment to this section"
      />
      {error && <p className="iis-form-error">{error}</p>}
      <button className="iis-button iis-button-primary" type="button" onClick={() => void addComment()}>
        <Save size={18} /> Add Comment
      </button>
    </div>
  );
}

function RefinePanel({ sectionTitle }: { sectionTitle: string }) {
  return (
    <div className="iis-panel-stack">
      <h2>Refine Selected Section</h2>
      <p>
        Refinement for "{sectionTitle}" will be connected to the CLI generation
        path in the next generation milestone.
      </p>
      <textarea
        defaultValue="Make this section more executive-ready and quantify the implication."
      />
      <button className="iis-button iis-button-primary" type="button" disabled>
        Refine Section
      </button>
    </div>
  );
}

function exportHtml(name: string, html: string) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name.replace(/\W+/g, "-").toLowerCase() || "report"}.html`;
  link.click();
  URL.revokeObjectURL(url);
}

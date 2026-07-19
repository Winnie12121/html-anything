"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Code2,
  Download,
  Eye,
  FileText,
  MessageSquare,
  MousePointer2,
  Save,
  Sparkles,
  Type,
} from "lucide-react";
import { previewHtml } from "@/lib/extract-html";
import {
  parseReportHtml,
  reassembleReportHtml,
  renderReportHtmlForEditor,
  type ParsedReportHtml,
} from "@/lib/industry/report-html-editor";
import type {
  WorkspaceReportComment,
  WorkspaceReportStudioView,
} from "@/lib/industry/workspace/client";
import { useStore } from "@/lib/store";
import { AppTopBar, ProjectSidebar } from "./shell";

type StudioMode = "preview" | "edit" | "comment" | "html";
type CommentRef = { id: string; tag: string; snippet: string };
type IframeMessage =
  | { type: "ready" }
  | { type: "block-text-change"; id: string; text: string }
  | { type: "comment-toggle-select"; id: string; tag: string; snippet: string };

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
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const selectedAgentId = useStore((s) => s.selectedAgent);
  const agents = useStore((s) => s.agents);
  const agentModels = useStore((s) => s.agentModels);
  const agentBinOverrides = useStore((s) => s.agentBinOverrides);
  const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);
  const selectedModel = selectedAgentId ? agentModels[selectedAgentId] ?? "default" : "default";
  const selectedBinOverride = selectedAgentId
    ? agentBinOverrides[selectedAgentId]?.trim() || undefined
    : undefined;
  const [leftTab, setLeftTab] = useState<"outline" | "sources">("outline");
  const [mode, setMode] = useState<StudioMode>("preview");
  const [activeSectionId, setActiveSectionId] = useState(
    studioView.report.sections[0]?.id ?? "document",
  );
  const [parsed, setParsed] = useState<ParsedReportHtml>(() => parseReportHtml(studioView.html));
  const [rawHtml, setRawHtml] = useState(studioView.html);
  const [comments, setComments] = useState(studioView.comments);
  const [composerRefs, setComposerRefs] = useState<CommentRef[]>([]);
  const [composerGeneral, setComposerGeneral] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(studioView.report.updatedAt);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const cleanHtml = useMemo(
    () => reassembleReportHtml(parsed.skeleton, parsed.blocks),
    [parsed],
  );
  const iframeHtml = useMemo(() => {
    if (mode === "preview") return previewHtml(cleanHtml);
    const editorHtml = renderReportHtmlForEditor(parsed.skeleton, parsed.blocks);
    return injectReportEditor(previewHtml(editorHtml), mode);
  }, [cleanHtml, mode, parsed]);
  const activeSection = useMemo(
    () =>
      studioView.report.sections.find((section) => section.id === activeSectionId) ??
      studioView.report.sections[0],
    [activeSectionId, studioView.report.sections],
  );
  const commentsBySection = useMemo(() => {
    const map = new Map<string, WorkspaceReportComment[]>();
    for (const comment of comments) {
      if (!comment.sectionId) continue;
      const items = map.get(comment.sectionId) ?? [];
      items.push(comment);
      map.set(comment.sectionId, items);
    }
    return map;
  }, [comments]);

  useEffect(() => {
    setSidebarCollapsed(localStorage.getItem("iis-sidebar-collapsed") === "true");
  }, []);

  useEffect(() => {
    function handleMessage(event: MessageEvent<IframeMessage>) {
      const data = event.data;
      if (!data || typeof data !== "object" || !("type" in data)) return;
      if (data.type === "ready") {
        sendToIframe({ cmd: "set-mode", mode });
        sendToIframe({ cmd: "set-selection", ids: composerRefs.map((ref) => ref.id) });
        markCommentedRefs(comments);
      }
      if (data.type === "block-text-change") {
        setParsed((current) => ({
          ...current,
          blocks: current.blocks.map((block) =>
            block.id === data.id ? { ...block, text: data.text } : block,
          ),
        }));
      }
      if (data.type === "comment-toggle-select") {
        setMode("comment");
        setComposerGeneral(false);
        setComposerRefs((refs) => {
          const exists = refs.some((ref) => ref.id === data.id);
          return exists
            ? refs.filter((ref) => ref.id !== data.id)
            : [...refs, { id: data.id, tag: data.tag, snippet: data.snippet }];
        });
      }
    }

    window.addEventListener("message", handleMessage as EventListener);
    return () => window.removeEventListener("message", handleMessage as EventListener);
  }, [comments, composerRefs, mode]);

  useEffect(() => {
    sendToIframe({ cmd: "set-mode", mode });
    if (mode !== "comment") {
      setComposerRefs([]);
      setComposerGeneral(false);
      sendToIframe({ cmd: "set-selection", ids: [] });
    }
  }, [mode]);

  useEffect(() => {
    sendToIframe({ cmd: "set-selection", ids: composerRefs.map((ref) => ref.id) });
  }, [composerRefs]);

  function sendToIframe(data: Record<string, unknown>) {
    iframeRef.current?.contentWindow?.postMessage({ _src: "iis-report-editor", ...data }, "*");
  }

  function markCommentedRefs(nextComments: WorkspaceReportComment[]) {
    sendToIframe({ cmd: "clear-commented" });
    const ids = new Set(
      nextComments
        .filter((comment) => !comment.resolved)
        .flatMap((comment) => comment.refs ?? [])
        .map((ref) => ref.id),
    );
    ids.forEach((id) => sendToIframe({ cmd: "mark-commented", id }));
  }

  function toggleSidebar() {
    setSidebarCollapsed((value) => {
      const next = !value;
      localStorage.setItem("iis-sidebar-collapsed", String(next));
      return next;
    });
  }

  function switchMode(nextMode: StudioMode) {
    if (nextMode === "html") setRawHtml(cleanHtml);
    setMode(nextMode);
  }

  async function saveHtml() {
    setSaving(true);
    setSaveError(null);
    try {
      const htmlToSave = mode === "html" ? rawHtml : cleanHtml;
      const res = await fetch(`/api/projects/${projectId}/reports/${reportId}/html`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: htmlToSave }),
      });
      const payload = (await res.json()) as { updatedAt?: string; error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to save HTML");
      setParsed(parseReportHtml(htmlToSave));
      setSavedAt(payload.updatedAt ?? new Date().toISOString());
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function updateRawHtml(value: string) {
    setRawHtml(value);
    try {
      setParsed(parseReportHtml(value));
    } catch {
      // Keep the textarea responsive while the user is mid-editing invalid HTML.
    }
  }

  async function regenerateWithComments() {
    const unresolvedIds = comments.filter((comment) => !comment.resolved).map((comment) => comment.id);
    if (!unresolvedIds.length) return;
    setRegenerating(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/reports/${reportId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentIds: unresolvedIds,
          ...(selectedAgent && !selectedAgent.unsupported ? { agent: selectedAgent.id } : {}),
          ...(selectedModel !== "default" ? { model: selectedModel } : {}),
          ...(selectedBinOverride ? { binOverride: selectedBinOverride } : {}),
        }),
      });
      const payload = (await res.json()) as { html?: string; updatedAt?: string; error?: string };
      if (!res.ok || !payload.html) throw new Error(payload.error ?? "Failed to regenerate report");
      setParsed(parseReportHtml(payload.html));
      setRawHtml(payload.html);
      setMode("preview");
      setSavedAt(payload.updatedAt ?? new Date().toISOString());
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setRegenerating(false);
    }
  }

  const commentRailOpen = mode === "comment";
  const studioColumns = [
    sidebarCollapsed ? "72px" : "252px",
    "300px",
    "minmax(420px, 1fr)",
    ...(commentRailOpen ? ["360px"] : []),
  ].join(" ");

  return (
    <main className="iis-app iis-report-studio-app">
      <AppTopBar
        projectId={projectId}
        projectName={studioView.project.name}
        section="Report Studio"
      />
      <div
        className={sidebarCollapsed ? "iis-studio-frame collapsed" : "iis-studio-frame"}
        style={{ gridTemplateColumns: studioColumns }}
      >
        <ProjectSidebar
          projectId={projectId}
          counts={studioView.counts}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={toggleSidebar}
        />
        <aside className="iis-studio-left">
          <div className="iis-tabs-flat">
            {(["outline", "sources"] as const).map((tab) => (
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
        </aside>

        <section className="iis-studio-preview">
          <div className="iis-studio-preview-toolbar">
            <div className="iis-tabs-flat iis-mode-tabs">
              {MODE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  className={mode === option.id ? "active" : ""}
                  onClick={() => switchMode(option.id)}
                  type="button"
                  title={option.title}
                >
                  <option.icon size={17} /> {option.label}
                </button>
              ))}
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
          {mode === "html" ? (
            <textarea
              className="iis-html-editor"
              value={rawHtml}
              onChange={(event) => updateRawHtml(event.target.value)}
              spellCheck={false}
            />
          ) : (
            <iframe
              ref={iframeRef}
              key={mode}
              title={studioView.report.name}
              srcDoc={iframeHtml}
              className="iis-report-iframe"
            />
          )}
        </section>

        {commentRailOpen && (
          <CommentRail
            projectId={projectId}
            reportId={reportId}
            mode={mode}
            onCommentMode={() => setMode("comment")}
            comments={comments}
            composerRefs={composerRefs}
            composerGeneral={composerGeneral}
            regenerating={regenerating}
            canRegenerate={Boolean(selectedAgent && !selectedAgent.unsupported)}
            regenerationError={saveError}
            onComposerRefsChange={setComposerRefs}
            onComposerGeneralChange={setComposerGeneral}
            onCommentsChange={(nextComments) => {
              setComments(nextComments);
              markCommentedRefs(nextComments);
            }}
            onFlashRefs={(refs) => {
              setMode("comment");
              sendToIframe({ cmd: "flash-refs", ids: refs.map((ref) => ref.id) });
              sendToIframe({ cmd: "scroll-to", id: refs[0]?.id });
            }}
            onRegenerate={() => void regenerateWithComments()}
          />
        )}
      </div>
      {mode !== "comment" && (
        <div className="iis-studio-footer">
          <span>
            Saved {new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {mode === "edit" && <span>Direct text editing is active</span>}
          {saveError && <span className="iis-selection-error">{saveError}</span>}
          <button
            className="iis-button iis-button-primary"
            type="button"
            onClick={() => exportHtml(studioView.report.name, cleanHtml)}
          >
            <Download size={18} /> Export HTML
          </button>
        </div>
      )}
    </main>
  );
}

const MODE_OPTIONS: Array<{
  id: StudioMode;
  label: string;
  title: string;
  icon: typeof Eye;
}> = [
  { id: "preview", label: "Preview", title: "View the report", icon: Eye },
  { id: "edit", label: "Edit", title: "Edit report text in place", icon: Type },
  { id: "comment", label: "Comment", title: "Anchor comments to report elements", icon: MessageSquare },
  { id: "html", label: "HTML", title: "Edit raw HTML", icon: Code2 },
];

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

function CommentRail({
  projectId,
  reportId,
  mode,
  onCommentMode,
  comments,
  composerRefs,
  composerGeneral,
  regenerating,
  canRegenerate,
  regenerationError,
  onComposerRefsChange,
  onComposerGeneralChange,
  onCommentsChange,
  onFlashRefs,
  onRegenerate,
}: {
  projectId: string;
  reportId: string;
  mode: StudioMode;
  onCommentMode: () => void;
  comments: WorkspaceReportComment[];
  composerRefs: CommentRef[];
  composerGeneral: boolean;
  regenerating: boolean;
  canRegenerate: boolean;
  regenerationError: string | null;
  onComposerRefsChange: (refs: CommentRef[]) => void;
  onComposerGeneralChange: (general: boolean) => void;
  onCommentsChange: (comments: WorkspaceReportComment[]) => void;
  onFlashRefs: (refs: CommentRef[]) => void;
  onRegenerate: () => void;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const unresolvedCount = comments.filter((comment) => !comment.resolved).length;
  const composerOpen = composerGeneral || composerRefs.length > 0;

  function startGeneral() {
    onCommentMode();
    onComposerGeneralChange(true);
    onComposerRefsChange([]);
  }

  function cancelComposer() {
    setText("");
    onComposerGeneralChange(false);
    onComposerRefsChange([]);
  }

  async function addComment() {
    if (!text.trim() || !composerOpen) return;
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/reports/${reportId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          general: composerGeneral,
          refs: composerRefs,
        }),
      });
      const payload = (await res.json()) as {
        comment?: WorkspaceReportComment;
        error?: string;
      };
      if (!res.ok || !payload.comment) throw new Error(payload.error ?? "Failed to add comment");
      onCommentsChange([...comments, payload.comment]);
      cancelComposer();
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
    <aside className="iis-studio-right iis-comment-rail">
      <header className="iis-comment-rail-head">
        <span>
          <MessageSquare size={18} /> Comments
        </span>
        <em>{comments.length}</em>
        <button className="iis-icon-button" type="button" onClick={startGeneral} title="General comment">
          +
        </button>
      </header>
      {mode !== "comment" && (
        <button className="iis-comment-mode-callout" type="button" onClick={onCommentMode}>
          <MousePointer2 size={17} /> Switch to Comment mode to anchor feedback
        </button>
      )}
      {composerOpen && (
        <div className="iis-comment-composer">
          {composerGeneral ? (
            <div className="iis-comment-targets">
              <span className="general">Whole document</span>
            </div>
          ) : (
            <div className="iis-comment-targets">
              {composerRefs.map((ref) => (
                <span key={ref.id}>
                  {ref.snippet || ref.tag}
                  <button
                    type="button"
                    onClick={() => onComposerRefsChange(composerRefs.filter((item) => item.id !== ref.id))}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          )}
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") void addComment();
              if (event.key === "Escape") cancelComposer();
            }}
            placeholder="Write what should change..."
          />
          <div className="iis-comment-actions">
            <small>Cmd + Enter to save</small>
            <button className="iis-button" type="button" onClick={cancelComposer}>
              Cancel
            </button>
            <button className="iis-button iis-button-primary" type="button" onClick={() => void addComment()}>
              Add Comment
            </button>
          </div>
        </div>
      )}
      <div className="iis-comment-list">
        {comments.length ? (
          comments.map((comment) => {
            const refs = comment.refs ?? [];
            const isGeneral = comment.general || refs.length === 0;
            return (
              <article
                key={comment.id}
                className={comment.resolved ? "iis-comment resolved" : "iis-comment"}
                onClick={() => {
                  if (!isGeneral) onFlashRefs(refs);
                }}
              >
                <div className="iis-comment-meta">
                  <strong>{isGeneral ? "General" : "Anchored"}</strong>
                  {comment.resolved && <small>Resolved</small>}
                </div>
                {!isGeneral && (
                  <div className="iis-comment-targets compact">
                    {refs.map((ref) => <span key={ref.id}>{ref.snippet || ref.tag}</span>)}
                  </div>
                )}
                <p>{comment.text}</p>
                {!comment.resolved && (
                  <button
                    className="iis-link-button"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void resolveComment(comment.id);
                    }}
                  >
                    Resolve
                  </button>
                )}
              </article>
            );
          })
        ) : (
          <p className="iis-empty-note">No comments yet.</p>
        )}
      </div>
      {error && <p className="iis-form-error">{error}</p>}
      {regenerationError && <p className="iis-form-error iis-comment-rail-error">{regenerationError}</p>}
      <footer className="iis-comment-regenerate">
        <button
          className="iis-button iis-button-primary"
          type="button"
          disabled={regenerating || unresolvedCount === 0 || !canRegenerate}
          onClick={onRegenerate}
          title={canRegenerate ? "Regenerate report with unresolved comments" : "Choose a CLI agent in the top bar"}
        >
          <Sparkles size={17} /> {regenerating ? "Regenerating..." : "Regenerate with comments"}
        </button>
        <small>
          {unresolvedCount} unresolved
          {!canRegenerate ? " · choose a CLI agent first" : ""}
        </small>
      </footer>
    </aside>
  );
}

function injectReportEditor(html: string, mode: StudioMode): string {
  const injection = `${REPORT_EDITOR_STYLE}<script>${REPORT_EDITOR_SCRIPT}</script>`;
  const patched = html.includes("</body>")
    ? html.replace(/<\/body>/i, `${injection}</body>`)
    : `${html}${injection}`;
  return patched.replace(/<body([^>]*)>/i, `<body$1 data-iis-mode="${mode}">`);
}

const REPORT_EDITOR_STYLE = `<style id="__iis-report-editor-style">
html, body { overflow: auto !important; }
body[data-iis-mode="edit"] [data-hce-text]:hover {
  outline: 1px dashed rgba(10, 101, 170, .55) !important;
  outline-offset: 2px;
  cursor: text;
}
body[data-iis-mode="edit"] [data-hce-text][contenteditable]:focus {
  outline: 2px solid rgba(10, 101, 170, .85) !important;
  outline-offset: 2px;
}
body[data-iis-mode="comment"], body[data-iis-mode="comment"] * {
  cursor: crosshair !important;
}
body[data-iis-mode="comment"] [data-block-id]:hover {
  outline: 1.5px dashed rgba(255, 90, 31, .75) !important;
  outline-offset: 2px;
}
[data-hce-selected] {
  outline: 2px solid rgba(255, 90, 31, .95) !important;
  outline-offset: 2px;
  background: rgba(255, 241, 236, .6) !important;
}
[data-commented] {
  box-shadow: inset 3px 0 0 rgba(255, 90, 31, .8) !important;
}
[data-iis-flash] {
  animation: iis-report-flash 1.3s ease;
}
@keyframes iis-report-flash {
  0%, 100% { background-color: transparent; }
  35% { background-color: rgba(255, 90, 31, .25); }
}
</style>`;

const REPORT_EDITOR_SCRIPT = `
(function() {
  var mode = document.body.dataset.iisMode || "preview";
  var inputTimer;

  function applyMode(nextMode) {
    mode = nextMode || "preview";
    document.body.dataset.iisMode = mode;
    document.querySelectorAll("[data-hce-text]").forEach(function(el) {
      if (mode === "edit") {
        el.setAttribute("contenteditable", "plaintext-only");
        el.spellcheck = false;
      } else {
        el.removeAttribute("contenteditable");
      }
    });
  }

  function pickTarget(node) {
    if (!node || !node.closest) return null;
    return node.closest("[data-block-id]");
  }

  function snippetOf(el) {
    return (el.textContent || el.getAttribute("aria-label") || el.tagName || "")
      .replace(/\\s+/g, " ")
      .trim()
      .slice(0, 90);
  }

  document.addEventListener("input", function(event) {
    if (mode !== "edit") return;
    var el = event.target.closest && event.target.closest("[data-hce-text]");
    if (!el) return;
    var id = el.getAttribute("data-block-id");
    clearTimeout(inputTimer);
    inputTimer = setTimeout(function() {
      window.parent.postMessage({ type: "block-text-change", id: id, text: el.textContent || "" }, "*");
    }, 160);
  });

  document.addEventListener("click", function(event) {
    if (mode !== "comment") return;
    var el = pickTarget(event.target);
    if (!el) return;
    event.preventDefault();
    event.stopPropagation();
    window.parent.postMessage({
      type: "comment-toggle-select",
      id: el.getAttribute("data-block-id"),
      tag: el.tagName.toLowerCase(),
      snippet: snippetOf(el)
    }, "*");
  }, true);

  window.addEventListener("message", function(event) {
    var data = event.data;
    if (!data || data._src !== "iis-report-editor") return;
    if (data.cmd === "set-mode") applyMode(data.mode);
    if (data.cmd === "set-selection") {
      document.querySelectorAll("[data-hce-selected]").forEach(function(el) {
        el.removeAttribute("data-hce-selected");
      });
      (data.ids || []).forEach(function(id) {
        var el = document.querySelector('[data-block-id="' + id + '"]');
        if (el) el.setAttribute("data-hce-selected", "1");
      });
    }
    if (data.cmd === "scroll-to") {
      var target = document.querySelector('[data-block-id="' + data.id + '"]');
      if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (data.cmd === "flash-refs") {
      (data.ids || []).forEach(function(id) {
        var el = document.querySelector('[data-block-id="' + id + '"]');
        if (!el) return;
        el.setAttribute("data-iis-flash", "1");
        setTimeout(function() { el.removeAttribute("data-iis-flash"); }, 1300);
      });
    }
    if (data.cmd === "mark-commented") {
      var marked = document.querySelector('[data-block-id="' + data.id + '"]');
      if (marked) marked.setAttribute("data-commented", "1");
    }
    if (data.cmd === "clear-commented") {
      document.querySelectorAll("[data-commented]").forEach(function(el) {
        el.removeAttribute("data-commented");
      });
    }
  });

  applyMode(mode);
  window.parent.postMessage({ type: "ready" }, "*");
})();`;

function exportHtml(name: string, html: string) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name.replace(/\W+/g, "-").toLowerCase() || "report"}.html`;
  link.click();
  URL.revokeObjectURL(url);
}

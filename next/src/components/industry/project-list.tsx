"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Clock, Database, FileText, Plus, Trash2 } from "lucide-react";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { AppTopBar, AppLogo } from "./shell";
import { relativeTime } from "@/lib/industry/format";
import type { WorkspaceProjectSummary } from "@/lib/industry/workspace/client";

export function ProjectListPage({
  projects,
}: {
  projects: WorkspaceProjectSummary[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [pendingDeleteProject, setPendingDeleteProject] = useState<
    WorkspaceProjectSummary["project"] | null
  >(null);

  async function deleteProject(project: WorkspaceProjectSummary["project"]) {
    setDeletingProjectId(project.slug);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(project.slug)}`, {
        method: "DELETE",
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "Project deletion failed");
      }
      setPendingDeleteProject(null);
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingProjectId(null);
    }
  }

  return (
    <main className="iis-app">
      <AppTopBar />
      <section className="iis-home">
        <div className="iis-home-header">
          <div>
            <AppLogo />
            <p>Collect, organize, and transform industry data into reusable insight reports.</p>
          </div>
          <button className="iis-button iis-button-primary" onClick={() => setOpen(true)} type="button">
            <Plus size={19} /> Create New Project
          </button>
        </div>

        <div className="iis-section-title">
          <span>Recent Projects</span>
          <div />
        </div>

        <div className="iis-project-list">
          {projects.map(({ project, counts }) => {
            const updatedAt = Date.parse(project.updatedAt);
            return (
              <article key={project.slug} className="iis-project-card">
                <Link href={`/projects/${project.slug}/overview`} className="iis-project-card-link">
                  <div className="iis-project-dot" />
                  <div className="iis-project-card-main">
                    <h2>{project.name}</h2>
                    <div className="iis-chip-row">
                      {project.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                    <div className="iis-project-stats">
                      <span><Building2 size={18} /> {counts.companies} companies</span>
                      <span><Database size={18} /> {counts.dataItems} data items</span>
                      <span><FileText size={18} /> {counts.reports} reports</span>
                    </div>
                  </div>
                  <div className="iis-project-card-side">
                    <strong>Open Project ›</strong>
                    <span>
                      <Clock size={18} /> Updated {Number.isFinite(updatedAt) ? relativeTime(updatedAt) : "-"}
                    </span>
                  </div>
                </Link>
                <button
                  className="iis-icon-button iis-button-danger iis-project-delete"
                  type="button"
                  title="Delete project"
                  aria-label={`Delete project ${project.name}`}
                  disabled={deletingProjectId === project.slug}
                  onClick={() => setPendingDeleteProject(project)}
                >
                  <Trash2 size={18} />
                </button>
              </article>
            );
          })}
        </div>
        {deleteError && <p className="iis-form-error">{deleteError}</p>}

        <button className="iis-empty-action" onClick={() => setOpen(true)} type="button">
          <span>+</span>
          Create a new project to start collecting industry data
        </button>
      </section>

      {open && (
        <CreateProjectDialog
          busy={creating}
          error={error}
          onClose={() => setOpen(false)}
          onCreate={async (input) => {
            setCreating(true);
            setError(null);
            try {
              const res = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input),
              });
              const payload = (await res.json()) as {
                project?: WorkspaceProjectSummary;
                error?: string;
              };
              if (!res.ok || !payload.project) {
                throw new Error(payload.error ?? "Project creation failed");
              }
              setOpen(false);
              router.refresh();
              router.push(`/projects/${payload.project.project.slug}/overview`);
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            } finally {
              setCreating(false);
            }
          }}
        />
      )}
      {pendingDeleteProject && (
        <ConfirmDeleteDialog
          title="Delete project"
          message={`Delete project "${pendingDeleteProject.name}"? This cannot be undone.`}
          busy={deletingProjectId === pendingDeleteProject.slug}
          onCancel={() => setPendingDeleteProject(null)}
          onConfirm={() => void deleteProject(pendingDeleteProject)}
        />
      )}
    </main>
  );
}

function CreateProjectDialog({
  busy,
  error,
  onClose,
  onCreate,
}: {
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onCreate: (input: {
    name: string;
    industry: string;
    region: "China" | "Global";
    trackedCompanies: string[];
  }) => void | Promise<void>;
}) {
  const [name, setName] = useState("Automotive Semiconductor HR Market Insight");
  const [industry, setIndustry] = useState("Automotive Semiconductor");
  const [region, setRegion] = useState<"China" | "Global">("China");
  const [trackedCompanies, setTrackedCompanies] = useState(
    "英飞凌、德州仪器、高通、意法半导体、恩智浦",
  );

  const parsedCompanies = parseCompanyList(trackedCompanies);

  return (
    <div className="iis-modal-backdrop" role="dialog" aria-modal="true">
      <form
        className="iis-modal"
        onSubmit={(event) => {
          event.preventDefault();
          onCreate({ name, industry, region, trackedCompanies: parsedCompanies });
        }}
      >
        <h2>Create Project</h2>
        <label>
          Project name
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Industry
          <input value={industry} onChange={(event) => setIndustry(event.target.value)} />
        </label>
        <label>
          Region
          <div className="iis-region-picker">
            <button
              className={region === "China" ? "active" : ""}
              type="button"
              onClick={() => setRegion("China")}
            >
              China
            </button>
            <button
              className={region === "Global" ? "active" : ""}
              type="button"
              onClick={() => setRegion("Global")}
            >
              Global
            </button>
          </div>
        </label>
        <label>
          Tracked Companies
          <textarea
            value={trackedCompanies}
            onChange={(event) => setTrackedCompanies(event.target.value)}
            rows={4}
          />
          <small>{parsedCompanies.length} companies configured</small>
        </label>
        {error && <p className="iis-form-error">{error}</p>}
        <div className="iis-modal-actions">
          <button className="iis-button iis-button-ghost" type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="iis-button iis-button-primary" type="submit" disabled={busy}>
            {busy ? "Creating..." : "Create Project"}
          </button>
        </div>
      </form>
    </div>
  );
}

function parseCompanyList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,，、]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

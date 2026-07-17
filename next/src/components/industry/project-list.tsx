"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Clock, Database, FileText, Plus } from "lucide-react";
import { AppTopBar, AppLogo } from "./shell";
import { getProjectCounts, useIndustryHydrated, useIndustryStore } from "@/lib/industry/store";
import { relativeTime } from "@/lib/industry/format";

export function ProjectListPage() {
  const router = useRouter();
  const hydrated = useIndustryHydrated();
  const projects = useIndustryStore((s) => s.projects);
  const state = useIndustryStore((s) => s);
  const createProject = useIndustryStore((s) => s.createProject);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

        {!hydrated && <div className="iis-card iis-loading">Restoring workspace...</div>}

        <div className="iis-project-list">
          {projects.map((project) => {
            const counts = getProjectCounts(state, project.id);
            return (
              <Link key={project.id} href={`/projects/${project.id}/overview`} className="iis-project-card">
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
                    <Clock size={18} /> Updated {mounted ? relativeTime(project.updatedAt) : "-"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        <button className="iis-empty-action" onClick={() => setOpen(true)} type="button">
          <span>+</span>
          Create a new project to start collecting industry data
        </button>
      </section>

      {open && (
        <CreateProjectDialog
          onClose={() => setOpen(false)}
          onCreate={(input) => {
            const id = createProject(input);
            setOpen(false);
            router.push(`/projects/${id}/overview`);
          }}
        />
      )}
    </main>
  );
}

function CreateProjectDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: { name: string; industry: string; region: string }) => void;
}) {
  const [name, setName] = useState("China Automotive Talent Insight");
  const [industry, setIndustry] = useState("Automotive");
  const [region, setRegion] = useState("China");

  return (
    <div className="iis-modal-backdrop" role="dialog" aria-modal="true">
      <form
        className="iis-modal"
        onSubmit={(event) => {
          event.preventDefault();
          onCreate({ name, industry, region });
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
          <input value={region} onChange={(event) => setRegion(event.target.value)} />
        </label>
        <div className="iis-modal-actions">
          <button className="iis-button iis-button-ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="iis-button iis-button-primary" type="submit">
            Create Project
          </button>
        </div>
      </form>
    </div>
  );
}

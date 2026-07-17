import { ProjectListPage } from "@/components/industry/project-list";
import { listWorkspaceProjects } from "@/lib/industry/workspace";

export default async function Page() {
  const projects = await listWorkspaceProjects();
  return <ProjectListPage projects={projects} />;
}

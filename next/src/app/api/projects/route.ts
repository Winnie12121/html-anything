import { NextRequest, NextResponse } from "next/server";
import {
  createWorkspaceProject,
  listWorkspaceProjects,
  normalizeWorkspaceRegion,
} from "@/lib/industry/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const projects = await listWorkspaceProjects();
    return NextResponse.json({ projects });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  let body: {
    name?: unknown;
    industry?: unknown;
    region?: unknown;
    tags?: unknown;
    trackedCompanies?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json(
      { error: "Missing required field: name" },
      { status: 400 },
    );
  }

  if (typeof body.industry !== "string" || typeof body.region !== "string") {
    return NextResponse.json(
      { error: "Missing required fields: industry, region" },
      { status: 400 },
    );
  }
  if (body.region !== "China" && body.region !== "Global") {
    return NextResponse.json(
      { error: "Region must be China or Global" },
      { status: 400 },
    );
  }

  const trackedCompanies = Array.isArray(body.trackedCompanies)
    ? body.trackedCompanies.filter((company): company is string => typeof company === "string")
    : [];
  if (!trackedCompanies.some((company) => company.trim())) {
    return NextResponse.json(
      { error: "At least one tracked company is required" },
      { status: 400 },
    );
  }

  try {
    const project = await createWorkspaceProject({
      name: body.name,
      industry: body.industry,
      region: normalizeWorkspaceRegion(body.region),
      trackedCompanies,
      tags: Array.isArray(body.tags)
        ? body.tags.filter((tag): tag is string => typeof tag === "string")
        : undefined,
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

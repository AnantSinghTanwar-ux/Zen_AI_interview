import { NextRequest, NextResponse } from "next/server";
import { jobService } from "@/services/recruiter/job.service";

/**
 * GET /api/v2/jobs — Public endpoint: list all active jobs.
 * Supports query params: search, experienceLevel, type, skills (comma-separated).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const filters: {
      search?: string;
      experienceLevel?: string;
      type?: string;
      skills?: string[];
    } = {};

    const search = searchParams.get("search")?.trim();
    if (search && search.length <= 200) {
      filters.search = search;
    }

    const experienceLevel = searchParams.get("experienceLevel");
    if (experienceLevel && ["junior", "mid", "senior", "lead"].includes(experienceLevel)) {
      filters.experienceLevel = experienceLevel;
    }

    const type = searchParams.get("type");
    if (type && ["technical", "behavioral", "mixed"].includes(type)) {
      filters.type = type;
    }

    const skillsParam = searchParams.get("skills")?.trim();
    if (skillsParam) {
      filters.skills = skillsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 20);
    }

    const jobs = await jobService.listActiveJobs(filters);

    // Return only public-safe fields (don't expose applicantIds or recruiterId)
    const publicJobs = jobs.map((job) => ({
      id: job.id,
      title: job.title,
      description: job.description,
      companyName: job.companyName,
      requiredSkills: job.requiredSkills,
      experienceLevel: job.experienceLevel,
      type: job.type,
      location: job.location || "",
      salaryRange: job.salaryRange || null,
      deadline: job.deadline || null,
      applicantCount: job.applicantIds?.length || 0,
      createdAt: job.createdAt,
    }));

    return NextResponse.json({ jobs: publicJobs });
  } catch (error) {
    console.error("[GET /api/v2/jobs] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}

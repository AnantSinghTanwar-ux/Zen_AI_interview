import { NextRequest, NextResponse } from "next/server";
import { jobService } from "@/services/recruiter/job.service";

/**
 * GET /api/v2/jobs/[jobId] — Public endpoint: get a single active job.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    }

    const job = await jobService.getJob(jobId);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (job.status !== "active") {
      return NextResponse.json(
        { error: "This job posting is no longer active" },
        { status: 404 }
      );
    }

    // Return only public-safe fields
    return NextResponse.json({
      job: {
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
      },
    });
  } catch (error) {
    console.error("[GET /api/v2/jobs/[jobId]] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch job" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { recruiterService } from "@/services/recruiter/recruiter.service";
import { jobService } from "@/services/recruiter/job.service";

async function getOrCreateRecruiter(userId: string, companyName?: string, industry?: string) {
  let recruiter = await recruiterService.getRecruiterByUserId(userId);

  // Auto-create a recruiter profile if it doesn't exist yet
  if (!recruiter) {
    const id = await recruiterService.createRecruiterProfile({
      userId,
      companyName: companyName || "My Company",
      industry: industry || "Technology",
      role: "recruiter",
      jobsCreated: 0,
      applicantsScreened: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    recruiter = await recruiterService.getRecruiter(id);
  }

  return recruiter;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();

    if (!data.title || !data.description) {
      return NextResponse.json(
        { error: "title and description are required" },
        { status: 400 }
      );
    }

    // Auto-create recruiter profile if needed so the first job always works
    const recruiter = await getOrCreateRecruiter(user.id, data.companyName, data.industry);

    if (!recruiter) {
      return NextResponse.json(
        { error: "Failed to initialize recruiter profile" },
        { status: 500 }
      );
    }

    const jobId = await jobService.createJob({
      recruiterId: recruiter.id!,
      companyName: recruiter.companyName,
      title: data.title,
      description: data.description,
      requiredSkills: data.requiredSkills || [],
      experienceLevel: data.experienceLevel || "mid",
      type: data.type || "mixed",
      salaryRange: data.salaryRange,
      status: "active",
    });

    await recruiterService.incrementJobCount(recruiter.id!);

    return NextResponse.json({ jobId, success: true }, { status: 201 });
  } catch (error) {
    console.error("Error creating job:", error);
    return NextResponse.json(
      { error: "Failed to create job", details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Auto-create recruiter profile if needed
    const recruiter = await getOrCreateRecruiter(user.id);

    if (!recruiter) {
      return NextResponse.json([], { status: 200 });
    }

    const jobs = await jobService.listJobsByRecruiter(recruiter.id!);

    return NextResponse.json(jobs, { status: 200 });
  } catch (error) {
    console.error("Error listing jobs:", error);
    return NextResponse.json(
      { error: "Failed to list jobs", details: (error as Error).message },
      { status: 500 }
    );
  }
}

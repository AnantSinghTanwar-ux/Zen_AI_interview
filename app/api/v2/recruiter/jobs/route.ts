import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { recruiterService } from "@/services/recruiter/recruiter.service";
import { jobService } from "@/services/recruiter/job.service";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const recruiter = await recruiterService.getRecruiterByUserId(user.id);
    if (!recruiter) {
      return NextResponse.json(
        { error: "Recruiter profile not found. Please sign up as a recruiter first." },
        { status: 403 }
      );
    }

    const data = await request.json();

    if (!data.title || !data.description) {
      return NextResponse.json(
        { error: "title and description are required" },
        { status: 400 }
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
      { error: "Failed to create job" },
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

    const recruiter = await recruiterService.getRecruiterByUserId(user.id);
    if (!recruiter) {
      return NextResponse.json(
        { error: "Recruiter profile not found" },
        { status: 403 }
      );
    }

    const jobs = await jobService.listJobsByRecruiter(recruiter.id!);

    return NextResponse.json(jobs, { status: 200 });
  } catch (error) {
    console.error("Error listing jobs:", error);
    return NextResponse.json(
      { error: "Failed to list jobs" },
      { status: 500 }
    );
  }
}

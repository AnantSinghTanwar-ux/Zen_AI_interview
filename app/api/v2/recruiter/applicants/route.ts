import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { recruiterService } from "@/services/recruiter/recruiter.service";
import { applicantService } from "@/services/recruiter/applicant.service";

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

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");
    const status = searchParams.get("status") || undefined;

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId query parameter is required" },
        { status: 400 }
      );
    }

    const applicants = await applicantService.getApplicantsByJob(jobId, status);

    // Enrich applicants with screening results if completed
    const enriched = await Promise.all(
      applicants.map(async (a) => {
        if (a.status === "completed" || a.status === "shortlisted" || a.status === "rejected") {
          const full = await applicantService.getApplicantWithResults(a.id);
          return full || a;
        }
        return a;
      })
    );

    return NextResponse.json(enriched, { status: 200 });
  } catch (error) {
    console.error("Error listing applicants:", error);
    return NextResponse.json(
      { error: "Failed to list applicants" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const { applicantId, status, notes } = data;

    if (!applicantId || !status) {
      return NextResponse.json(
        { error: "applicantId and status are required" },
        { status: 400 }
      );
    }

    await applicantService.updateApplicantStatus(applicantId, status);

    if (notes) {
      await applicantService.addNote(applicantId, notes);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error updating applicant:", error);
    return NextResponse.json(
      { error: "Failed to update applicant" },
      { status: 500 }
    );
  }
}

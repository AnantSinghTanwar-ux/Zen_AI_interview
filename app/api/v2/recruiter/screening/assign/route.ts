import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { recruiterService } from "@/services/recruiter/recruiter.service";
import { screeningService } from "@/services/recruiter/screening.service";

export async function POST(request: NextRequest) {
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

    const data = await request.json();
    const { jobId, applicantIds } = data;

    if (!jobId || !applicantIds?.length) {
      return NextResponse.json(
        { error: "jobId and applicantIds are required" },
        { status: 400 }
      );
    }

    const result = await screeningService.assignInterviewsToApplicants(
      jobId,
      applicantIds
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error assigning screenings:", error);
    return NextResponse.json(
      { error: "Failed to assign screenings" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { recruiterService } from "@/services/recruiter/recruiter.service";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();

    if (!data.companyName || !data.industry) {
      return NextResponse.json(
        { error: "companyName and industry are required" },
        { status: 400 }
      );
    }

    const recruiterId = await recruiterService.createRecruiterProfile({
      userId: user.id,
      companyName: data.companyName,
      industry: data.industry,
      role: data.role || "recruiter",
      jobsCreated: 0,
      applicantsScreened: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ recruiterId, success: true }, { status: 201 });
  } catch (error) {
    console.error("Error in recruiter signup:", error);
    return NextResponse.json(
      { error: "Failed to create recruiter profile" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { recruiterService } from "@/services/recruiter/recruiter.service";
import { applicantService } from "@/services/recruiter/applicant.service";

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

    const formData = await request.formData();
    const jobId = formData.get("jobId") as string;
    const file = formData.get("file") as File;

    if (!jobId || !file) {
      return NextResponse.json(
        { error: "jobId and file are required" },
        { status: 400 }
      );
    }

    const csvText = await file.text();
    const lines = csvText.split("\n").map((l) => l.trim()).filter(Boolean);

    if (lines.length < 2) {
      return NextResponse.json(
        { error: "CSV must have a header row and at least one data row" },
        { status: 400 }
      );
    }

    // Parse header to find column indices
    const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
    const nameIdx = header.findIndex((h) => h.includes("name"));
    const emailIdx = header.findIndex((h) => h.includes("email"));
    const resumeIdx = header.findIndex((h) => h.includes("resume"));

    if (nameIdx === -1 || emailIdx === -1) {
      return NextResponse.json(
        { error: "CSV must have 'name' and 'email' columns" },
        { status: 400 }
      );
    }

    const applicants: Array<{ name: string; email: string; resumeUrl?: string }> = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim());
      const name = cols[nameIdx];
      const email = cols[emailIdx];
      const resumeUrl = resumeIdx >= 0 ? cols[resumeIdx] : undefined;

      if (name && email && email.includes("@")) {
        applicants.push({ name, email, resumeUrl });
      }
    }

    const result = await applicantService.importApplicants(jobId, applicants);

    await recruiterService.incrementApplicantCount(recruiter.id!, result.imported);

    return NextResponse.json(
      {
        success: true,
        imported: result.imported,
        failed: result.failed,
        duplicates: result.duplicates,
        total: applicants.length,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error importing applicants:", error);
    return NextResponse.json(
      { error: "Failed to import applicants" },
      { status: 500 }
    );
  }
}

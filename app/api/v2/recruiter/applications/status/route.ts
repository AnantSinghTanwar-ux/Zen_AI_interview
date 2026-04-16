import { NextRequest, NextResponse } from "next/server";
import { recruiterGuard } from "@/app/api/v2/recruiter/_guard";
import { updateApplicationStatus } from "@/services/recruiter/external-application.service";

export async function PATCH(request: NextRequest) {
  const { error } = await recruiterGuard();
  if (error) return error;

  try {
    const { applicationId, status } = await request.json();
    if (!applicationId || !status) {
      return NextResponse.json({ error: "applicationId and status required" }, { status: 400 });
    }

    await updateApplicationStatus(applicationId, { status });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Status update error:", err);
    return NextResponse.json({ error: "Failed", details: (err as Error).message }, { status: 500 });
  }
}

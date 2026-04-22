import { NextRequest, NextResponse } from "next/server";
import { recruiterGuard } from "@/app/api/v2/recruiter/_guard";
import { recruiterService } from "@/services/recruiter/recruiter.service";
import { applicantService } from "@/services/recruiter/applicant.service";
import { jobService } from "@/services/recruiter/job.service";
import { checkRateLimit } from "@/lib/services/rate-limit.service";
import {
  acquireIdempotencyLock,
  completeIdempotencyLock,
  failIdempotencyLock,
  IdempotencyToken,
} from "@/lib/services/idempotency.service";

export async function POST(request: NextRequest) {
  let idempotencyToken: IdempotencyToken | null = null;

  try {
    const { user, error } = await recruiterGuard();
    if (error) return error;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { allowed, response } = await checkRateLimit(request, user.id, "recruiter-write");
    if (!allowed) return response!;

    const idempotency = await acquireIdempotencyLock({
      request,
      userId: user.id,
      scope: "recruiter:applicants:import",
    });

    if (idempotency.state === "invalid") {
      return NextResponse.json({ error: idempotency.error }, { status: 400 });
    }

    if (idempotency.state === "in-progress") {
      return NextResponse.json(
        {
          error: "Idempotent request is already being processed",
          retryAfter: idempotency.retryAfterSeconds,
        },
        {
          status: 409,
          headers: {
            "Retry-After": String(idempotency.retryAfterSeconds),
          },
        }
      );
    }

    if (idempotency.state === "replay") {
      return NextResponse.json(idempotency.body, { status: idempotency.status });
    }

    if (idempotency.state === "acquired") {
      idempotencyToken = idempotency.token;
    }

    const recruiter = await recruiterService.getRecruiterByUserId(user.id);
    if (!recruiter) {
      if (idempotencyToken) {
        await failIdempotencyLock({
          token: idempotencyToken,
          error: "Recruiter profile not found",
        });
      }
      return NextResponse.json(
        { error: "Recruiter profile not found" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const jobId = formData.get("jobId") as string;
    const file = formData.get("file") as File;

    if (!jobId || !file) {
      if (idempotencyToken) {
        await failIdempotencyLock({
          token: idempotencyToken,
          error: "jobId and file are required",
        });
      }
      return NextResponse.json(
        { error: "jobId and file are required" },
        { status: 400 }
      );
    }

    const job = await jobService.getJob(jobId);
    if (!job || job.recruiterId !== recruiter.id) {
      if (idempotencyToken) {
        await failIdempotencyLock({
          token: idempotencyToken,
          error: "Access denied",
        });
      }
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const csvText = await file.text();
    const lines = csvText.split("\n").map((l) => l.trim()).filter(Boolean);

    if (lines.length < 2) {
      if (idempotencyToken) {
        await failIdempotencyLock({
          token: idempotencyToken,
          error: "CSV must have a header row and at least one data row",
        });
      }
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
      if (idempotencyToken) {
        await failIdempotencyLock({
          token: idempotencyToken,
          error: "CSV must have name and email columns",
        });
      }
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

    const payload = {
      success: true,
      imported: result.imported,
      failed: result.failed,
      duplicates: result.duplicates,
      total: applicants.length,
    };

    if (idempotencyToken) {
      await completeIdempotencyLock({
        token: idempotencyToken,
        status: 201,
        body: payload,
      });
    }

    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    console.error("Error importing applicants:", error);

    if (idempotencyToken) {
      await failIdempotencyLock({
        token: idempotencyToken,
        error,
      });
    }

    return NextResponse.json(
      { error: "Failed to import applicants" },
      { status: 500 }
    );
  }
}

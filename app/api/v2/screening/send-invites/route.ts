import { NextRequest, NextResponse } from "next/server";
import { db } from "@/services/firebase/admin";
import {
  sendInterviewInviteEmail,
  hasBrevoKey,
} from "@/services/recruiter/email.service";
import {
  getInterviewDeadline,
  formatDeadline,
} from "@/services/recruiter/interview-token.service";
import {
  COLLECTION_BULK_JOBS,
  COLLECTION_BULK_CANDIDATES,
} from "@/constants/screening.config";

// ─── POST /api/v2/screening/send-invites ────────────────────────────────────
//
// Sends interview invitation emails to all shortlisted candidates
// for a given bulk screening job. Triggered by the recruiter clicking
// the "Send Invites" button.
//
// Body (JSON):
//   - bulkJobId: string (required)

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { bulkJobId } = await req.json();

    if (!bulkJobId) {
      return NextResponse.json({ error: "bulkJobId is required" }, { status: 400 });
    }

    if (!hasBrevoKey()) {
      return NextResponse.json({ error: "Email service (Brevo) is not configured" }, { status: 500 });
    }

    // Fetch the bulk job
    const jobDoc = await db.collection(COLLECTION_BULK_JOBS).doc(bulkJobId).get();
    if (!jobDoc.exists) {
      return NextResponse.json({ error: "Screening job not found" }, { status: 404 });
    }
    const jobData = jobDoc.data()!;

    // Fetch the recruitment job for title/company
    const recruitmentJobDoc = await db.collection("jobs").doc(jobData.jobId).get();
    if (!recruitmentJobDoc.exists) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const recruitmentJob = recruitmentJobDoc.data()!;

    // Fetch all shortlisted candidates who haven't been emailed yet
    const candidatesSnap = await db
      .collection(COLLECTION_BULK_CANDIDATES)
      .where("bulkJobId", "==", bulkJobId)
      .where("isShortlisted", "==", true)
      .get();

    const candidates = candidatesSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((c: any) => c.email && !c.emailSentAt); // Only candidates with email and not yet emailed

    if (candidates.length === 0) {
      return NextResponse.json({
        message: "No candidates to email. Either all have been emailed already or no candidates have extractable emails.",
        sent: 0,
        failed: 0,
      });
    }

    const deadline = getInterviewDeadline();
    const deadlineStr = formatDeadline(deadline);

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const candidate of candidates as any[]) {
      try {
        const emailResult = await sendInterviewInviteEmail({
          to: candidate.email,
          candidateName: candidate.name || "Candidate",
          jobTitle: recruitmentJob.title || "Position",
          companyName: recruitmentJob.companyName || "Our Company",
          interviewLink: candidate.interviewLink || "",
          deadline: deadlineStr,
        });

        if (emailResult.success) {
          sent++;
          await db.collection(COLLECTION_BULK_CANDIDATES).doc(candidate.id).update({
            emailSentAt: new Date().toISOString(),
            emailId: emailResult.emailId,
          });
        } else {
          failed++;
          errors.push(`${candidate.email}: ${emailResult.error}`);
        }

        // Rate limit: small delay between emails
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
      } catch (err) {
        failed++;
        errors.push(`${candidate.email}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Update the bulk job progress
    await db.collection(COLLECTION_BULK_JOBS).doc(bulkJobId).update({
      "progress.emailed": (jobData.progress?.emailed || 0) + sent,
      "progress.emailFailed": (jobData.progress?.emailFailed || 0) + failed,
    });

    return NextResponse.json({
      message: `Sent ${sent} invitation emails. ${failed > 0 ? `${failed} failed.` : ""}`,
      sent,
      failed,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
    });
  } catch (err) {
    console.error("[SendInvites] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send invites" },
      { status: 500 }
    );
  }
}

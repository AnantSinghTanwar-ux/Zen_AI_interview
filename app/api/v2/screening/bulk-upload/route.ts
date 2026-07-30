import { NextRequest, NextResponse } from "next/server";
import { db } from "@/services/firebase/admin";
import {
  extractTextFromBuffer,
  extractContacts,
  isResumeTextValid,
} from "@/services/recruiter/resume-extractor.service";
import {
  batchScoreCandidates,
  selectTopNCandidates,
} from "@/services/recruiter/batch-scoring.service";
import {
  sendInterviewInviteEmail,
  hasBrevoKey,
} from "@/services/recruiter/email.service";
import {
  generateInterviewToken,
  buildInterviewLink,
  getInterviewDeadline,
  formatDeadline,
} from "@/services/recruiter/interview-token.service";
import {
  MAX_RESUME_FILE_SIZE,
  ACCEPTED_RESUME_EXTENSIONS,
  COLLECTION_BULK_JOBS,
  COLLECTION_BULK_CANDIDATES,
} from "@/constants/screening.config";
import type { RecruitmentJob } from "@/types/recruiter";

// ─── POST /api/v2/screening/bulk-upload ─────────────────────────────────────
//
// Serverless-compatible bulk screening pipeline.
// Processes everything inline: extract → score → shortlist → email.
// No Redis or BullMQ required.

export const maxDuration = 300; // Vercel Pro: 5 min timeout

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const jobId = formData.get("jobId") as string;
    const topNStr = formData.get("topN") as string;
    const recruiterId = formData.get("recruiterId") as string || "system";

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId is required" },
        { status: 400 }
      );
    }

    const topN = Math.max(1, Math.min(parseInt(topNStr || "200", 10), 5000));

    // Validate job exists
    const jobDoc = await db.collection("jobs").doc(jobId).get();
    if (!jobDoc.exists) {
      return NextResponse.json(
        { error: "Job not found" },
        { status: 404 }
      );
    }

    const job = { id: jobDoc.id, ...jobDoc.data() } as RecruitmentJob;

    // ── Collect and validate resume files ──
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key === "files" && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No resume files provided" },
        { status: 400 }
      );
    }

    // Validate file types and sizes
    const validFiles: File[] = [];
    const skippedErrors: string[] = [];

    for (const file of files) {
      const ext = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
      if (!ACCEPTED_RESUME_EXTENSIONS.includes(ext)) {
        skippedErrors.push(`${file.name}: unsupported type`);
        continue;
      }
      if (file.size > MAX_RESUME_FILE_SIZE) {
        skippedErrors.push(`${file.name}: too large`);
        continue;
      }
      if (file.size === 0) {
        skippedErrors.push(`${file.name}: empty file`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) {
      return NextResponse.json(
        { error: "No valid resume files", details: skippedErrors },
        { status: 400 }
      );
    }

    // ── Create bulk screening job in Firestore ──
    const now = new Date().toISOString();
    const bulkJobRef = db.collection(COLLECTION_BULK_JOBS).doc();
    await bulkJobRef.set({
      recruiterId,
      jobId,
      totalResumes: validFiles.length,
      topN,
      stage: "extracting",
      progress: {
        extracted: 0,
        extractionFailed: 0,
        embedded: 0,
        semanticFiltered: 0,
        llmScored: 0,
        shortlisted: 0,
        emailed: 0,
        emailFailed: 0,
      },
      semanticFilterMultiplier: 2,
      createdAt: now,
      startedAt: now,
      completedAt: null,
      error: null,
    });

    // ── STAGE 1: Extract text and contacts from each resume ──
    const extractedCandidates: Array<{
      docId: string;
      name: string | null;
      email: string | null;
      phone: string | null;
      linkedIn: string | null;
      resumeText: string;
      fileName: string;
    }> = [];

    let extractionFailed = 0;

    for (const file of validFiles) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const text = await extractTextFromBuffer(buffer, file.name);

        if (!isResumeTextValid(text)) {
          extractionFailed++;
          continue;
        }

        const contacts = extractContacts(text);

        // Save candidate to Firestore
        const candidateRef = db.collection(COLLECTION_BULK_CANDIDATES).doc();
        await candidateRef.set({
          bulkJobId: bulkJobRef.id,
          jobId,
          fileName: file.name,
          email: contacts.email,
          phone: contacts.phone,
          name: contacts.name,
          linkedIn: contacts.linkedIn,
          resumeText: text,
          resumeStorageUrl: "",
          embeddingVector: null,
          semanticScore: null,
          llmScore: null,
          skillMatchPercent: null,
          recommendation: null,
          assessmentSummary: null,
          matchedSkills: [],
          missingSkills: [],
          interviewToken: null,
          interviewLink: null,
          emailSentAt: null,
          emailId: null,
          isShortlisted: false,
          createdAt: now,
        });

        extractedCandidates.push({
          docId: candidateRef.id,
          name: contacts.name,
          email: contacts.email,
          phone: contacts.phone,
          linkedIn: contacts.linkedIn,
          resumeText: text,
          fileName: file.name,
        });
      } catch (err) {
        extractionFailed++;
        console.error(`[BulkUpload] Extraction failed for ${file.name}:`, err);
      }
    }

    // Update progress
    await bulkJobRef.update({
      stage: "llm_scoring",
      "progress.extracted": extractedCandidates.length,
      "progress.extractionFailed": extractionFailed,
    });

    if (extractedCandidates.length === 0) {
      await bulkJobRef.update({ stage: "failed", error: "No resumes could be extracted" });
      return NextResponse.json({
        bulkJobId: bulkJobRef.id,
        error: "No resumes could be extracted",
        totalFiles: files.length,
        validFiles: validFiles.length,
        extracted: 0,
      }, { status: 200 });
    }

    // ── STAGE 2: LLM Scoring ──
    const scoringInput = extractedCandidates.map((c) => ({
      id: c.docId,
      resumeText: c.resumeText,
    }));

    const scores = await batchScoreCandidates(scoringInput, job, 3);

    // Persist scores to Firestore
    const BATCH_SIZE = 490;
    for (let i = 0; i < scores.length; i += BATCH_SIZE) {
      const chunk = scores.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const score of chunk) {
        if (score.error) continue;
        const ref = db.collection(COLLECTION_BULK_CANDIDATES).doc(score.candidateId);
        batch.update(ref, {
          llmScore: score.overallScore,
          skillMatchPercent: score.skillMatchPercent,
          matchedSkills: score.matchedSkills,
          missingSkills: score.missingSkills,
          recommendation: score.recommendation,
          assessmentSummary: score.assessmentSummary,
        });
      }
      await batch.commit();
    }

    await bulkJobRef.update({
      "progress.llmScored": scores.filter((s) => !s.error).length,
    });

    // ── STAGE 3: Select top N and shortlist ──
    const topCandidateIds = selectTopNCandidates(scores, topN);

    // Mark shortlisted candidates
    for (let i = 0; i < topCandidateIds.length; i += BATCH_SIZE) {
      const chunk = topCandidateIds.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const candidateId of chunk) {
        const ref = db.collection(COLLECTION_BULK_CANDIDATES).doc(candidateId);
        batch.update(ref, { isShortlisted: true });
      }
      await batch.commit();
    }

    await bulkJobRef.update({
      stage: "emailing",
      "progress.shortlisted": topCandidateIds.length,
    });

    // ── STAGE 4: Email shortlisted candidates ──
    let emailed = 0;
    let emailFailed = 0;

    if (hasBrevoKey()) {
      const deadline = getInterviewDeadline();
      const deadlineStr = formatDeadline(deadline);

      for (const candidateId of topCandidateIds) {
        const candidate = extractedCandidates.find((c) => c.docId === candidateId);
        if (!candidate || !candidate.email) {
          emailFailed++;
          continue;
        }

        try {
          const token = generateInterviewToken(candidateId, jobId, bulkJobRef.id);
          const interviewLink = buildInterviewLink(token);

          // Update candidate with interview info
          await db.collection(COLLECTION_BULK_CANDIDATES).doc(candidateId).update({
            interviewToken: token,
            interviewLink,
          });

          // Send email
          const emailResult = await sendInterviewInviteEmail({
            to: candidate.email,
            candidateName: candidate.name || "Candidate",
            jobTitle: job.title,
            companyName: job.companyName || "Our Company",
            interviewLink,
            deadline: deadlineStr,
          });

          if (emailResult.success) {
            emailed++;
            await db.collection(COLLECTION_BULK_CANDIDATES).doc(candidateId).update({
              emailSentAt: new Date().toISOString(),
              emailId: emailResult.emailId,
            });
          } else {
            emailFailed++;
            console.error(`[BulkUpload] Email failed for ${candidate.email}: ${emailResult.error}`);
          }

          // Small delay between emails to respect rate limits
          await new Promise<void>((resolve) => setTimeout(resolve, 100));
        } catch (err) {
          emailFailed++;
          console.error(`[BulkUpload] Email error for ${candidate.email}:`, err);
        }
      }
    } else {
      // No email service configured — still generate tokens/links
      const deadline = getInterviewDeadline();
      for (const candidateId of topCandidateIds) {
        const token = generateInterviewToken(candidateId, jobId, bulkJobRef.id);
        const interviewLink = buildInterviewLink(token);
        await db.collection(COLLECTION_BULK_CANDIDATES).doc(candidateId).update({
          interviewToken: token,
          interviewLink,
        });
      }
    }

    // ── FINALIZE ──
    await bulkJobRef.update({
      stage: "completed",
      "progress.emailed": emailed,
      "progress.emailFailed": emailFailed,
      completedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      bulkJobId: bulkJobRef.id,
      totalFiles: files.length,
      validFiles: validFiles.length,
      extracted: extractedCandidates.length,
      extractionFailed,
      scored: scores.filter((s) => !s.error).length,
      shortlisted: topCandidateIds.length,
      emailed,
      emailFailed,
      skipped: skippedErrors.length,
      errors: skippedErrors.length > 0 ? skippedErrors.slice(0, 20) : undefined,
      message: `Screening complete: ${topCandidateIds.length} candidates shortlisted, ${emailed} emailed.`,
      stage: "completed",
    });
  } catch (err) {
    console.error("[BulkUpload] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

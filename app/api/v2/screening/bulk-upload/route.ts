import { NextRequest, NextResponse } from "next/server";
import { db } from "@/services/firebase/admin";
import {
  extractContacts,
} from "@/services/recruiter/resume-extractor.service";
import {
  batchScoreCandidates,
  selectTopNCandidates,
} from "@/services/recruiter/batch-scoring.service";
import {
  generateInterviewToken,
  buildInterviewLink,
} from "@/services/recruiter/interview-token.service";
import {
  MAX_RESUME_FILE_SIZE,
  ACCEPTED_RESUME_EXTENSIONS,
  COLLECTION_BULK_JOBS,
  COLLECTION_BULK_CANDIDATES,
  MAX_RESUME_LENGTH,
} from "@/constants/screening.config";
import type { RecruitmentJob } from "@/types/recruiter";

// ─── POST /api/v2/screening/bulk-upload ─────────────────────────────────────
//
// Serverless-compatible bulk screening pipeline.
// Processes everything inline: extract → score → shortlist.
// Emailing is done separately via a dedicated button/endpoint.

export const maxDuration = 300; // Vercel Pro: 5 min timeout

/**
 * Robust text extraction that handles PDF, DOCX, and TXT.
 * Each extractor is wrapped individually to prevent one failure from killing the whole pipeline.
 */
async function extractTextSafe(buffer: Buffer, fileName: string): Promise<string> {
  const ext = fileName.toLowerCase().split(".").pop() || "";

  try {
    if (ext === "pdf") {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const uint8 = new Uint8Array(buffer);
      const doc = await pdfjs.getDocument({ data: uint8 }).promise;
      const pages: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        const text = content.items
          .map((item: any) => ("str" in item ? item.str : ""))
          .join(" ");
        pages.push(text);
      }
      return pages.join("\n").trim().slice(0, MAX_RESUME_LENGTH);
    }

    if (ext === "docx" || ext === "doc") {
      try {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        return (result.value || "").trim().slice(0, MAX_RESUME_LENGTH);
      } catch (docxErr) {
        console.error(`[Extract] mammoth failed for ${fileName}, trying raw text fallback:`, docxErr);
        // Fallback: try to extract any readable text from the buffer
        const rawText = buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]/g, " ").replace(/\s+/g, " ").trim();
        if (rawText.length > 50) return rawText.slice(0, MAX_RESUME_LENGTH);
        throw docxErr;
      }
    }

    if (ext === "txt") {
      return buffer.toString("utf-8").trim().slice(0, MAX_RESUME_LENGTH);
    }

    throw new Error(`Unsupported file type: .${ext}`);
  } catch (err) {
    console.error(`[Extract] Failed for ${fileName}:`, err);
    throw err;
  }
}

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

    // ── Collect ALL resume files from formData ──
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
    const extractionErrors: string[] = [];

    // Read all file buffers first to avoid stream-already-consumed issues
    const fileBuffers: Array<{ file: File; buffer: Buffer }> = [];
    for (const file of validFiles) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        fileBuffers.push({ file, buffer });
      } catch (err) {
        extractionFailed++;
        extractionErrors.push(`${file.name}: failed to read file`);
        console.error(`[BulkUpload] Failed to read ${file.name}:`, err);
      }
    }

    // Extract text from each file
    for (const { file, buffer } of fileBuffers) {
      try {
        const text = await extractTextSafe(buffer, file.name);

        if (!text || text.trim().length < 30) {
          extractionFailed++;
          extractionErrors.push(`${file.name}: text too short (${text?.length || 0} chars)`);
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
        const errMsg = err instanceof Error ? err.message : String(err);
        extractionErrors.push(`${file.name}: ${errMsg}`);
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
        extractionErrors,
        totalFiles: files.length,
        validFiles: validFiles.length,
        extracted: 0,
        stage: "completed",
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

    // ── STAGE 3: Select top N and shortlist + generate interview links ──
    const topCandidateIds = selectTopNCandidates(scores, topN);

    // Mark shortlisted candidates and generate interview tokens/links
    for (let i = 0; i < topCandidateIds.length; i += BATCH_SIZE) {
      const chunk = topCandidateIds.slice(i, i + BATCH_SIZE);
      const batch = db.batch();
      for (const candidateId of chunk) {
        const token = generateInterviewToken(candidateId, jobId, bulkJobRef.id);
        const interviewLink = buildInterviewLink(token);
        const ref = db.collection(COLLECTION_BULK_CANDIDATES).doc(candidateId);
        batch.update(ref, {
          isShortlisted: true,
          interviewToken: token,
          interviewLink,
        });
      }
      await batch.commit();
    }

    // ── FINALIZE ──
    await bulkJobRef.update({
      stage: "completed",
      "progress.shortlisted": topCandidateIds.length,
      completedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      bulkJobId: bulkJobRef.id,
      totalFiles: files.length,
      validFiles: validFiles.length,
      extracted: extractedCandidates.length,
      extractionFailed,
      extractionErrors: extractionErrors.length > 0 ? extractionErrors : undefined,
      scored: scores.filter((s) => !s.error).length,
      shortlisted: topCandidateIds.length,
      skipped: skippedErrors.length,
      errors: skippedErrors.length > 0 ? skippedErrors.slice(0, 20) : undefined,
      message: `Screening complete: ${extractedCandidates.length} extracted, ${topCandidateIds.length} shortlisted. Use "Send Invites" to email candidates.`,
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

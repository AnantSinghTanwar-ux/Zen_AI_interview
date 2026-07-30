import { NextRequest, NextResponse } from "next/server";
import { db } from "@/services/firebase/admin";
import { getExtractionQueue } from "@/services/queue/queue.config";
import type { ExtractionJobData } from "@/services/queue/queue.config";
import {
  MAX_BULK_UPLOAD_COUNT,
  MAX_RESUME_FILE_SIZE,
  ACCEPTED_RESUME_EXTENSIONS,
  COLLECTION_BULK_JOBS,
  REDIS_PROGRESS_KEY_PREFIX,
} from "@/constants/screening.config";
import { createClient } from "redis";

// ─── POST /api/v2/screening/bulk-upload ─────────────────────────────────────
//
// Accepts a batch of resume files via multipart/form-data.
// Creates a BulkScreeningJob and enqueues extraction jobs for each file.
//
// Body (multipart):
//   - jobId: string (required) — recruitment job to screen against
//   - topN: string (required) — number of candidates to shortlist
//   - files: File[] (required) — resume files (.pdf, .docx, .txt)

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

    // Collect all resume files from the form data
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

    if (files.length > MAX_BULK_UPLOAD_COUNT) {
      return NextResponse.json(
        {
          error: `Maximum ${MAX_BULK_UPLOAD_COUNT} files allowed per batch`,
        },
        { status: 400 }
      );
    }

    // Validate file types and sizes
    const validFiles: { file: File; index: number }[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;

      if (!ACCEPTED_RESUME_EXTENSIONS.includes(ext)) {
        errors.push(
          `${file.name}: Unsupported file type. Accepted: ${ACCEPTED_RESUME_EXTENSIONS.join(", ")}`
        );
        continue;
      }

      if (file.size > MAX_RESUME_FILE_SIZE) {
        errors.push(
          `${file.name}: File too large (max ${Math.round(MAX_RESUME_FILE_SIZE / 1024 / 1024)}MB)`
        );
        continue;
      }

      if (file.size === 0) {
        errors.push(`${file.name}: Empty file`);
        continue;
      }

      validFiles.push({ file, index: i });
    }

    if (validFiles.length === 0) {
      return NextResponse.json(
        { error: "No valid resume files found", details: errors },
        { status: 400 }
      );
    }

    // Create the bulk screening job in Firestore
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

    // Initialize progress in Redis
    const redis = createClient({
      url: process.env.REDIS_URL || process.env.KV_URL || "redis://localhost:6379",
    });
    await redis.connect();
    await redis.set(
      `${REDIS_PROGRESS_KEY_PREFIX}${bulkJobRef.id}`,
      JSON.stringify({
        jobId: bulkJobRef.id,
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
        totalResumes: validFiles.length,
        topN,
        message: "Starting resume extraction...",
        estimatedSecondsRemaining: -1,
      }),
      { EX: 86400 }
    );
    await redis.quit();

    // Enqueue extraction jobs for each valid file
    const extractionQueue = getExtractionQueue();
    let enqueued = 0;

    for (const { file, index } of validFiles) {
      try {
        // Read file into buffer and encode as base64
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileContent = buffer.toString("base64");

        await extractionQueue.add(`extract-${bulkJobRef.id}-${index}`, {
          bulkJobId: bulkJobRef.id,
          jobId,
          fileName: file.name,
          fileContent,
          candidateIndex: index,
        } as ExtractionJobData);

        enqueued++;
      } catch (err) {
        errors.push(
          `${file.name}: Failed to enqueue — ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return NextResponse.json({
      bulkJobId: bulkJobRef.id,
      totalFiles: files.length,
      validFiles: validFiles.length,
      enqueued,
      topN,
      skipped: errors.length,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
      message: `Screening started: ${enqueued} resumes queued for processing.`,
    });
  } catch (err) {
    console.error("[BulkUpload] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

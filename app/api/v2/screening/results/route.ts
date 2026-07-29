import { NextRequest, NextResponse } from "next/server";
import { db } from "@/services/firebase/admin";
import {
  COLLECTION_BULK_JOBS,
  COLLECTION_BULK_CANDIDATES,
} from "@/constants/screening.config";
import type { ScreenedCandidateRow } from "@/types/bulk-screening";

// ─── GET /api/v2/screening/results?bulkJobId=xxx ────────────────────────────
//
// Returns the ranked candidate results for a completed bulk screening job.
// Supports pagination, sorting, and filtering.
//
// Query params:
//   - bulkJobId (required)
//   - page (default: 1)
//   - pageSize (default: 50, max: 200)
//   - sortBy (default: "llmScore") — llmScore | semanticScore | name
//   - sortOrder (default: "desc") — asc | desc
//   - shortlistedOnly (default: false)
//   - search — text search on name/email

export async function GET(req: NextRequest) {
  const bulkJobId = req.nextUrl.searchParams.get("bulkJobId");

  if (!bulkJobId) {
    return NextResponse.json(
      { error: "bulkJobId is required" },
      { status: 400 }
    );
  }

  // Verify bulk job exists
  const jobDoc = await db.collection(COLLECTION_BULK_JOBS).doc(bulkJobId).get();
  if (!jobDoc.exists) {
    return NextResponse.json(
      { error: "Bulk screening job not found" },
      { status: 404 }
    );
  }

  const jobData = jobDoc.data()!;

  // Parse pagination params
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    200,
    Math.max(1, parseInt(req.nextUrl.searchParams.get("pageSize") || "50", 10))
  );
  const sortBy = req.nextUrl.searchParams.get("sortBy") || "llmScore";
  const sortOrder = req.nextUrl.searchParams.get("sortOrder") || "desc";
  const shortlistedOnly = req.nextUrl.searchParams.get("shortlistedOnly") === "true";
  const search = (req.nextUrl.searchParams.get("search") || "").toLowerCase().trim();

  // Fetch candidates
  let query: FirebaseFirestore.Query = db
    .collection(COLLECTION_BULK_CANDIDATES)
    .where("bulkJobId", "==", bulkJobId);

  if (shortlistedOnly) {
    query = query.where("isShortlisted", "==", true);
  }

  const snapshot = await query.get();

  let candidates: ScreenedCandidateRow[] = snapshot.docs.map((doc, index) => {
    const data = doc.data();
    return {
      id: doc.id,
      rank: 0, // Will be assigned after sorting
      name: data.name || null,
      email: data.email || null,
      phone: data.phone || null,
      linkedIn: data.linkedIn || null,
      fileName: data.fileName || "",
      semanticScore: data.semanticScore ?? null,
      llmScore: data.llmScore ?? null,
      skillMatchPercent: data.skillMatchPercent ?? null,
      recommendation: data.recommendation || null,
      assessmentSummary: data.assessmentSummary || null,
      matchedSkills: data.matchedSkills || [],
      missingSkills: data.missingSkills || [],
      isShortlisted: data.isShortlisted || false,
      emailSentAt: data.emailSentAt || null,
      interviewLink: data.interviewLink || null,
    };
  });

  // Apply text search filter
  if (search) {
    candidates = candidates.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(search)) ||
        (c.email && c.email.toLowerCase().includes(search)) ||
        c.fileName.toLowerCase().includes(search)
    );
  }

  // Sort
  candidates.sort((a, b) => {
    let valueA: number | string | null;
    let valueB: number | string | null;

    switch (sortBy) {
      case "semanticScore":
        valueA = a.semanticScore ?? -1;
        valueB = b.semanticScore ?? -1;
        break;
      case "name":
        valueA = a.name || "";
        valueB = b.name || "";
        break;
      case "skillMatchPercent":
        valueA = a.skillMatchPercent ?? -1;
        valueB = b.skillMatchPercent ?? -1;
        break;
      case "llmScore":
      default:
        valueA = a.llmScore ?? -1;
        valueB = b.llmScore ?? -1;
        break;
    }

    if (typeof valueA === "string" && typeof valueB === "string") {
      return sortOrder === "asc"
        ? valueA.localeCompare(valueB)
        : valueB.localeCompare(valueA);
    }

    return sortOrder === "asc"
      ? (valueA as number) - (valueB as number)
      : (valueB as number) - (valueA as number);
  });

  // Assign ranks
  candidates.forEach((c, i) => {
    c.rank = i + 1;
  });

  // Paginate
  const totalCandidates = candidates.length;
  const totalPages = Math.ceil(totalCandidates / pageSize);
  const paginatedCandidates = candidates.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  // Summary stats
  const shortlistedCount = candidates.filter((c) => c.isShortlisted).length;
  const emailedCount = candidates.filter((c) => c.emailSentAt).length;
  const avgScore =
    candidates.length > 0
      ? Math.round(
          candidates.reduce((sum, c) => sum + (c.llmScore || 0), 0) /
            candidates.length
        )
      : 0;

  return NextResponse.json({
    bulkJobId,
    stage: jobData.stage,
    totalResumes: jobData.totalResumes,
    topN: jobData.topN,
    candidates: paginatedCandidates,
    pagination: {
      page,
      pageSize,
      totalCandidates,
      totalPages,
    },
    stats: {
      totalCandidates,
      shortlistedCount,
      emailedCount,
      averageScore: avgScore,
    },
  });
}

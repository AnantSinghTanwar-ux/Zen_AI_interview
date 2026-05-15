import { NextResponse } from "next/server";
import { recruiterGuard } from "@/app/api/v2/recruiter/_guard";
import { db } from "@/services/firebase/admin";
import { checkRateLimit } from "@/lib/services/rate-limit.service";

/**
 * GET /api/v2/recruiter/talent-pool
 * Returns candidates who opted-in for recruiter visibility (paid ₹30).
 * Filterable by role only. These are candidates from callLogs, not from
 * the extension-based external applications.
 */
export async function GET(request: Request) {
  const { user, error } = await recruiterGuard();
  if (error) return error;

  const { allowed, response } = await checkRateLimit(request, user.id, "recruiter-read");
  if (!allowed) return response;

  try {
    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get("role") || "";

    // Query callLogs where recruiterVisible is true
    let query = db
      .collection("callLogs")
      .where("recruiterVisible", "==", true)
      .orderBy("createdAt", "desc")
      .limit(200);

    const snapshot = await query.get();

    const candidates = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId || "",
        userName: data.userName || data.candidateName || "Anonymous",
        userEmail: data.userEmail || data.candidateEmail || "",
        role: data.jobRole || data.roleTitle || data.interviewType || "General",
        interviewType: data.interviewType || "interview",
        overallScore: data.overallScore || data.score?.overallScore || 0,
        technicalScore: data.technicalScore || data.score?.technicalScore || 0,
        communicationScore: data.communicationScore || data.score?.communicationScore || 0,
        problemSolvingScore: data.problemSolvingScore || data.score?.problemSolvingScore || 0,
        recommendation: data.recommendation || data.score?.recommendation || "pending",
        feedbackSummary: data.feedbackSummary || data.score?.feedbackSummary || "",
        strengths: data.strengths || data.score?.strengths || [],
        weaknesses: data.weaknesses || data.score?.weaknesses || [],
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    });

    // Apply role filter client-side (Firestore doesn't support substring matching)
    const filtered = roleFilter
      ? candidates.filter((c) =>
          c.role.toLowerCase().includes(roleFilter.toLowerCase())
        )
      : candidates;

    // Sort by overall score descending
    filtered.sort((a, b) => b.overallScore - a.overallScore);

    // Get unique roles for filter dropdown
    const roles = [...new Set(candidates.map((c) => c.role).filter(Boolean))];

    return NextResponse.json({
      candidates: filtered,
      roles,
      total: filtered.length,
    });
  } catch (err) {
    console.error("Talent pool error:", err);
    return NextResponse.json(
      { error: "Failed to fetch talent pool" },
      { status: 500 }
    );
  }
}

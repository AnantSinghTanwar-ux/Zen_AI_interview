import { NextRequest, NextResponse } from "next/server";
import { recruiterGuard } from "@/app/api/v2/recruiter/_guard";
import { getLeaderboard } from "@/services/recruiter/application-score.service";
import { checkRateLimit } from "@/lib/services/rate-limit.service";
import * as XLSX from "xlsx";

/**
 * POST /api/v2/recruiter/hiring-export
 * Export top N candidates as an Excel sheet (.xlsx) for recruiter download.
 * 
 * Body: {
 *   count: number,          // number of top candidates to export
 *   roleCategory?: string,  // optional filter
 *   companyName?: string,    // optional filter
 *   minScore?: number,       // optional minimum score filter
 * }
 */
export async function POST(request: NextRequest) {
  const { user, error } = await recruiterGuard();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed, response } = await checkRateLimit(request, user.id, "recruiter-read");
  if (!allowed) return response!;

  try {
    const body = await request.json();
    const count = Math.max(1, Math.min(500, Number(body.count) || 10));
    const roleCategory = body.roleCategory || undefined;
    const companyName = body.companyName || undefined;
    const sourcePlatform = body.sourcePlatform || undefined;
    const minScore = Number(body.minScore) || 0;

    const leaderboard = await getLeaderboard({ roleCategory, companyName, sourcePlatform });

    // Apply minimum score filter
    let filtered = leaderboard;
    if (minScore > 0) {
      filtered = filtered.filter((e) => e.overallScore >= minScore);
    }

    // Take top N
    const topCandidates = filtered.slice(0, count);

    if (topCandidates.length === 0) {
      return NextResponse.json(
        { error: "No candidates match the specified criteria" },
        { status: 400 }
      );
    }

    const sheetHeaders = [
      "Rank",
      "Name",
      "Email",
      "Role",
      "Company",
      "Source",
      "Overall Score",
      "Technical Score",
      "Communication Score",
      "Problem Solving Score",
      "Recommendation",
    ];

    const sheetRows = topCandidates.map((c) => [
      c.rank,
      c.candidateName || "",
      c.candidateEmail || "",
      c.roleTitle || "",
      c.companyName || "",
      c.sourcePlatform || "",
      c.overallScore,
      c.technicalScore,
      c.communicationScore,
      c.problemSolvingScore,
      c.recommendation,
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([sheetHeaders, ...sheetRows]);
    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 24 },
      { wch: 30 },
      { wch: 24 },
      { wch: 20 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 20 },
      { wch: 22 },
      { wch: 18 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Top Candidates");
    const fileData = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

    return new NextResponse(fileData, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="zenai_top_${count}_candidates_${Date.now()}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("Hiring export error:", err);
    return NextResponse.json(
      { error: "Failed to export", details: (err as Error).message },
      { status: 500 }
    );
  }
}

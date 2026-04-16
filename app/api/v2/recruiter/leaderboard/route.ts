import { NextRequest, NextResponse } from "next/server";
import { recruiterGuard } from "@/app/api/v2/recruiter/_guard";
import { getLeaderboard } from "@/services/recruiter/application-score.service";

export async function GET(request: NextRequest) {
  const { error } = await recruiterGuard();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const roleCategory = searchParams.get("roleCategory") || undefined;
    const companyName = searchParams.get("companyName") || undefined;
    const sourcePlatform = searchParams.get("sourcePlatform") || undefined;

    const leaderboard = await getLeaderboard({ roleCategory, companyName, sourcePlatform });

    return NextResponse.json({ leaderboard, total: leaderboard.length }, { status: 200 });
  } catch (err) {
    console.error("Leaderboard error:", err);
    return NextResponse.json({ error: "Failed", details: (err as Error).message }, { status: 500 });
  }
}

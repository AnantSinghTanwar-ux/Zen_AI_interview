import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { schedulingService } from "@/services/recruiter/scheduling.service";

/**
 * GET /api/v2/candidate/schedule — Get scheduled interviews for the current user.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const schedules = await schedulingService.getSchedulesByCandidate(user.id);

    // Only return non-cancelled future interviews plus recent completed ones
    const now = Date.now();
    const relevant = schedules.filter((s) => {
      if (s.status === "cancelled") return false;
      if (s.status === "completed") {
        // Show completed interviews from the last 30 days
        return new Date(s.scheduledAt).getTime() > now - 30 * 24 * 60 * 60 * 1000;
      }
      return true;
    });

    return NextResponse.json({ schedules: relevant });
  } catch (error) {
    console.error("[GET /api/v2/candidate/schedule] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch schedule" },
      { status: 500 }
    );
  }
}

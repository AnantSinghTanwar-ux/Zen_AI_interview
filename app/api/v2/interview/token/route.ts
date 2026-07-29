import { NextRequest, NextResponse } from "next/server";
import {
  hasLiveKitConfig,
  prepareInterviewSession,
} from "@/services/interview/livekit.service";

// ─── POST /api/v2/interview/token ───────────────────────────────────────────
//
// Generates a LiveKit room token for a candidate joining an interview.
//
// Body (JSON):
//   - candidateId: string (required)
//   - candidateName: string (required)
//   - jobId: string (required)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { candidateId, candidateName, jobId } = body;

    if (!candidateId || !candidateName || !jobId) {
      return NextResponse.json(
        { error: "candidateId, candidateName, and jobId are required" },
        { status: 400 }
      );
    }

    if (!hasLiveKitConfig()) {
      return NextResponse.json(
        {
          error:
            "LiveKit is not configured. Set LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET.",
        },
        { status: 503 }
      );
    }

    const session = prepareInterviewSession({
      candidateId: String(candidateId),
      candidateName: String(candidateName).slice(0, 200),
      jobId: String(jobId),
    });

    return NextResponse.json({
      roomName: session.roomName,
      token: session.candidateToken,
      websocketUrl: session.websocketUrl,
    });
  } catch (err) {
    console.error("[InterviewToken] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

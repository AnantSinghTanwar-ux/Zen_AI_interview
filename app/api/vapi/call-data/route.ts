import { NextRequest, NextResponse } from "next/server";
import { callLogService } from "@/services/firebase/call-log.service";
import { getCurrentUser } from "@/lib/actions/auth.actions";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");

    // Get the current authenticated user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Fetch call logs from Firestore filtered by the current user
    const callLogs = await callLogService.getCallLogsByUser(user.id, limit);

    const processedCalls = callLogs.map((log: any) => ({
      id: log.id,
      status: log.status || "unknown",
      startedAt: log.startedAt || log.createdAt?._seconds
        ? new Date(log.createdAt._seconds * 1000).toISOString()
        : new Date().toISOString(),
      endedAt: log.endedAt || null,
      cost: log.cost || null,
      costBreakdown: log.costBreakdown || null,
      messageCount: log.messageCount || 0,
      hasArtifact: log.hasRecording || log.hasTranscript || false,
    }));

    return NextResponse.json(processedCalls, { status: 200 });

  } catch (error) {
    console.error("Error in call-data API:", error);

    const errorMessage = error instanceof Error ? error.message : "Failed to fetch call data";

    return NextResponse.json({
      error: errorMessage,
      message: "Failed to fetch call data",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

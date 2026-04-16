import { NextRequest, NextResponse } from "next/server";
import { callLogService } from "@/services/firebase/call-log.service";
import { vapiCallDataService } from "@/services/vapi/call-data.service";
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

    const processedCalls = await Promise.all(callLogs.map(async (log: any) => {
      let currentStatus = log.status || "unknown";
      let endedAt = log.endedAt || null;
      let cost = log.cost || null;
      let costBreakdown = log.costBreakdown || null;
      let messageCount = log.messageCount || 0;
      let hasRecording = log.hasRecording || false;
      let hasTranscript = log.hasTranscript || false;

      // Sync with Vapi if the call is still "in-progress" in the database
      if ((currentStatus === "in-progress" || currentStatus === "unknown") && log.vapiCallId) {
        try {
          const vapiData = await vapiCallDataService.getCall(log.vapiCallId);
          if (vapiData && (vapiData.status !== currentStatus || vapiData.endedAt)) {
            currentStatus = vapiData.status || currentStatus;
            endedAt = vapiData.endedAt || endedAt;
            cost = vapiData.cost || cost;
            costBreakdown = vapiData.costBreakdown || costBreakdown;
            messageCount = vapiData.artifact?.messages?.length || messageCount;
            hasRecording = !!(vapiData.artifact?.recordingUrl || vapiData.recordingUrl);
            hasTranscript = !!(vapiData.artifact?.transcript || vapiData.transcript);

            // Update in background
            callLogService.updateCallLog(log.id, {
              status: currentStatus,
              endedAt,
              cost,
              costBreakdown,
              messageCount,
              hasRecording,
              hasTranscript,
            }).catch(e => console.error(`Background update failed for ${log.id}:`, e));
          }
        } catch (syncError) {
          console.warn(`Could not sync stuck document ${log.id} with Vapi:`, syncError);
        }
      }

      return {
        id: log.id,
        vapiCallId: log.vapiCallId || null,
        status: currentStatus,
      startedAt: log.startedAt
        ? log.startedAt
        : log.createdAt?._seconds
          ? new Date(log.createdAt._seconds * 1000).toISOString()
          : new Date().toISOString(),
      endedAt,
      cost,
      costBreakdown,
      messageCount,
      hasArtifact: hasRecording || hasTranscript,
      };
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

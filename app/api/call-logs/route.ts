import { NextRequest, NextResponse } from "next/server";
import { callLogService } from "@/services/firebase/call-log.service";
import { vapiCallDataService } from "@/services/vapi/call-data.service";

export async function POST(request: NextRequest) {
  try {
    const { vapiCallId, userId } = await request.json();

    if (!vapiCallId || !userId) {
      return NextResponse.json(
        { error: "vapiCallId and userId are required" },
        { status: 400 }
      );
    }

    // Check if call log already exists
    const existingLog = await callLogService.getCallLogByVapiId(vapiCallId);
    if (existingLog) {
      return NextResponse.json(
        { message: "Call log already exists", id: existingLog.id },
        { status: 200 }
      );
    }

    // Fetch call data from Vapi
    const vapiCallData = await vapiCallDataService.getCall(vapiCallId);

    // Debug: Log what we received from Vapi
    console.log(
      "Vapi call data received:",
      JSON.stringify(vapiCallData, null, 2)
    );

    // Extract relevant data for Firestore
    const callLogData = {
      userId,
      vapiCallId: vapiCallData.id,
      assistantId: vapiCallData.assistant?.id || null, // Use null instead of undefined
      status: vapiCallData.status || "unknown",
      startedAt: vapiCallData.startedAt || new Date().toISOString(),
      endedAt: vapiCallData.endedAt || null,
      duration:
        vapiCallData.endedAt && vapiCallData.startedAt
          ? Math.round(
              (new Date(vapiCallData.endedAt).getTime() -
                new Date(vapiCallData.startedAt).getTime()) /
                1000
            )
          : null, // Use null instead of undefined
      cost: vapiCallData.cost || null,
      costBreakdown: vapiCallData.costBreakdown || null,
      messageCount: vapiCallData.artifact?.messages?.length || 0,
      hasRecording: !!(
        vapiCallData.artifact?.recordingUrl ||
        (vapiCallData as any).recordingUrl
      ),
      hasTranscript: !!(
        vapiCallData.artifact?.transcript || (vapiCallData as any).transcript
      ),
      summary: (vapiCallData as any).summary || null,
      analysis: (vapiCallData as any).analysis || null,
    };

    console.log(
      "Processed call log data:",
      JSON.stringify(callLogData, null, 2)
    );

    const logId = await callLogService.saveCallLog(callLogData);

    return NextResponse.json({
      success: true,
      message: "Call log saved successfully",
      id: logId,
    });
  } catch (error) {
    console.error("Error saving call log:", error);

    // More detailed error response
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    const errorCode =
      error instanceof Error && "code" in error
        ? (error as any).code
        : undefined;

    return NextResponse.json(
      {
        error: "Failed to save call log",
        details: errorMessage,
        code: errorCode,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const callLogs = await callLogService.getCallLogsByUser(userId, limit);

    return NextResponse.json(callLogs);
  } catch (error) {
    console.error("Error fetching call logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch call logs" },
      { status: 500 }
    );
  }
}

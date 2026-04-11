import { NextRequest, NextResponse } from "next/server";
import { vapiCallDataService } from "@/services/vapi/call-data.service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "5");

    console.log("Testing Vapi API connection...");

    // Test fetching recent calls
    const recentCalls = await vapiCallDataService.getRecentCalls(limit);

    console.log(`Found ${recentCalls.length} recent calls`);

    const callSummaries = recentCalls.map(call => ({
      id: call.id,
      status: call.status,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      assistantId: call.assistant?.id,
      hasArtifact: vapiCallDataService.hasArtifactData(call),
      hasRecording: !!call.artifact?.recordingUrl,
      hasTranscript: !!call.artifact?.transcript,
      messageCount: call.artifact?.messages?.length || 0,
    }));

    return NextResponse.json({
      success: true,
      message: "Vapi API connection successful",
      totalCalls: recentCalls.length,
      calls: callSummaries,
    }, { status: 200 });


  } catch (error) {
    console.error("Vapi API test failed:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      message: "Vapi API connection failed",
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { callId } = await request.json();

    if (!callId) {
      return NextResponse.json({
        success: false,
        error: "callId is required",
      }, { status: 400 });
    }

    console.log(`Testing fetch of specific call: ${callId}`);

    // Test fetching a specific call
    const callData = await vapiCallDataService.getCall(callId);
    const hasArtifact = vapiCallDataService.hasArtifactData(callData);
    const extractedInfo = vapiCallDataService.extractCallInfo(callData);

    return NextResponse.json({
      success: true,
      message: "Call fetch successful",
      callId: callData.id,
      hasArtifact,
      callData: extractedInfo,
    }, { status: 200 });

  } catch (error) {
    console.error("Call fetch test failed:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      message: "Call fetch failed",
    }, { status: 500 });
  }
}

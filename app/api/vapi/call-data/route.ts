import { NextRequest, NextResponse } from "next/server";
import { vapiCallDataService } from "@/services/vapi/call-data.service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");

    console.log(`Fetching ${limit} recent calls...`);
    
    // Check if API key is available
    const hasApiKey = process.env.VAPI_PRIVATE_API_KEY ? "Yes" : "No";
    console.log(`VAPI_PRIVATE_API_KEY available: ${hasApiKey}`);

    const calls = await vapiCallDataService.getRecentCalls(limit);
    
    const processedCalls = calls.map(call => ({
      id: call.id,
      status: call.status,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      cost: call.cost,
      costBreakdown: call.costBreakdown,
      messages: call.artifact?.messages || [],
      hasArtifact: vapiCallDataService.hasArtifactData(call),
      messageCount: call.artifact?.messages?.length || 0,
    }));

    console.log(`Successfully fetched ${processedCalls.length} calls`);

    return NextResponse.json(processedCalls, { status: 200 });

  } catch (error) {
    console.error("Error in call-data API:", error);
    
    // More detailed error logging
    if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch call data";
    
    return NextResponse.json({
      error: errorMessage,
      message: "Failed to fetch call data",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { vapiCallDataService } from '@/services/vapi/call-data.service';
import { emotionDetectionService } from '@/services/emotion/emotion-detection.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const { callId } = await params;

    if (!callId) {
      return NextResponse.json(
        { error: 'Call ID is required' },
        { status: 400 }
      );
    }

    // Get the full call details from VAPI
    const callDetails = await vapiCallDataService.getCall(callId);

    if (!callDetails) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    // Process emotion analysis for the call
    let emotionAnalysis = null;
    if (callDetails.messages && callDetails.messages.length > 0) {
      try {
        console.log(`Processing emotion analysis for call ${callId}...`);
        emotionAnalysis = await emotionDetectionService.analyzeCompleteTranscript(callDetails.messages);
      } catch (error) {
        console.error('Error processing emotion analysis:', error);
        // Continue without emotion analysis if it fails
      }
    }

    // Process and format the call details with emotion data
    const formattedCallDetails = {
      id: callDetails.id,
      status: callDetails.status,
      startedAt: callDetails.startedAt,
      endedAt: callDetails.endedAt,
      cost: callDetails.cost,
      costBreakdown: callDetails.costBreakdown,
      
      // Enhanced messages with emotion data
      messages: callDetails.messages?.map((message: any, index: number) => {
        const emotionData = emotionAnalysis?.emotions?.find(emotion => 
          Math.abs(emotion.secondsFromStart - (message.secondsFromStart || 0)) < 5 &&
          message.role === 'user'
        );

        return {
          role: message.role,
          message: message.message,
          time: message.time,
          timestamp: message.time ? new Date(message.time).toISOString() : null,
          duration: message.duration,
          source: message.source,
          endTime: message.endTime,
          secondsFromStart: message.secondsFromStart,
          emotionData: emotionData || undefined
        };
      }) || [],
      
      // Add emotion analysis to the response
      emotionAnalysis,
      
      // Additional call data
      transcript: (callDetails as any).transcript,
      recordingUrl: (callDetails as any).recordingUrl,
      artifact: (callDetails as any).artifact,
      summary: (callDetails as any).summary,
      analysis: (callDetails as any).analysis,
      
      // Technical details
      assistantId: (callDetails as any).assistantId,
      webCallUrl: (callDetails as any).webCallUrl,
      endedReason: (callDetails as any).endedReason,
      messageCount: callDetails.messages?.length || 0,
      duration: (callDetails as any).duration
    };

    return NextResponse.json(formattedCallDetails, { status: 200 });

  } catch (error) {
    console.error('Error in enhanced call-data API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch call details with emotion analysis' },
      { status: 500 }
    );
  }
}

// New endpoint for real-time emotion processing during calls
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const { callId } = await params;
    const { transcript, timestamp, isPartial } = await request.json();

    if (!callId || !transcript) {
      return NextResponse.json(
        { error: 'Call ID and transcript are required' },
        { status: 400 }
      );
    }

    // Process real-time emotion detection
    const emotionData = await emotionDetectionService.processStreamingMessage(
      transcript,
      timestamp || Date.now(),
      isPartial
    );

    return NextResponse.json({
      success: true,
      emotionData,
      timestamp: Date.now()
    }, { status: 200 });

  } catch (error) {
    console.error('Error processing real-time emotion:', error);
    return NextResponse.json(
      { error: 'Failed to process emotion data' },
      { status: 500 }
    );
  }
}

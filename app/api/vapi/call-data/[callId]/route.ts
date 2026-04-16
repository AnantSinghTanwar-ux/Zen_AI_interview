import { NextRequest, NextResponse } from 'next/server';
import { vapiCallDataService } from '@/services/vapi/call-data.service';
import { emotionDetectionService } from '@/services/emotion/emotion-detection.service';
import { callLogService } from '@/services/firebase/call-log.service';

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

    // The callId from the frontend may be a Firestore document ID OR a Vapi UUID.
    // Strategy: try direct Firestore doc lookup first (O(1)), then Vapi UUID lookup.
    let vapiCallId: string = callId;

    try {
      // Step 1: treat callId as a Firestore document ID
      const firestoreLog = await callLogService.getCallLogById(callId).catch(() => null);
      if (firestoreLog?.vapiCallId) {
        vapiCallId = firestoreLog.vapiCallId;
        console.log(`Resolved Firestore doc ID ${callId} → Vapi UUID ${vapiCallId}`);
      } else {
        // Step 2: callId might already be the Vapi UUID
        const byVapiId = await callLogService.getCallLogByVapiId(callId).catch(() => null);
        if (byVapiId?.vapiCallId) {
          vapiCallId = byVapiId.vapiCallId;
          console.log(`callId ${callId} confirmed as Vapi UUID`);
        } else {
          console.warn(`Could not resolve vapiCallId for "${callId}", using as-is`);
        }
      }
    } catch (lookupError) {
      console.warn('Firestore ID resolution failed, using callId directly:', lookupError);
    }

    // Get the full call details from VAPI using the real UUID
    const callDetails = await vapiCallDataService.getCall(vapiCallId);

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
        console.log(`Processing emotion analysis for call ${vapiCallId}...`);
        emotionAnalysis = await emotionDetectionService.analyzeCompleteTranscript(callDetails.messages);
      } catch (error) {
        console.error('Error processing emotion analysis:', error);
      }
    }

    // Process and format the call details with emotion data
    const formattedCallDetails = {
      id: callId, // Keep the Firestore doc ID for frontend navigation
      vapiCallId,
      status: callDetails.status,
      startedAt: callDetails.startedAt,
      endedAt: callDetails.endedAt,
      cost: callDetails.cost,
      costBreakdown: callDetails.costBreakdown,

      // Enhanced messages with emotion data
      // Vapi can return conversation content in `message` or `content` fields
      messages: callDetails.messages?.map((message: any) => {
        const emotionData = emotionAnalysis?.emotions?.find(emotion =>
          Math.abs(emotion.secondsFromStart - (message.secondsFromStart || 0)) < 5 &&
          message.role === 'user'
        );
        return {
          role: message.role,
          message: message.message || message.content || '',
          time: message.time,
          timestamp: message.time ? new Date(message.time).toISOString() : null,
          duration: message.duration,
          source: message.source,
          endTime: message.endTime,
          secondsFromStart: message.secondsFromStart,
          emotionData: emotionData || undefined,
        };
      }).filter((m: any) => m.role && m.message) || [],

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
      messageCount: callDetails.messages?.filter((m: any) =>
        (m.message || m.content) && m.role !== 'system'
      ).length || 0,
      duration: (callDetails as any).duration,
    };

    return NextResponse.json(formattedCallDetails, { status: 200 });

  } catch (error: any) {
    console.error('Error in call-data detail API:', error);
    
    // If Vapi returns 404, the call might still be processing after a sudden end
    if (error.message && error.message.includes('404')) {
      return NextResponse.json(
        { error: 'Call not yet indexed by Vapi or not found. Please try again in a few seconds.' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch call details', details: error.message },
      { status: 500 }
    );
  }
}

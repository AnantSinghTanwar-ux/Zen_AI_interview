import { NextRequest, NextResponse } from 'next/server';
import { interviewEvaluationService } from '@/services/interview/interview-evaluation.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const resolvedParams = await params;
    console.log('Starting interview evaluation for call:', resolvedParams.callId);
    
    const { callId } = resolvedParams;
    
    if (!callId) {
      console.error('No call ID provided');
      return NextResponse.json(
        { error: 'Call ID is required' },
        { status: 400 }
      );
    }

    // Get request body with call details and messages
    const body = await request.json();
    const { messages, callDetails } = body;

    console.log('Received evaluation request:', {
      callId,
      messageCount: messages?.length || 0,
      hasCallDetails: !!callDetails
    });

    if (!messages || !Array.isArray(messages)) {
      console.error('Invalid messages array');
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      );
    }

    if (messages.length === 0) {
      console.error('No messages to evaluate');
      return NextResponse.json(
        { error: 'No conversation found to evaluate' },
        { status: 400 }
      );
    }

    // Check if evaluation service is available
    console.log('Checking if evaluation service is available...');
    if (!interviewEvaluationService.isAvailable()) {
      console.error('Evaluation service is not available - API key not configured');
      return NextResponse.json(
        { 
          error: 'Interview evaluation service is not available',
          details: 'Google AI API key is not configured. Please set GOOGLE_GENERATIVE_AI_API_KEY environment variable.'
        },
        { status: 503 }
      );
    }

    console.log('Service is available, starting evaluation...');
    
    // Generate interview evaluation using Gemini
    const evaluation = await interviewEvaluationService.evaluateInterview(messages, callDetails);
    
    console.log('Evaluation completed successfully');

    return NextResponse.json({
      success: true,
      evaluation,
      callId,
      evaluatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error evaluating interview:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Check if it's a service availability error
    if (error instanceof Error && error.message.includes('not available')) {
      return NextResponse.json(
        { 
          error: 'Interview evaluation service is not available',
          details: error.message
        },
        { status: 503 }
      );
    }
    
    // Check if it's a quota exceeded error
    if (error instanceof Error && (error.message.includes('quota') || error.message.includes('429'))) {
      return NextResponse.json(
        { 
          error: 'API quota exceeded',
          details: 'Google AI API quota has been exceeded. Please try again later or upgrade your plan.',
          retryAfter: 60 // seconds
        },
        { status: 429 }
      );
    }
    
    // Check if it's an API key error
    if (error instanceof Error && (error.message.includes('API key') || error.message.includes('403'))) {
      return NextResponse.json(
        { 
          error: 'Invalid API key',
          details: 'Please check your Google AI API key configuration.'
        },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to evaluate interview',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const resolvedParams = await params;
    const { callId } = resolvedParams;
    
    return NextResponse.json({
      message: 'Use POST method to evaluate interview',
      callId,
      endpoint: `/api/vapi/call-data/${callId}/evaluation`
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

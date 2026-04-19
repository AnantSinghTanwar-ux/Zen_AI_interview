import { NextRequest, NextResponse } from 'next/server';
import { interviewEvaluationService } from '@/services/interview/interview-evaluation.service';
import { getCurrentUser } from '@/lib/actions/auth.actions';
import { checkRateLimit } from '@/lib/services/rate-limit.service';
import {
  checkAndConsumePremiumDailyLimit,
  checkPremiumAccessForCall,
  getPremiumDailyLimitErrorPayload,
  getPremiumRequiredErrorPayload,
} from '@/lib/services/premium-access.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { allowed, response } = await checkRateLimit(request, user.id, 'interview-evaluation');
    if (!allowed) return response!;

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

    const premiumAccess = await checkPremiumAccessForCall({
      userId: user.id,
      email: user.email,
      callIds: [callId, callDetails?.vapiCallId, callDetails?.id],
    });

    if (!premiumAccess.allowed) {
      return NextResponse.json(getPremiumRequiredErrorPayload(), { status: 402 });
    }

    const premiumDailyLimit = await checkAndConsumePremiumDailyLimit({
      userId: user.id,
      email: user.email,
      kind: 'feedback',
      usageKey: `feedback:${callId}`,
      consume: true,
    });

    if (!premiumDailyLimit.allowed) {
      return NextResponse.json(
        getPremiumDailyLimitErrorPayload({
          kind: premiumDailyLimit.kind,
          limit: premiumDailyLimit.limit,
          date: premiumDailyLimit.date,
        }),
        { status: 429 }
      );
    }

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
      console.error('Evaluation service is not available - OpenRouter API key not configured');
      return NextResponse.json(
        { 
          error: 'Interview evaluation service is not available',
          details: 'OpenRouter API key is not configured. Please set OPENROUTER_API_KEY environment variable.'
        },
        { status: 503 }
      );
    }

    console.log('Service is available, starting evaluation...');
    
    // Generate interview evaluation using OpenRouter
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
          details: 'OpenRouter API quota has been exceeded. Please try again later or adjust your plan.',
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
          details: 'Please check your OpenRouter API key configuration.'
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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { allowed, response } = await checkRateLimit(request, user.id, 'interview-evaluation');
    if (!allowed) return response!;

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

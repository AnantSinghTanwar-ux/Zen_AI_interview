import { NextRequest, NextResponse } from "next/server";
import { vapiCallDataService } from "@/services/vapi/call-data.service";
import { callLogService } from "@/services/firebase/call-log.service";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { checkRateLimit } from "@/lib/services/rate-limit.service";
import { cacheService } from "@/lib/services/cache.service";
import { retryWithBackoff } from "@/lib/services/retry.service";
import {
  generateOpenRouterJson,
  getOpenRouterModelCandidates,
  hasOpenRouterKey,
} from "@/services/ai/openrouter-client";
import { applyHarshFeedbackGuardrails } from "@/services/ai/analysis-guardrails";


const FEEDBACK_MODEL_CANDIDATES = getOpenRouterModelCandidates(
  process.env.OPENROUTER_HARSH_ANALYSIS_MODEL,
  process.env.OPENROUTER_EVALUATION_MODEL,
  "openai/gpt-4.1-mini",
  process.env.OPENROUTER_MODEL,
  process.env.GOOGLE_AI_FEEDBACK_MODEL,
  "openrouter/auto"
);

interface FeedbackAnalysis {
  overallScore: number;
  communicationScore: number;
  technicalScore: number;
  problemSolvingScore: number;
  confidenceScore: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  nextSteps: string[];
  aiSummary: string;
  personalizedPlan: string[];
  responseTime: number;
  completionRate: number;
  duration: number;
}

function extractTranscriptFromCallLog(callLog: any): string {
  if (!callLog) return "";

  // Preferred: transcript stored directly on the call log document.
  if (typeof callLog.transcript === "string" && callLog.transcript.trim().length > 0) {
    return callLog.transcript;
  }

  // Fallback: build minimal analyzable text from summary/analysis fields.
  const summary = typeof callLog.summary === "string" ? callLog.summary.trim() : "";
  const analysis = callLog.analysis && typeof callLog.analysis === "object"
    ? JSON.stringify(callLog.analysis)
    : "";

  const combined = [summary, analysis].filter(Boolean).join("\n\n");
  return combined;
}

function extractConversationFromMessages(messages: any[]): string {
  if (!messages || messages.length === 0) return "";

  const conversation = messages
    .filter(msg => {
      // Include final transcripts
      if (msg.type === "transcript" && msg.transcriptType === "final") return true;
      // Include standard conversation messages with content
      if ((msg.role === "user" || msg.role === "assistant" || msg.role === "bot") && (msg.content || msg.message)) return true;
      return false;
    })
    .map(msg => {
      const roleName = msg.role === "user" ? "Candidate" : "Interviewer";
      // Handle various content fields Vapi might return
      const content = msg.transcript || msg.content || msg.message;
      return `${roleName}: ${content}`;
    })
    .join("\n");

  return conversation;
}

function calculateResponseTime(messages: any[]): number {
  const transcriptMessages = messages.filter(msg => {
    if (msg.type === "transcript" && msg.transcriptType === "final") return true;
    if ((msg.role === "user" || msg.role === "assistant" || msg.role === "bot") && (msg.content || msg.message)) return true;
    return false;
  });

  if (transcriptMessages.length < 2) return 0;

  let totalResponseTime = 0;
  let responseCount = 0;

  for (let i = 1; i < transcriptMessages.length; i++) {
    const prevMsg = transcriptMessages[i - 1];
    const currMsg = transcriptMessages[i];

    // Calculate response time between interviewer question and candidate answer
    if (prevMsg.role === "assistant" && currMsg.role === "user") {
      const timeDiff = (currMsg.timestamp || 0) - (prevMsg.timestamp || 0);
      if (timeDiff > 0 && timeDiff < 60000) { // Less than 60 seconds
        totalResponseTime += timeDiff;
        responseCount++;
      }
    }
  }

  return responseCount > 0 ? totalResponseTime / responseCount / 1000 : 8.5; // Convert to seconds
}

async function generateFeedbackFromTranscript(transcript: string, callData: any): Promise<FeedbackAnalysis> {
  if (!transcript || transcript.trim().length === 0) {
    throw new Error("No conversation transcript available for analysis");
  }

  if (!hasOpenRouterKey()) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const prompt = `
You are a strict senior interviewer performing real-world screening analysis.

CRITICAL SCORING RULES (must follow):
1) Evidence over assumption: score ONLY based on what is explicitly present in the transcript.
2) Resume mention is not proof: if candidate only references resume/background without technical discussion, do NOT award high technical/problem-solving scores.
3) Harsh hiring bar: default to conservative scoring unless strong evidence exists.
4) Missing-evidence caps:
   - If no technical Q&A depth is visible, technicalScore MUST be <= 35.
   - If no concrete problem-solving walkthrough is visible, problemSolvingScore MUST be <= 35.
   - If answers are short/deflecting, communicationScore and confidenceScore should be penalized.
5) Do not inflate scores for politeness or potential. Judge demonstrated interview performance only.

Evaluate this interview transcript:

${transcript}

Return ONLY valid JSON in this exact format:

{
  "overallScore": [number 0-100],
  "communicationScore": [number 0-100],
  "technicalScore": [number 0-100],
  "problemSolvingScore": [number 0-100],
  "confidenceScore": [number 0-100],
  "strengths": [array of 3-5 specific strengths],
  "weaknesses": [array of 3-4 areas for improvement],
  "suggestions": [array of 4-5 actionable suggestions],
  "nextSteps": [array of 4-5 concrete next steps],
  "aiSummary": "[2-3 sentence summary of overall performance]",
  "personalizedPlan": [array of 5-6 weekly improvement goals]
}

Scoring rubric guidance:
- 0-34: insufficient evidence / weak demonstration
- 35-54: basic but below interview-ready
- 55-69: acceptable junior level but inconsistent
- 70-84: strong interview-ready performance
- 85-100: exceptional, rare performance with clear depth

Interpretation guardrails:
- If candidate asks interviewer to read resume and technical depth is absent, treat technical/problem-solving as low-evidence.
- Strengths/weaknesses/suggestions must be grounded in observable transcript behavior.
- Keep feedback practical and direct, like a real hiring panel debrief.

Provide tough-but-fair ratings and actionable coaching.
`;

  try {
    const feedbackData = await generateOpenRouterJson<any>({
      prompt,
      modelCandidates: FEEDBACK_MODEL_CANDIDATES,
      temperature: 0.2,
      maxTokens: 2_500,
    });

    const guardedFeedback = applyHarshFeedbackGuardrails(
      feedbackData,
      transcript
    );

    // Calculate additional metrics from call data
    const messages = callData.messages || [];
    const responseTime = calculateResponseTime(messages);
    const duration = callData.endedAt && callData.startedAt 
      ? (new Date(callData.endedAt).getTime() - new Date(callData.startedAt).getTime()) / (1000 * 60)
      : 30;

    return {
      ...guardedFeedback,
      responseTime,
      completionRate: callData.status === "ended" ? 100 : 75,
      duration: Math.round(duration)
    };

  } catch (error) {
    console.error("Error generating OpenRouter feedback:", error);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed, response } = await checkRateLimit(request, user.id, "feedback-generate");
    if (!allowed) return response!;

    const { searchParams } = new URL(request.url);
    const callId = searchParams.get("callId");

    if (!callId) {
      return NextResponse.json(
        { error: "callId parameter is required" },
        { status: 400 }
      );
    }

    console.log(`Generating feedback for Firestore call ID: ${callId}`);

    // The callId from the frontend may be a Firestore document ID OR a Vapi UUID.
    // Strategy: try direct Firestore doc lookup first (O(1)), then try Vapi UUID lookup.
    let vapiCallId: string = callId;
    let firestoreLog: any = null;

    try {
      // Step 1: try treating callId as a Firestore document ID
      firestoreLog = await callLogService.getCallLogById(callId).catch(() => null);
      if (firestoreLog?.vapiCallId) {
        vapiCallId = firestoreLog.vapiCallId;
        console.log(`Resolved Firestore doc ID ${callId} → Vapi UUID ${vapiCallId}`);
      } else {
        // Step 2: callId might already be the Vapi UUID — verify by lookup
        const byVapiId = await callLogService.getCallLogByVapiId(callId).catch(() => null);
        if (byVapiId?.vapiCallId) {
          firestoreLog = byVapiId;
          vapiCallId = byVapiId.vapiCallId;
        } else {
          console.warn(`Could not resolve vapiCallId for "${callId}", using as-is`);
        }
      }
    } catch (lookupError) {
      console.warn("Firestore ID resolution failed, using callId directly:", lookupError);
    }

    // Premium check removed — all authenticated users have access

    // Check cache after access verification.
    const cacheKey = `feedback:v2:${callId}`;
    const cached = await cacheService.get<Record<string, unknown>>(cacheKey);
    if (cached) {
      return NextResponse.json(cached, {
        status: 200,
        headers: { "X-Cache": "HIT" },
      });
    }

    let callData: any = null;
    let transcript = "";

    // Primary source: Vapi live call fetch.
    try {
      callData = await vapiCallDataService.getCall(vapiCallId);
      const messages = callData.messages || [];
      transcript = extractConversationFromMessages(messages);

      console.log(`Call data structure:`, {
        hasArtifact: !!(callData as any).artifact,
        hasMessages: !!messages.length,
        messageCount: messages.length,
        transcriptLength: transcript.length,
        callStatus: callData.status,
        firstMessageType: messages[0]?.type || "none",
      });
    } catch (vapiError) {
      console.warn("Vapi call fetch failed, attempting Firestore fallback:", vapiError);

      // Secondary source: data already persisted in Firestore.
      if (!firestoreLog) {
        firestoreLog = await callLogService.getCallLogByVapiId(vapiCallId).catch(() => null);
      }

      transcript = extractTranscriptFromCallLog(firestoreLog);
      callData = {
        status: firestoreLog?.status || "ended",
        startedAt: firestoreLog?.startedAt,
        endedAt: firestoreLog?.endedAt,
        messages: [],
      };

      if (!transcript || transcript.trim().length === 0) {
        throw vapiError;
      }
    }

    if (!callData) {
      return NextResponse.json(
        { error: "Call not found" },
        { status: 404 }
      );
    }

    if (!transcript || transcript.trim().length === 0) {
      console.log(`No transcript available for call ${vapiCallId}`);
      return NextResponse.json(
        { error: "No conversation transcript available for analysis. Please ensure the interview session has completed and has enough dialogue." },
        { status: 400 }
      );
    }

    // Generate AI-powered feedback with retry logic
    const feedback = await retryWithBackoff(
      () => generateFeedbackFromTranscript(transcript, callData),
      { maxRetries: 2, initialDelayMs: 500 }
    );

    // Add metadata
    const responseData = {
      id: `feedback_${callId}`,
      callId,
      vapiCallId,
      interviewId: callId,
      userId: user.id,
      interviewType: "technical",
      createdAt: new Date().toISOString(),
      ...feedback,
    };

    // Cache the result for 2 hours
    await cacheService.set(cacheKey, responseData, 7200);

    console.log(`Successfully generated feedback for call: ${callId}`);

    return NextResponse.json(responseData, {
      status: 200,
      headers: { "X-Cache": "MISS" },
    });

  } catch (error) {
    console.error("Error generating feedback:", error);

    const errorMessage = error instanceof Error ? error.message : "Failed to generate feedback";

    return NextResponse.json({
      error: errorMessage,
      message: "Failed to generate feedback from call data",
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

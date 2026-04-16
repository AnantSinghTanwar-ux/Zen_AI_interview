import { NextRequest, NextResponse } from "next/server";
import { vapiCallDataService } from "@/services/vapi/call-data.service";
import { callLogService } from "@/services/firebase/call-log.service";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");
const FEEDBACK_MODEL_CANDIDATES = [
  process.env.GOOGLE_AI_FEEDBACK_MODEL || "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-flash",
].filter(Boolean);

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

  const prompt = `
You are an expert interview coach analyzing a technical interview session. Please provide detailed feedback based on the following conversation transcript:

${transcript}

Please analyze this interview and provide feedback in the following JSON format:

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

Focus on:
- Technical knowledge and problem-solving approach
- Communication clarity and structure
- Confidence and professionalism
- Areas for improvement with specific suggestions
- Actionable next steps for skill development

Provide realistic scores and constructive feedback that would help the candidate improve.
`;

  try {
    let result: any = null;
    let lastError: unknown = null;

    for (const modelName of FEEDBACK_MODEL_CANDIDATES) {
      const model = genAI.getGenerativeModel({ model: modelName });
      let retries = 2;
      let delay = 1500;

      while (retries >= 0) {
        try {
          console.log(`[Feedback] Trying model: ${modelName}, retries left: ${retries}`);
          result = await model.generateContent(prompt);
          console.log(`[Feedback] Model succeeded: ${modelName}`);
          break;
        } catch (e: any) {
          lastError = e;
          const message = String(e?.message || "");
          const shouldRetrySameModel =
            message.includes("429") ||
            message.includes("503") ||
            message.toLowerCase().includes("quota") ||
            message.toLowerCase().includes("high demand") ||
            message.toLowerCase().includes("service unavailable") ||
            message.toLowerCase().includes("too many requests");

          if (!shouldRetrySameModel || retries === 0) {
            console.warn(`[Feedback] Model failed: ${modelName}. Moving to next model.`, message);
            break;
          }

          console.log(`[Feedback] Transient error on ${modelName}, waiting ${delay}ms before retry`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          retries -= 1;
          delay *= 2;
        }
      }

      if (result) {
        break;
      }
    }

    if (!result) {
      throw lastError || new Error("All feedback models failed");
    }

    const response = await result.response;
    const text = response.text();

    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid response format from AI");
    }

    const feedbackData = JSON.parse(jsonMatch[0]);

    // Calculate additional metrics from call data
    const messages = callData.messages || [];
    const responseTime = calculateResponseTime(messages);
    const duration = callData.endedAt && callData.startedAt 
      ? (new Date(callData.endedAt).getTime() - new Date(callData.startedAt).getTime()) / (1000 * 60)
      : 30;

    return {
      ...feedbackData,
      responseTime,
      completionRate: callData.status === "ended" ? 100 : 75,
      duration: Math.round(duration)
    };

  } catch (error) {
    console.error("Error generating AI feedback:", error);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
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

    try {
      // Step 1: try treating callId as a Firestore document ID
      const firestoreLog = await callLogService.getCallLogById(callId).catch(() => null);
      if (firestoreLog?.vapiCallId) {
        vapiCallId = firestoreLog.vapiCallId;
        console.log(`Resolved Firestore doc ID ${callId} → Vapi UUID ${vapiCallId}`);
      } else {
        // Step 2: callId might already be the Vapi UUID — verify by lookup
        const byVapiId = await callLogService.getCallLogByVapiId(callId).catch(() => null);
        if (byVapiId?.vapiCallId) {
          vapiCallId = byVapiId.vapiCallId;
        } else {
          console.warn(`Could not resolve vapiCallId for "${callId}", using as-is`);
        }
      }
    } catch (lookupError) {
      console.warn("Firestore ID resolution failed, using callId directly:", lookupError);
    }

    // Fetch call data from Vapi using the real UUID
    const callData = await vapiCallDataService.getCall(vapiCallId);

    if (!callData) {
      return NextResponse.json(
        { error: "Call not found" },
        { status: 404 }
      );
    }

    // Extract conversation transcript
    // Vapi messages may use `message`, `content`, or `transcript` fields
    const messages = callData.messages || [];
    const transcript = extractConversationFromMessages(messages);

    console.log(`Call data structure:`, {
      hasArtifact: !!(callData as any).artifact,
      hasMessages: !!messages.length,
      messageCount: messages.length,
      transcriptLength: transcript.length,
      callStatus: callData.status,
      firstMessageType: messages[0]?.type || "none",
    });

    if (!transcript || transcript.trim().length === 0) {
      console.log(`No transcript available for call ${vapiCallId}`);
      return NextResponse.json(
        { error: "No conversation transcript available for analysis. Please ensure the interview session has completed and has enough dialogue." },
        { status: 400 }
      );
    }

    // Generate AI-powered feedback
    const feedback = await generateFeedbackFromTranscript(transcript, callData);

    // Add metadata
    const responseData = {
      id: `feedback_${callId}`,
      callId,
      vapiCallId,
      interviewId: callId,
      userId: "current_user",
      interviewType: "technical",
      createdAt: new Date().toISOString(),
      ...feedback,
    };

    console.log(`Successfully generated feedback for call: ${callId}`);

    return NextResponse.json(responseData, { status: 200 });

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

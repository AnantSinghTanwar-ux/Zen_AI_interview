import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { db } from "@/services/firebase/admin";
import { generateOpenRouterJson, getOpenRouterModelCandidates, hasOpenRouterKey } from "@/services/ai/openrouter-client";
import { applyHarshFeedbackGuardrails } from "@/services/ai/analysis-guardrails";

const FEEDBACK_MODEL_CANDIDATES = getOpenRouterModelCandidates(
  process.env.OPENROUTER_HARSH_ANALYSIS_MODEL,
  process.env.OPENROUTER_EVALUATION_MODEL,
  "openai/gpt-4.1-mini",
  process.env.OPENROUTER_MODEL,
  process.env.GOOGLE_AI_FEEDBACK_MODEL,
  "openrouter/auto"
);

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasOpenRouterKey()) {
      return NextResponse.json({ error: "OpenRouter key not configured" }, { status: 500 });
    }

    const body = await request.json();
    const { messages, code, question, duration } = body;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "No messages to analyze" }, { status: 400 });
    }

    // Build the transcript
    const transcript = messages.map((m: any) => `${m.role === 'user' ? 'Candidate' : 'Interviewer'}: ${m.content}`).join('\n\n');

    const prompt = `
You are an expert Data Structures and Algorithms (DSA) interviewer evaluating a candidate.

Question Information:
Title: ${question.title || 'Unknown'}
Difficulty: ${question.difficulty || 'Unknown'}
Topic: ${question.topic || 'Unknown'}
Description: ${question.problem || 'Unknown'}

Candidate's Final Code:
\`\`\`
${code || 'No code provided.'}
\`\`\`

Interview Transcript:
${transcript}

CRITICAL SCORING RULES:
1) Evidence over assumption: score ONLY based on what is explicitly present in the transcript and code.
2) If the candidate's code is empty or incomplete, their technicalScore MUST be <= 35.
3) If they didn't walk through an approach clearly in the chat, problemSolvingScore MUST be <= 35.

Evaluate this DSA interview performance. Return ONLY valid JSON in this exact format:

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
`;

    const feedbackData = await generateOpenRouterJson<any>({
      prompt,
      modelCandidates: FEEDBACK_MODEL_CANDIDATES,
      temperature: 0.2,
      maxTokens: 2_500,
    });

    const guardedFeedback = applyHarshFeedbackGuardrails(feedbackData, transcript + "\nCode: " + code);

    // Save to Firestore in callLogs collection (or dsaLogs)
    const logData = {
      userId: user.id,
      interviewType: "dsa",
      createdAt: new Date().toISOString(),
      startedAt: new Date(Date.now() - (duration || 1800) * 1000).toISOString(),
      endedAt: new Date().toISOString(),
      status: "ended",
      duration: duration || 0,
      transcript: transcript,
      code: code || "",
      question: question || {},
      analysis: guardedFeedback
    };

    const docRef = await db.collection("callLogs").add(logData);

    return NextResponse.json({ id: docRef.id }, { status: 200 });
  } catch (error) {
    console.error("Failed to generate DSA feedback:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

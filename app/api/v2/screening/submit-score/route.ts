import { NextRequest, NextResponse } from "next/server";
import { db } from "@/services/firebase/admin";
import { COLLECTION_BULK_CANDIDATES } from "@/constants/screening.config";
import { generateOpenRouterJson } from "@/services/ai/openrouter-client";

export const maxDuration = 300;

interface ScoreResult {
  score: number;
  feedback: string;
}

export async function POST(req: NextRequest) {
  try {
    const { candidateId, jobId, transcript, callId } = await req.json();

    if (!candidateId || !jobId || !transcript) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Fetch Job context
    const jobDoc = await db.collection("jobs").doc(jobId).get();
    if (!jobDoc.exists) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const jobData = jobDoc.data()!;

    // 2. Fetch Candidate context
    const candidateRef = db.collection(COLLECTION_BULK_CANDIDATES).doc(candidateId);
    const candidateDoc = await candidateRef.get();
    if (!candidateDoc.exists) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    // 3. Generate Score using LLM
    const systemPrompt = `You are an expert technical recruiter evaluating a candidate based on an AI interview transcript.
You must return your evaluation strictly in JSON format.

JOB REQUIREMENTS:
Title: ${jobData.title}
Skills: ${jobData.skills?.join(", ")}
Description: ${jobData.description}

EVALUATION CRITERIA:
1. Did the candidate answer the technical questions correctly?
2. Did they demonstrate the required skills?
3. Was their communication clear?

OUTPUT FORMAT:
{
  "score": <number between 0 and 100>,
  "feedback": "<A 2-3 sentence summary of their performance and why you gave this score>"
}`;

    const userPrompt = `Here is the interview transcript:
${transcript}

Evaluate the candidate and provide the JSON output.`;

    let scoreData: ScoreResult;
    try {
      scoreData = await generateOpenRouterJson<ScoreResult>({
        systemPrompt,
        prompt: userPrompt,
      });
    } catch (llmError) {
      console.error("[SubmitScore] LLM Error:", llmError);
      // Fallback if LLM fails
      scoreData = {
        score: 0,
        feedback: "Failed to generate AI evaluation due to an error.",
      };
    }

    // Ensure score is within bounds
    const finalScore = Math.max(0, Math.min(100, scoreData.score || 0));

    // 4. Save to Firestore
    await candidateRef.update({
      interviewScore: finalScore,
      interviewFeedback: scoreData.feedback || "No feedback provided.",
      interviewCompletedAt: new Date().toISOString(),
      vapiCallId: callId || null,
    });

    return NextResponse.json({ success: true, score: finalScore });
  } catch (err) {
    console.error("[SubmitScore] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

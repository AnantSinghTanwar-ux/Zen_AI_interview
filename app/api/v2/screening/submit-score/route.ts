import { NextRequest, NextResponse } from "next/server";
import { db } from "@/services/firebase/admin";
import { COLLECTION_BULK_CANDIDATES } from "@/constants/screening.config";
import { generateOpenRouterJson } from "@/services/ai/openrouter-client";

export const maxDuration = 300;

interface ScoreResult {
  scores: {
    technical: number;
    problemSolving: number;
    communication: number;
    roleFit: number;
  };
  score: number;
  feedback: string;
}

export async function POST(req: NextRequest) {
  try {
    const { candidateId, jobId, transcript, callId } = await req.json();

    if (!candidateId || !jobId) {
      return NextResponse.json({ error: "Missing candidateId or jobId" }, { status: 400 });
    }

    const safeTranscript = transcript || "No transcript available. The call may have ended before any conversation took place.";

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
    const systemPrompt = `You are an expert technical recruiter evaluating a candidate based on an AI interview transcript using a strict 100-point rubric.
You must return your evaluation strictly in JSON format.

JOB REQUIREMENTS:
Title: ${jobData.title}
Skills: ${jobData.skills?.join(", ")}
Description: ${jobData.description}

SCORING RUBRIC (100 Points Total):
1. Technical Accuracy (40 points max): Did the candidate answer the technical questions correctly and demonstrate deep knowledge?
2. Problem Solving (20 points max): How well did they approach complex scenarios and articulate their thought process?
3. Communication (20 points max): Was their communication clear, concise, and professional?
4. Role Fit (20 points max): How well do their answers align with the specific job description and required skills?

INSTRUCTIONS:
Calculate the score for each section based on the rubric. The overall score must be exactly the sum of the four section scores.

OUTPUT FORMAT:
{
  "scores": {
    "technical": <number 0-40>,
    "problemSolving": <number 0-20>,
    "communication": <number 0-20>,
    "roleFit": <number 0-20>
  },
  "score": <number 0-100, exactly the sum of the scores above>,
  "feedback": "<A 3-5 sentence summary of their performance explaining the score breakdown>"
}`;

    const userPrompt = `Here is the interview transcript:
${safeTranscript}

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
        scores: { technical: 0, problemSolving: 0, communication: 0, roleFit: 0 },
        score: 0,
        feedback: "Failed to generate AI evaluation due to an error.",
      };
    }

    // Ensure score is within bounds
    const finalScore = Math.max(0, Math.min(100, scoreData.score || 0));

    // 4. Save to Firestore
    await candidateRef.update({
      interviewScoreBreakdown: scoreData.scores,
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

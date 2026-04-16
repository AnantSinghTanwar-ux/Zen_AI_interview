import { NextRequest, NextResponse } from "next/server";
import { recruiterGuard } from "@/app/api/v2/recruiter/_guard";
import {
  getApplications,
  getDistinctValues,
  updateApplicationStatus,
} from "@/services/recruiter/external-application.service";
import {
  getLeaderboard,
  getScoreByApplication,
  saveScore,
} from "@/services/recruiter/application-score.service";
import { vapiCallDataService } from "@/services/vapi/call-data.service";
import { callLogService } from "@/services/firebase/call-log.service";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ExternalApplication } from "@/types/external-application";

const GOOGLE_AI_KEY =
  process.env.GOOGLE_AI_API_KEY ||
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  "";

const SCORE_MODEL_CANDIDATES = [
  process.env.GOOGLE_AI_FEEDBACK_MODEL || "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-flash",
].filter(Boolean);

function buildTranscriptFromVapiCall(callData: any): string {
  const artifactTranscript =
    typeof callData?.artifact?.transcript === "string" ? String(callData.artifact.transcript) : "";
  if (artifactTranscript.trim().length >= 50) {
    return artifactTranscript.trim();
  }

  const messages = callData?.artifact?.messages || callData?.messages || [];
  const transcript = (messages as any[])
    .filter((msg: any) => {
      if (msg.type === "transcript" && msg.transcriptType === "final") return true;
      if ((msg.role === "user" || msg.role === "assistant" || msg.role === "bot") && (msg.content || msg.message || msg.transcript)) return true;
      return false;
    })
    .map((msg: any) => {
      const role = msg.role === "user" ? "Candidate" : "Interviewer";
      const content = msg.transcript || msg.content || msg.message || "";
      return `${role}: ${content}`;
    })
    .join("\n");

  return transcript;
}

async function backfillScoresForCompletedApps(apps: ExternalApplication[]) {
  if (!GOOGLE_AI_KEY) return;

  // Keep this bounded to avoid slow dashboard loads.
  const candidates = apps
    .filter((a) => a.interviewStatus === "completed" && Boolean(a.interviewId) && a.scoreStatus !== "available")
    .slice(0, 3);

  if (candidates.length === 0) return;

  const genAI = new GoogleGenerativeAI(GOOGLE_AI_KEY);

  for (const app of candidates) {
    try {
      const existingScore = await getScoreByApplication(app.id);
      if (existingScore) {
        if (app.scoreStatus !== "available" || app.scoreId !== existingScore.id) {
          await updateApplicationStatus(app.id, { scoreStatus: "available", scoreId: existingScore.id });
        }
        continue;
      }

      const interviewId = String(app.interviewId || "");
      if (!interviewId) continue;

      await updateApplicationStatus(app.id, { scoreStatus: "processing" });

      let transcript = "";
      try {
        const callData = await vapiCallDataService.getCall(interviewId);
        transcript = buildTranscriptFromVapiCall(callData);
      } catch (vapiErr) {
        // Fallback to Firestore transcript if available
        const log = await callLogService.getCallLogByVapiId(interviewId).catch(() => null);
        transcript = typeof (log as any)?.transcript === "string" ? String((log as any).transcript) : "";
        if (!transcript) {
          console.warn("Score backfill: unable to fetch transcript", { applicationId: app.id, interviewId, vapiErr });
        }
      }

      if (!transcript || transcript.trim().length < 50) {
        await updateApplicationStatus(app.id, { scoreStatus: "failed" });
        continue;
      }

      const prompt = `
You are a recruiter evaluating an interview candidate. Analyze this interview transcript and provide a scoring assessment.

Transcript:
${transcript}

Respond in ONLY valid JSON with this exact structure:
{
  "overallScore": <number 0-100>,
  "technicalScore": <number 0-100>,
  "communicationScore": <number 0-100>,
  "problemSolvingScore": <number 0-100>,
  "recommendation": "<one of: strong_hire, hire, maybe, no_hire>",
  "strengths": ["<strength1>", "<strength2>", "<strength3>"],
  "weaknesses": ["<weakness1>", "<weakness2>"],
  "feedbackSummary": "<2-3 sentence overall assessment>"
}

Be realistic and constructive. Return ONLY JSON.
`;

      let result: any = null;
      let lastError: unknown = null;

      for (const modelName of SCORE_MODEL_CANDIDATES) {
        const model = genAI.getGenerativeModel({ model: modelName });
        try {
          result = await model.generateContent(prompt);
          break;
        } catch (e) {
          lastError = e;
        }
      }

      if (!result) {
        throw lastError || new Error("All scoring models failed");
      }

      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Invalid AI scoring response");

      const scoreData = JSON.parse(jsonMatch[0]);

      const scoreId = await saveScore({
        applicationId: app.id,
        interviewId,
        overallScore: Math.min(100, Math.max(0, scoreData.overallScore || 0)),
        technicalScore: Math.min(100, Math.max(0, scoreData.technicalScore || 0)),
        communicationScore: Math.min(100, Math.max(0, scoreData.communicationScore || 0)),
        problemSolvingScore: Math.min(100, Math.max(0, scoreData.problemSolvingScore || 0)),
        recommendation: scoreData.recommendation || "maybe",
        strengths: scoreData.strengths || [],
        weaknesses: scoreData.weaknesses || [],
        feedbackSummary: scoreData.feedbackSummary || "",
        generatedBy: "gemini",
      });

      await updateApplicationStatus(app.id, { scoreStatus: "available", scoreId });
    } catch (err) {
      console.error("Score backfill error:", err);
      try {
        await updateApplicationStatus(app.id, { scoreStatus: "failed" });
      } catch {
        // ignore
      }
    }
  }
}

export async function GET(request: NextRequest) {
  const { error } = await recruiterGuard();
  if (error) return error;

  try {
    const allApps = await getApplications();

    // Fix missing scores so the dashboard + leaderboard populate.
    await backfillScoresForCompletedApps(allApps);

    const filterOptions = await getDistinctValues();
    const topCandidates = await getLeaderboard();

    const totalApplications = allApps.length;
    const completedInterviews = allApps.filter((a) => a.interviewStatus === "completed").length;
    const pendingInterviews = allApps.filter((a) => a.interviewStatus === "pending").length;
    const invitedInterviews = allApps.filter((a) => a.interviewStatus === "invited").length;

    // By role
    const byRole: Record<string, number> = {};
    const byCompany: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    allApps.forEach((a) => {
      byRole[a.roleCategory] = (byRole[a.roleCategory] || 0) + 1;
      byCompany[a.companyName] = (byCompany[a.companyName] || 0) + 1;
      bySource[a.sourcePlatform] = (bySource[a.sourcePlatform] || 0) + 1;
    });

    // Average score from leaderboard
    const scoredEntries = topCandidates.filter((c) => c.overallScore > 0);
    const averageScore =
      scoredEntries.length > 0
        ? Math.round(scoredEntries.reduce((s, c) => s + c.overallScore, 0) / scoredEntries.length)
        : 0;

    return NextResponse.json(
      {
        totalApplications,
        completedInterviews,
        pendingInterviews,
        invitedInterviews,
        averageScore,
        byRole,
        byCompany,
        bySource,
        topCandidates: topCandidates.slice(0, 5),
        filterOptions,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Dashboard error:", err);
    return NextResponse.json({ error: "Failed", details: (err as Error).message }, { status: 500 });
  }
}

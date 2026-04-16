import { NextRequest, NextResponse } from "next/server";
import { callLogService } from "@/services/firebase/call-log.service";
import { vapiCallDataService } from "@/services/vapi/call-data.service";
import { db } from "@/services/firebase/admin";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = process.env.GOOGLE_AI_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
  : null;

const SCORE_MODEL_CANDIDATES = [
  process.env.GOOGLE_AI_FEEDBACK_MODEL || "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-flash",
].filter(Boolean);

/**
 * Auto-create an external_application record when a candidate completes
 * an interview that was started via the browser extension (has job context).
 * Returns the created document ID so we can attach a score to it.
 */
async function createExternalApplicationFromJobContext(
  jobContextJson: string,
  userId: string,
  vapiCallId: string,
  userName?: string,
  userEmail?: string
): Promise<string | null> {
  try {
    const jobContext = JSON.parse(jobContextJson);
    const job = jobContext.job || jobContext;

    const title = (job.title || "").trim();
    const company = (job.company || "").trim();
    const sourceUrl = (jobContext.sourceUrl || "").trim();

    if (!title && !company) {
      console.warn("Job context missing title and company, skipping external_application creation");
      return null;
    }

    // Determine source platform from URL
    let sourcePlatform = "other";
    if (sourceUrl.includes("linkedin.com")) sourcePlatform = "linkedin";
    else if (sourceUrl.includes("jobyt.in")) sourcePlatform = "jobyt";
    else if (sourceUrl.includes("naukri.com")) sourcePlatform = "naukri";
    else if (sourceUrl.includes("indeed.com")) sourcePlatform = "indeed";
    else if (sourceUrl.includes("glassdoor.com")) sourcePlatform = "glassdoor";

    // Auto-detect role category from title
    const lowerTitle = title.toLowerCase();
    let roleCategory = "other";
    if (lowerTitle.includes("backend") || lowerTitle.includes("back-end") || lowerTitle.includes("server")) roleCategory = "backend";
    else if (lowerTitle.includes("frontend") || lowerTitle.includes("front-end") || lowerTitle.includes("ui developer")) roleCategory = "frontend";
    else if (lowerTitle.includes("fullstack") || lowerTitle.includes("full-stack") || lowerTitle.includes("full stack")) roleCategory = "fullstack";
    else if (lowerTitle.includes("devops") || lowerTitle.includes("sre") || lowerTitle.includes("infrastructure")) roleCategory = "devops";
    else if (lowerTitle.includes("data") || lowerTitle.includes("ml") || lowerTitle.includes("machine learning")) roleCategory = "data";
    else if (lowerTitle.includes("mobile") || lowerTitle.includes("android") || lowerTitle.includes("ios") || lowerTitle.includes("flutter")) roleCategory = "mobile";
    else if (lowerTitle.includes("design") || lowerTitle.includes("ux")) roleCategory = "design";
    else if (lowerTitle.includes("qa") || lowerTitle.includes("test") || lowerTitle.includes("quality")) roleCategory = "qa";
    else if (lowerTitle.includes("manager") || lowerTitle.includes("lead") || lowerTitle.includes("director")) roleCategory = "management";

    // Check if an application already exists for this user + role + company
    const existing = await db
      .collection("external_applications")
      .where("candidateEmail", "==", (userEmail || "").toLowerCase())
      .where("roleTitle", "==", title)
      .where("companyName", "==", company || "Unknown")
      .limit(1)
      .get();

    if (!existing.empty) {
      const docId = existing.docs[0].id;
      await db.collection("external_applications").doc(docId).update({
        interviewStatus: "completed",
        interviewId: vapiCallId,
        status: "completed",
        updatedAt: new Date().toISOString(),
      });
      console.log(`Updated existing external_application ${docId} with interview data`);
      return docId;
    }

    const now = new Date().toISOString();
    const docRef = await db.collection("external_applications").add({
      candidateName: userName || userEmail?.split("@")[0] || "Candidate",
      candidateEmail: (userEmail || "").toLowerCase(),
      resumeUrl: "",
      sourcePlatform,
      companyName: company || "Unknown",
      roleTitle: title || "Software Engineer",
      roleCategory,
      externalJobId: job.jobId || "",
      externalJobUrl: sourceUrl,
      interviewId: vapiCallId,
      interviewStatus: "completed",
      scoreStatus: "pending",
      status: "completed",
      recruiterOwnerId: "anantsa@gmail.com",
      createdAt: now,
      updatedAt: now,
    });

    console.log(`Auto-created external_application ${docRef.id} from extension job context`);
    return docRef.id;
  } catch (error) {
    console.error("Error creating external_application from job context:", error);
    return null;
  }
}

/**
 * Auto-generate a recruiter score from the interview transcript using Gemini.
 * Writes to `application_scores` and updates the external_application's scoreStatus.
 */
async function generateRecruiterScore(
  applicationId: string,
  vapiCallId: string,
  vapiCallData: any
) {
  if (!genAI) {
    console.warn("GOOGLE_AI_API_KEY not set, skipping auto-score generation");
    return;
  }

  try {
    // Extract transcript from Vapi messages
    const messages = vapiCallData.artifact?.messages || vapiCallData.messages || [];
    const transcript = messages
      .filter((msg: any) => {
        if (msg.type === "transcript" && msg.transcriptType === "final") return true;
        if ((msg.role === "user" || msg.role === "assistant") && (msg.content || msg.message || msg.transcript)) return true;
        return false;
      })
      .map((msg: any) => {
        const role = msg.role === "user" ? "Candidate" : "Interviewer";
        const content = msg.transcript || msg.content || msg.message || "";
        return `${role}: ${content}`;
      })
      .join("\n");

    if (!transcript || transcript.trim().length < 50) {
      console.warn("Transcript too short for scoring, skipping");
      return;
    }

    // Update scoreStatus to processing
    await db.collection("external_applications").doc(applicationId).update({
      scoreStatus: "processing",
      updatedAt: new Date().toISOString(),
    });

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
      let retries = 2;
      let delay = 1500;

      while (retries >= 0) {
        try {
          console.log(`[AutoScore] Trying model: ${modelName}, retries left: ${retries}`);
          result = await model.generateContent(prompt);
          console.log(`[AutoScore] Model succeeded: ${modelName}`);
          break;
        } catch (e: any) {
          lastError = e;
          const msg = String(e?.message || "").toLowerCase();
          const transient =
            msg.includes("429") ||
            msg.includes("503") ||
            msg.includes("quota") ||
            msg.includes("high demand") ||
            msg.includes("service unavailable") ||
            msg.includes("too many requests");

          if (!transient || retries === 0) break;

          await new Promise((resolve) => setTimeout(resolve, delay));
          retries -= 1;
          delay *= 2;
        }
      }

      if (result) break;
    }

    if (!result) {
      throw lastError || new Error("All scoring models failed");
    }

    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid AI scoring response");

    const scoreData = JSON.parse(jsonMatch[0]);

    // Save to application_scores collection
    const scoreDoc = await db.collection("application_scores").add({
      applicationId,
      interviewId: vapiCallId,
      overallScore: Math.min(100, Math.max(0, scoreData.overallScore || 0)),
      technicalScore: Math.min(100, Math.max(0, scoreData.technicalScore || 0)),
      communicationScore: Math.min(100, Math.max(0, scoreData.communicationScore || 0)),
      problemSolvingScore: Math.min(100, Math.max(0, scoreData.problemSolvingScore || 0)),
      recommendation: scoreData.recommendation || "maybe",
      strengths: scoreData.strengths || [],
      weaknesses: scoreData.weaknesses || [],
      feedbackSummary: scoreData.feedbackSummary || "",
      generatedBy: "gemini",
      createdAt: new Date().toISOString(),
    });

    // Update the external_application with score info
    await db.collection("external_applications").doc(applicationId).update({
      scoreStatus: "available",
      scoreId: scoreDoc.id,
      updatedAt: new Date().toISOString(),
    });

    console.log(`[AutoScore] Score saved: ${scoreDoc.id} for application ${applicationId} (overall: ${scoreData.overallScore})`);
  } catch (error) {
    console.error("[AutoScore] Error generating recruiter score:", error);
    // Mark as failed so the UI can show an error state
    try {
      await db.collection("external_applications").doc(applicationId).update({
        scoreStatus: "failed",
        updatedAt: new Date().toISOString(),
      });
    } catch (_) {
      // ignore
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { vapiCallId, userId, jobContext } = await request.json();

    if (!vapiCallId || !userId) {
      return NextResponse.json(
        { error: "vapiCallId and userId are required" },
        { status: 400 }
      );
    }

    // Check if call log already exists
    const existingLog = await callLogService.getCallLogByVapiId(vapiCallId);
    if (existingLog) {
      return NextResponse.json(
        { message: "Call log already exists", id: existingLog.id },
        { status: 200 }
      );
    }

    // Fetch call data from Vapi
    const vapiCallData = await vapiCallDataService.getCall(vapiCallId);

    // Extract relevant data for Firestore
    const callLogData = {
      userId,
      vapiCallId: vapiCallData.id,
      assistantId: vapiCallData.assistant?.id || null,
      status: vapiCallData.status || "unknown",
      startedAt: vapiCallData.startedAt || new Date().toISOString(),
      endedAt: vapiCallData.endedAt || null,
      duration:
        vapiCallData.endedAt && vapiCallData.startedAt
          ? Math.round(
              (new Date(vapiCallData.endedAt).getTime() -
                new Date(vapiCallData.startedAt).getTime()) /
                1000
            )
          : null,
      cost: vapiCallData.cost || null,
      costBreakdown: vapiCallData.costBreakdown || null,
      messageCount: vapiCallData.artifact?.messages?.length || 0,
      hasRecording: !!(
        vapiCallData.artifact?.recordingUrl ||
        (vapiCallData as any).recordingUrl
      ),
      hasTranscript: !!(
        vapiCallData.artifact?.transcript || (vapiCallData as any).transcript
      ),
      summary: (vapiCallData as any).summary || null,
      analysis: (vapiCallData as any).analysis || null,
    };

    const logId = await callLogService.saveCallLog(callLogData);

    // If job context was provided (from extension), auto-create an external_application
    // and auto-generate a recruiter score using Gemini
    if (jobContext) {
      let userName = "";
      let userEmail = "";
      try {
        const userDoc = await db.collection("users").doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          userName = userData?.name || "";
          userEmail = userData?.email || "";
        }
      } catch (e) {
        console.warn("Could not fetch user data for external_application:", e);
      }

      const applicationId = await createExternalApplicationFromJobContext(
        jobContext,
        userId,
        vapiCallId,
        userName,
        userEmail
      );

      // Auto-score in the background (don't block the response)
      if (applicationId) {
        generateRecruiterScore(applicationId, vapiCallId, vapiCallData).catch((err) =>
          console.error("[AutoScore] Background scoring failed:", err)
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Call log saved successfully",
      id: logId,
    });
  } catch (error) {
    console.error("Error saving call log:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    const errorCode =
      error instanceof Error && "code" in error
        ? (error as any).code
        : undefined;

    return NextResponse.json(
      {
        error: "Failed to save call log",
        details: errorMessage,
        code: errorCode,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const callLogs = await callLogService.getCallLogsByUser(userId, limit);

    return NextResponse.json(callLogs);
  } catch (error) {
    console.error("Error fetching call logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch call logs" },
      { status: 500 }
    );
  }
}

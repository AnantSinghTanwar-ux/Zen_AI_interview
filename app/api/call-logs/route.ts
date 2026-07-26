import { NextRequest, NextResponse } from "next/server";
import { callLogService } from "@/services/firebase/call-log.service";
import { vapiCallDataService } from "@/services/vapi/call-data.service";
import { db } from "@/services/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { checkRateLimit } from "@/lib/services/rate-limit.service";
import { getPremiumSession } from "@/lib/services/payment.service";
import {
  acquireIdempotencyLock,
  completeIdempotencyLock,
  failIdempotencyLock,
  IdempotencyToken,
} from "@/lib/services/idempotency.service";
import { enqueueAndProcessRecruiterScoreJob } from "@/services/recruiter/recruiter-score-queue.service";

type TranscriptMessage = {
  type?: string;
  transcriptType?: string;
  role?: string;
  content?: string;
  message?: string;
  transcript?: string;
};

type VapiCallDataLike = {
  id?: string;
  assistant?: { id?: string };
  status?: string;
  startedAt?: string;
  endedAt?: string;
  cost?: number;
  costBreakdown?: unknown;
  summary?: string;
  analysis?: unknown;
  transcript?: string;
  recordingUrl?: string;
  messages?: TranscriptMessage[];
  artifact?: {
    transcript?: string;
    recordingUrl?: string;
    messages?: TranscriptMessage[];
  };
};

/**
 * Auto-create an external_application record when a candidate completes
 * an interview that was started via the browser extension (has job context).
 * Returns the created document ID so we can attach a score to it.
 */
async function createExternalApplicationFromJobContext(
  jobContextPayload: string | Record<string, unknown>,
  userId: string,
  vapiCallId: string,
  userName?: string,
  userEmail?: string
): Promise<string | null> {
  try {
    let parsedJobContext: Record<string, unknown> | null = null;

    if (typeof jobContextPayload === "string") {
      try {
        parsedJobContext = JSON.parse(jobContextPayload) as Record<string, unknown>;
      } catch (error) {
        console.warn("Invalid jobContext JSON, skipping external_application creation", error);
        return null;
      }
    } else if (jobContextPayload && typeof jobContextPayload === "object") {
      parsedJobContext = jobContextPayload as Record<string, unknown>;
    }

    if (!parsedJobContext) {
      return null;
    }

    const jobContext = parsedJobContext;
    const job = jobContext.job || jobContext;

    const cleanEntity = (value: string, maxLen: number) =>
      String(value || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLen);

    const cleanCompanyName = (value: string) => {
      let v = cleanEntity(value, 200);
      if (!v) return "";

      const lower = v.toLowerCase();

      // Common non-company values seen on job boards (LinkedIn often shows employee count).
      if (/(\bemployees?\b|\bfollowers?\b)/i.test(v)) return "";

      // Chop off common trailing UI fragments.
      const cutMarkers = [
        " apply now",
        " easy apply",
        " resume",
        " your current resume",
        " see application",
        " promoted",
      ];
      for (const marker of cutMarkers) {
        const idx = lower.indexOf(marker);
        if (idx > 0) {
          v = v.slice(0, idx).trim();
          break;
        }
      }

      // Split on separators frequently used by job boards.
      v = v.split(" · ")[0].split(" | ")[0].trim();

      return cleanEntity(v, 120);
    };

    const cleanRoleTitle = (value: string) => {
      let v = cleanEntity(value, 220);
      if (!v) return "";

      v = v.replace(/^\(\d+\)\s*/, "").trim();
      v = v.replace(/\s*[|]\s*linkedin.*$/i, "").trim();
      v = v.replace(/\s*-\s*linkedin.*$/i, "").trim();

      const lower = v.toLowerCase();
      const cutMarkers = [" apply now", " easy apply", " resume", " your current resume", " see application"];
      for (const marker of cutMarkers) {
        const idx = lower.indexOf(marker);
        if (idx > 0) {
          v = v.slice(0, idx).trim();
          break;
        }
      }

      if (
        /^(?:top\s+jobs?(?:\s+picks)?\s+for\s+you|jobs?\s+for\s+you|recommended\s+jobs?|search\s+results?)$/i.test(v)
      ) {
        return "";
      }

      return cleanEntity(v, 160);
    };

    const extractRoleTitleFromDescription = (value: string) => {
      const text = cleanEntity(value, 6000);
      if (!text) return "";

      const roleMatch = text.match(/(?:role|position|job title)\s*[:\-]\s*([^\n,.]{3,120})/i);
      if (roleMatch?.[1]) {
        return cleanRoleTitle(roleMatch[1]);
      }

      const firstLine = text
        .split(/\n|\./)
        .map((line) => cleanEntity(line, 160))
        .find((line) => line.length >= 4 && line.length <= 90);

      return cleanRoleTitle(firstLine || "");
    };

    const extractCompanyFromDescription = (value: string) => {
      const text = cleanEntity(value, 6000);
      if (!text) return "";

      const aboutMatch = text.match(/\babout\s+([A-Z][A-Za-z0-9&.,\-\s]{2,80})/);
      if (aboutMatch?.[1]) {
        return cleanCompanyName(aboutMatch[1]);
      }

      const atMatch = text.match(/\b(?:at|for)\s+([A-Z][A-Za-z0-9&.,\-\s]{2,80})/);
      if (atMatch?.[1]) {
        return cleanCompanyName(atMatch[1]);
      }

      return "";
    };

    const titleRaw = cleanEntity(job.title || "", 220);
    const title =
      cleanRoleTitle(titleRaw) ||
      cleanRoleTitle(cleanEntity(job.roleTitle || job.position || "", 220)) ||
      extractRoleTitleFromDescription(cleanEntity(job.description || "", 6000));

    const companyCandidate = cleanEntity(
      job.companyName || job.company?.name || job.company || job.organization || job.employer || "",
      200
    );
    const company = cleanCompanyName(companyCandidate) || extractCompanyFromDescription(cleanEntity(job.description || "", 6000));
    const sourceUrl = cleanEntity(jobContext.sourceUrl || "", 600);

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

    // Check if an application already exists for this user + role + company.
    // Prefer candidateEmail when available; fallback to candidateUserId otherwise.
    const normalizedEmail = (userEmail || "").toLowerCase();
    let existingQuery: FirebaseFirestore.Query = db
      .collection("external_applications")
      .where("roleTitle", "==", title)
      .where("companyName", "==", company || "Unknown");

    existingQuery = normalizedEmail
      ? existingQuery.where("candidateEmail", "==", normalizedEmail)
      : existingQuery.where("candidateUserId", "==", userId);

    const existing = await existingQuery.limit(1).get();

    if (!existing.empty) {
      const docId = existing.docs[0].id;
      await db.collection("external_applications").doc(docId).update({
        candidateUserId: userId,
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
      candidateUserId: userId,
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

export async function POST(request: NextRequest) {
  let idempotencyToken: IdempotencyToken | null = null;

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed, response } = await checkRateLimit(request, user.id, "call-logs-write");
    if (!allowed) return response!;

    const idempotency = await acquireIdempotencyLock({
      request,
      userId: user.id,
      scope: "call-logs:create",
    });

    if (idempotency.state === "invalid") {
      return NextResponse.json({ error: idempotency.error }, { status: 400 });
    }

    if (idempotency.state === "in-progress") {
      return NextResponse.json(
        {
          error: "Idempotent request is already being processed",
          retryAfter: idempotency.retryAfterSeconds,
        },
        {
          status: 409,
          headers: {
            "Retry-After": String(idempotency.retryAfterSeconds),
          },
        }
      );
    }

    if (idempotency.state === "replay") {
      return NextResponse.json(idempotency.body, { status: idempotency.status });
    }

    if (idempotency.state === "acquired") {
      idempotencyToken = idempotency.token;
    }

    const { vapiCallId, userId, jobContext, sessionId, scheduleId } = await request.json();

    if (!vapiCallId) {
      if (idempotencyToken) {
        await failIdempotencyLock({
          token: idempotencyToken,
          error: "vapiCallId is required",
        });
      }
      return NextResponse.json(
        { error: "vapiCallId is required" },
        { status: 400 }
      );
    }

    if (!sessionId) {
      if (idempotencyToken) {
        await failIdempotencyLock({
          token: idempotencyToken,
          error: "sessionId is required",
        });
      }
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    if (userId && userId !== user.id) {
      if (idempotencyToken) {
        await failIdempotencyLock({
          token: idempotencyToken,
          error: "User mismatch",
        });
      }
      return NextResponse.json(
        { error: "User mismatch" },
        { status: 403 }
      );
    }

    let premiumSession: Awaited<ReturnType<typeof getPremiumSession>> | null = null;
    if (sessionId) {
      premiumSession = await getPremiumSession(sessionId);
      if (!premiumSession || premiumSession.userId !== user.id || premiumSession.feature !== "interview") {
        if (idempotencyToken) {
          await failIdempotencyLock({
            token: idempotencyToken,
            error: "Invalid or expired interview session",
          });
        }
        return NextResponse.json(
          { error: "Invalid or expired interview session" },
          { status: 403 }
        );
      }
    }

    const getUserIdentityForExternalApp = async () => {
      let userName = "";
      let userEmail = "";
      try {
        const userDoc = await db.collection("users").doc(user.id).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          userName = userData?.name || "";
          userEmail = userData?.email || "";
        }
      } catch (e) {
        console.warn("Could not fetch user data for external_application:", e);
      }
      return { userName, userEmail };
    };

    const ensureRecruiterPipelineForJobContext = async (callIdForPipeline: string) => {
      if (!jobContext) {
        return;
      }

      const { userName, userEmail } = await getUserIdentityForExternalApp();
      const applicationId = await createExternalApplicationFromJobContext(
        jobContext,
        user.id,
        callIdForPipeline,
        userName,
        userEmail
      );

      if (applicationId) {
        // Fire-and-forget: enqueue AND immediately process the scoring job.
        // This means the score is generated right after the interview ends,
        // without needing a separate cron or manual process-scores trigger.
        enqueueAndProcessRecruiterScoreJob({
          applicationId,
          interviewId: callIdForPipeline,
        });
      }
    };

    const processInternalInterviewEvaluation = async (schedId: string, msgs: any[], details: any) => {
      try {
        const { schedulingService } = await import("@/services/recruiter/scheduling.service");
        const { applicantService } = await import("@/services/recruiter/applicant.service");
        const { interviewEvaluationService } = await import("@/services/interview/interview-evaluation.service");

        const schedule = await schedulingService.getSchedule(schedId);
        if (schedule && schedule.applicantId) {
          console.log(`Evaluating internal interview for schedule ${schedId}...`);
          const evalResult = await interviewEvaluationService.evaluateInterview(msgs, details);
          
          const score = (evalResult.overallRating || 0) * 10;

          await applicantService.updateApplicantStatus(schedule.applicantId, "completed", {
            // @ts-ignore - dynamic extras
            interviewScore: score,
            interviewRecommendation: evalResult.recommendation,
          });

          await schedulingService.updateScheduleStatus(schedId, "completed");

          await db.collection("interview_evaluations").add({
            applicantId: schedule.applicantId,
            scheduleId: schedId,
            jobId: schedule.jobId,
            evaluation: evalResult,
            vapiCallId,
            createdAt: new Date().toISOString()
          });
          console.log(`Finished evaluating internal interview for schedule ${schedId}`);
        }
      } catch (err) {
        console.error("Failed to process internal interview evaluation:", err);
      }
    };

    // Check if call log already exists
    const existingLog = await callLogService.getCallLogByVapiId(vapiCallId);
    if (existingLog) {
      await ensureRecruiterPipelineForJobContext(vapiCallId);

      const payload = {
        message: "Call log already exists",
        id: existingLog.id,
      };

      if (idempotencyToken) {
        await completeIdempotencyLock({
          token: idempotencyToken,
          status: 200,
          body: payload,
        });
      }

      return NextResponse.json(payload, { status: 200 });
    }

    // Fetch call data from Vapi. If unavailable, still persist a minimal call log.
    let vapiCallData: VapiCallDataLike | null = null;
    try {
      vapiCallData = await vapiCallDataService.getCall(vapiCallId);
    } catch (vapiError) {
      console.warn(
        `[CallLogs] Could not fetch Vapi call ${vapiCallId}. Saving minimal call log fallback.`,
        vapiError
      );
    }

    const artifactTranscript =
      typeof vapiCallData?.artifact?.transcript === "string"
        ? String(vapiCallData.artifact.transcript)
        : "";

    const rawMessages: TranscriptMessage[] =
      vapiCallData?.artifact?.messages || vapiCallData?.messages || [];
    const transcriptFromMessages = rawMessages
      .filter((msg) => {
        if (msg.type === "transcript" && msg.transcriptType === "final") return true;
        if ((msg.role === "user" || msg.role === "assistant" || msg.role === "bot") && (msg.content || msg.message || msg.transcript)) return true;
        return false;
      })
      .map((msg) => {
        const roleValue = String(msg.role || "").toLowerCase();
        const role =
          roleValue === "user" || roleValue === "human" || roleValue === "candidate"
            ? "Candidate"
            : "Interviewer";
        const content =
          (typeof msg.transcript === "string" && msg.transcript) ||
          (typeof msg.content === "string" && msg.content) ||
          (typeof msg.message === "string" && msg.message) ||
          "";
        return `${role}: ${content}`;
      })
      .join("\n")
      .trim();

    const normalizedArtifactTranscript = artifactTranscript.trim();

    const transcript =
      transcriptFromMessages.length >= 50 &&
      /(^|\n)\s*Candidate\s*:/i.test(transcriptFromMessages)
        ? transcriptFromMessages
        : normalizedArtifactTranscript.length >= 50
          ? normalizedArtifactTranscript
          : transcriptFromMessages || normalizedArtifactTranscript;

    // Extract relevant data for Firestore
    const callLogData = {
      userId: user.id,
      vapiCallId: vapiCallData?.id || vapiCallId,
      assistantId: vapiCallData?.assistant?.id || null,
      status: vapiCallData?.status || "completed",
      startedAt: vapiCallData?.startedAt || new Date().toISOString(),
      endedAt: vapiCallData?.endedAt || null,
      duration:
        vapiCallData?.endedAt && vapiCallData?.startedAt
          ? Math.round(
              (new Date(vapiCallData.endedAt).getTime() -
                new Date(vapiCallData.startedAt).getTime()) /
                1000
            )
          : null,
      cost: vapiCallData?.cost || null,
      costBreakdown: vapiCallData?.costBreakdown || null,
      messageCount: vapiCallData?.artifact?.messages?.length || 0,
      hasRecording: !!(
        vapiCallData?.artifact?.recordingUrl ||
        vapiCallData?.recordingUrl
      ),
      hasTranscript: !!(
        transcript || vapiCallData?.artifact?.transcript || vapiCallData?.transcript
      ),
      transcript: transcript || null,
      summary: vapiCallData?.summary || null,
      analysis: vapiCallData?.analysis || null,
      sessionId: sessionId || null,
      timeLimitMinutes: premiumSession?.timeLimitMinutes || null,
      durationExceeded: false,
    };

    if (premiumSession?.expiresAtMs && callLogData.endedAt) {
      const endedAtMs = new Date(callLogData.endedAt).getTime();
      const graceMs = 15_000;
      callLogData.durationExceeded = endedAtMs > premiumSession.expiresAtMs + graceMs;
    }

    const logId = await callLogService.saveCallLog(callLogData);

    // If job context was provided (from extension), auto-create an external_application
    // and enqueue recruiter score generation asynchronously.
    await ensureRecruiterPipelineForJobContext(vapiCallId);

    if (scheduleId) {
      // Fire-and-forget internal evaluation
      processInternalInterviewEvaluation(
        scheduleId, 
        vapiCallData?.artifact?.messages || vapiCallData?.messages || [], 
        {
          duration: callLogData.duration,
          status: callLogData.status,
          messageCount: callLogData.messageCount
        }
      ).catch(console.error);
    }

    const payload = {
      success: true,
      message: "Call log saved successfully",
      id: logId,
    };

    if (idempotencyToken) {
      await completeIdempotencyLock({
        token: idempotencyToken,
        status: 200,
        body: payload,
      });
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Error saving call log:", error);

    if (idempotencyToken) {
      await failIdempotencyLock({
        token: idempotencyToken,
        error,
      });
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: unknown }).code
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
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed, response } = await checkRateLimit(request, user.id, "call-logs");
    if (!allowed) return response!;

    const { searchParams } = new URL(request.url);
    // Users can only fetch their own call logs
    const userId = user.id;
    const rawLimit = Number(searchParams.get("limit"));
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.floor(rawLimit), 100)
        : 20;

    const callLogs = await callLogService.getCallLogsByUser(userId, limit);

    return NextResponse.json(callLogs);
  } catch (error) {
    console.error("Error fetching call logs:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch call logs";

    return NextResponse.json(
      {
        error: "Failed to fetch call logs",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    );
  }
}

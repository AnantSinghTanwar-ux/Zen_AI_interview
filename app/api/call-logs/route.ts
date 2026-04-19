import { NextRequest, NextResponse } from "next/server";
import { callLogService } from "@/services/firebase/call-log.service";
import { vapiCallDataService } from "@/services/vapi/call-data.service";
import { db } from "@/services/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { checkRateLimit } from "@/lib/services/rate-limit.service";
import {
  acquireIdempotencyLock,
  completeIdempotencyLock,
  failIdempotencyLock,
  IdempotencyToken,
} from "@/lib/services/idempotency.service";
import { enqueueRecruiterScoreJob } from "@/services/recruiter/recruiter-score-queue.service";

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

      const lower = v.toLowerCase();
      const cutMarkers = [" apply now", " easy apply", " resume", " your current resume", " see application"];
      for (const marker of cutMarkers) {
        const idx = lower.indexOf(marker);
        if (idx > 0) {
          v = v.slice(0, idx).trim();
          break;
        }
      }

      return cleanEntity(v, 160);
    };

    const titleRaw = cleanEntity(job.title || "", 220);
    const title = cleanRoleTitle(titleRaw) || titleRaw;

    const companyCandidate = cleanEntity(
      job.companyName || job.company?.name || job.company || job.organization || job.employer || "",
      200
    );
    const company = cleanCompanyName(companyCandidate);
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

    const { vapiCallId, userId, jobContext } = await request.json();

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

    // Check if call log already exists
    const existingLog = await callLogService.getCallLogByVapiId(vapiCallId);
    if (existingLog) {
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
        const role = msg.role === "user" ? "Candidate" : "Interviewer";
        const content =
          (typeof msg.transcript === "string" && msg.transcript) ||
          (typeof msg.content === "string" && msg.content) ||
          (typeof msg.message === "string" && msg.message) ||
          "";
        return `${role}: ${content}`;
      })
      .join("\n");

    const transcript = artifactTranscript.trim().length >= 50
      ? artifactTranscript.trim()
      : transcriptFromMessages;

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
        vapiCallData?.artifact?.transcript || vapiCallData?.transcript
      ),
      transcript: transcript || null,
      summary: vapiCallData?.summary || null,
      analysis: vapiCallData?.analysis || null,
    };

    const logId = await callLogService.saveCallLog(callLogData);

    // If job context was provided (from extension), auto-create an external_application
    // and enqueue recruiter score generation asynchronously.
    if (jobContext) {
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

      const applicationId = await createExternalApplicationFromJobContext(
        jobContext,
        user.id,
        vapiCallId,
        userName,
        userEmail
      );

      // Queue score generation in the background (don't block the response)
      if (applicationId) {
        enqueueRecruiterScoreJob({
          applicationId,
          interviewId: vapiCallId,
        }).catch((err) => {
          console.error("[AutoScoreQueue] Failed to enqueue recruiter score job:", err);
        });
      }
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

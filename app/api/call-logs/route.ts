import { NextRequest, NextResponse } from "next/server";
import { callLogService } from "@/services/firebase/call-log.service";
import { vapiCallDataService } from "@/services/vapi/call-data.service";
import { db } from "@/services/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.actions";

/**
 * Auto-create an external_application record when a candidate completes
 * an interview that was started via the browser extension (has job context).
 * This bridges the extension flow into the recruiter analytics pipeline.
 */
async function createExternalApplicationFromJobContext(
  jobContextJson: string,
  userId: string,
  vapiCallId: string,
  userName?: string,
  userEmail?: string
) {
  try {
    const jobContext = JSON.parse(jobContextJson);
    const job = jobContext.job || jobContext;

    const title = (job.title || "").trim();
    const company = (job.company || "").trim();
    const description = (job.description || "").trim();
    const sourceUrl = (jobContext.sourceUrl || "").trim();

    if (!title && !company) {
      console.warn("Job context missing title and company, skipping external_application creation");
      return;
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
      // Update existing application with interview info
      const docId = existing.docs[0].id;
      await db.collection("external_applications").doc(docId).update({
        interviewStatus: "completed",
        interviewId: vapiCallId,
        status: "completed",
        updatedAt: new Date().toISOString(),
      });
      console.log(`Updated existing external_application ${docId} with interview data`);
      return;
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
      recruiterOwnerId: "anantsa@gmail.com", // hardcoded demo recruiter
      createdAt: now,
      updatedAt: now,
    });

    console.log(`Auto-created external_application ${docRef.id} from extension job context`);
  } catch (error) {
    // Don't fail the main call-log save if this fails
    console.error("Error creating external_application from job context:", error);
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
    // so the interview shows up in the recruiter dashboard
    if (jobContext) {
      // Fetch user info for the application record
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

      await createExternalApplicationFromJobContext(
        jobContext,
        userId,
        vapiCallId,
        userName,
        userEmail
      );
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

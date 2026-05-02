import { NextRequest, NextResponse } from "next/server";
import { recruiterGuard } from "@/app/api/v2/recruiter/_guard";
import { getApplications } from "@/services/recruiter/external-application.service";
import { enqueueRecruiterScoreJob } from "@/services/recruiter/recruiter-score-queue.service";
import { db } from "@/services/firebase/admin";
import { checkRateLimit } from "@/lib/services/rate-limit.service";

/**
 * POST /api/v2/recruiter/rescore
 * Force re-score all completed interviews by clearing existing stale scores
 * and re-enqueueing them for fresh AI analysis.
 */
export async function POST(request: NextRequest) {
  const { user, error } = await recruiterGuard();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed, response } = await checkRateLimit(request, user.id, "recruiter-write");
  if (!allowed) return response!;

  try {
    let allApps;
    try {
      allApps = await getApplications();
    } catch (fbErr) {
      console.error("[Rescore] Firebase error fetching apps:", (fbErr as Error).message);
      return NextResponse.json(
        { error: "Quota Exhausted", details: "Firebase quota reached. Please upgrade to Blaze plan or try again tomorrow." },
        { status: 429 }
      );
    }

    const completedApps = allApps.filter(
      (a) => a.interviewStatus === "completed" && Boolean(a.interviewId)
    );

    if (completedApps.length === 0) {
      return NextResponse.json({ message: "No completed interviews to re-score", enqueued: 0 }, { status: 200 });
    }

    let enqueued = 0;
    let cleared = 0;

    for (const app of completedApps) {
      try {
        // Clear existing stale scores for this application
        const existingScores = await db
          .collection("application_scores")
          .where("applicationId", "==", app.id)
          .get();

        if (!existingScores.empty) {
          const batch = db.batch();
          existingScores.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
          cleared += existingScores.size;
        }

        // Clear existing jobs so they can be re-enqueued
        const existingJobs = await db
          .collection("recruiter_score_jobs")
          .where("applicationId", "==", app.id)
          .get();

        if (!existingJobs.empty) {
          const batch = db.batch();
          existingJobs.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }

        // Update application score status to pending
        await db.collection("external_applications").doc(app.id).update({
          scoreStatus: "pending",
          scoreId: "",
          updatedAt: new Date().toISOString(),
        });

        // Enqueue fresh scoring job
        await enqueueRecruiterScoreJob({
          applicationId: app.id,
          interviewId: String(app.interviewId),
        });

        enqueued++;
      } catch (innerErr) {
        console.error(`[Rescore] Error processing app ${app.id}:`, (innerErr as Error).message);
        // If we hit a quota error mid-loop, stop and return what we managed to do
        if ((innerErr as Error).message.includes("Quota") || (innerErr as Error).message.includes("exhausted")) {
          return NextResponse.json(
            {
              message: `Re-scoring partially initiated before quota limit.`,
              enqueued,
              clearedScores: cleared,
              error: "Firebase quota reached mid-process."
            },
            { status: 200 } // Return 200 because some work was done
          );
        }
        // Continue for other apps on minor errors
      }
    }

    return NextResponse.json(
      {
        message: `Re-scoring initiated for ${enqueued} applications`,
        enqueued,
        clearedScores: cleared,
        totalCompleted: completedApps.length,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Rescore error:", err);
    return NextResponse.json(
      { error: "Failed to initiate re-scoring", details: (err as Error).message },
      { status: 500 }
    );
  }
}

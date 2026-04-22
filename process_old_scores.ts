import { db } from "./services/firebase/admin";
import { processRecruiterScoreJob } from "./services/recruiter/recruiter-score-queue.service";
import { getApplications } from "./services/recruiter/external-application.service";

async function run() {
  console.log("Fetching applications...");
  const apps = await getApplications();
  
  const stuckApps = apps.filter(
    (a) => a.interviewStatus === "completed" && a.scoreStatus !== "available" && Boolean(a.interviewId)
  );

  console.log(`Found ${stuckApps.length} completed interviews that need scoring.`);

  let processed = 0;
  for (const app of stuckApps) {
    console.log(`Processing ${app.id} (${app.candidateName})...`);
    
    // Clear any existing jobs to start fresh
    const existingJobs = await db
      .collection("recruiter_score_jobs")
      .where("applicationId", "==", app.id)
      .get();

    if (!existingJobs.empty) {
      const batch = db.batch();
      existingJobs.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      console.log(`  Cleared ${existingJobs.size} old jobs for ${app.id}`);
    }

    // Force application scoreStatus to pending
    await db.collection("external_applications").doc(app.id).update({
      scoreStatus: "pending",
      scoreId: "",
      updatedAt: new Date().toISOString(),
    });

    const now = new Date().toISOString();
    const payload = {
      applicationId: app.id,
      interviewId: String(app.interviewId),
      status: "pending" as const,
      retryCount: 0,
      createdAt: now,
      startedAt: null,
      completedAt: null,
      scoreId: null,
      modelUsed: null,
      processingTimeMs: 0,
      error: null,
    };

    const ref = await db.collection("recruiter_score_jobs").add(payload);

    try {
      console.log(`  Waiting for AI to score ${app.id}...`);
      await processRecruiterScoreJob(ref.id, payload);
      console.log(`  Successfully finished ${app.id}.`);
    } catch (e) {
      console.error(`  Failed to process ${app.id}:`, e);
    }
    
    processed++;
  }

  console.log(`Finished processing all ${processed} apps synchronously.`);
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

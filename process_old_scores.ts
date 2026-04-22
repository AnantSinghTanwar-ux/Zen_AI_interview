import { db } from "./services/firebase/admin";
import { processRecruiterScoreJob } from "./services/recruiter/recruiter-score-queue.service";

async function run() {
  const appId = "aWeWs9ynVGUm7Vg5AmuH";
  const appDoc = await db.collection("external_applications").doc(appId).get();
  const app = appDoc.data();
  if (!app) { console.error("App not found"); process.exit(1); }

  console.log(`Processing ${appId} (${app.candidateName})...`);

  // Clear any existing jobs
  const existingJobs = await db
    .collection("recruiter_score_jobs")
    .where("applicationId", "==", appId)
    .get();

  if (!existingJobs.empty) {
    const batch = db.batch();
    existingJobs.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    console.log(`  Cleared ${existingJobs.size} old jobs`);
  }

  // Reset status
  await db.collection("external_applications").doc(appId).update({
    scoreStatus: "pending",
    scoreId: "",
    updatedAt: new Date().toISOString(),
  });

  const now = new Date().toISOString();
  const payload = {
    applicationId: appId,
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
  console.log(`  Created job ${ref.id}, processing...`);

  try {
    await processRecruiterScoreJob(ref.id, payload);
    console.log(`  Done!`);
  } catch (e) {
    console.error(`  Failed:`, e);
  }

  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });

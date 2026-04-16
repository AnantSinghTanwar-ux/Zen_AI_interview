import { db } from "@/services/firebase/admin";
import { ApplicationScore, LeaderboardEntry } from "@/types/external-application";

const COLLECTION = "application_scores";

export async function saveScore(data: Omit<ApplicationScore, "id" | "createdAt">): Promise<string> {
  const docRef = await db.collection(COLLECTION).add({
    ...data,
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
}

export async function getScoreByApplication(applicationId: string): Promise<ApplicationScore | null> {
  const snapshot = await db
    .collection(COLLECTION)
    .where("applicationId", "==", applicationId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as ApplicationScore;
}

export async function getScoreByInterview(interviewId: string): Promise<ApplicationScore | null> {
  const snapshot = await db
    .collection(COLLECTION)
    .where("interviewId", "==", interviewId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as ApplicationScore;
}

export async function getLeaderboard(filters?: {
  roleCategory?: string;
  companyName?: string;
  sourcePlatform?: string;
}): Promise<LeaderboardEntry[]> {
  // Get all applications that have scores
  const appsCollection = db.collection("external_applications");
  let query: FirebaseFirestore.Query = appsCollection.where("scoreStatus", "==", "available");

  if (filters?.roleCategory) query = query.where("roleCategory", "==", filters.roleCategory);
  if (filters?.companyName) query = query.where("companyName", "==", filters.companyName);
  if (filters?.sourcePlatform) query = query.where("sourcePlatform", "==", filters.sourcePlatform);

  const appsSnapshot = await query.get();

  const entries: LeaderboardEntry[] = [];

  for (const doc of appsSnapshot.docs) {
    const app = doc.data();
    const score = await getScoreByApplication(doc.id);
    if (!score) continue;

    entries.push({
      rank: 0, // Will be set after sorting
      applicationId: doc.id,
      candidateName: app.candidateName,
      candidateEmail: app.candidateEmail,
      roleTitle: app.roleTitle,
      companyName: app.companyName,
      sourcePlatform: app.sourcePlatform,
      overallScore: score.overallScore,
      technicalScore: score.technicalScore,
      communicationScore: score.communicationScore,
      problemSolvingScore: score.problemSolvingScore,
      recommendation: score.recommendation,
    });
  }

  // Sort by overall score descending
  entries.sort((a, b) => b.overallScore - a.overallScore);

  // Assign ranks
  entries.forEach((entry, idx) => {
    entry.rank = idx + 1;
  });

  return entries;
}

export async function getAllScores(): Promise<ApplicationScore[]> {
  const snapshot = await db.collection(COLLECTION).get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ApplicationScore[];
}

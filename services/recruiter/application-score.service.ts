import { db } from "@/services/firebase/admin";
import {
  ApplicationScore,
  LeaderboardEntry,
  ExternalApplication,
} from "@/types/external-application";

const COLLECTION = "application_scores";

function clampScore(value: number, min = 0, max = 100): number {
  const normalized = Number.isFinite(Number(value)) ? Number(value) : min;
  return Math.max(min, Math.min(max, Math.round(normalized)));
}

function normalizeOverallByRecommendation(
  overallScore: number,
  recommendation: string
): number {
  const normalized = clampScore(overallScore);
  const rec = String(recommendation || "").trim().toLowerCase();

  if (rec === "no_hire") {
    return Math.min(normalized, 45);
  }

  if (rec === "maybe") {
    return Math.min(normalized, 64);
  }

  if (rec === "hire") {
    return Math.max(70, Math.min(normalized, 89));
  }

  if (rec === "strong_hire") {
    return Math.max(90, normalized);
  }

  return normalized;
}

export function normalizeRecruiterScoreForDisplay(
  score: ApplicationScore
): ApplicationScore {
  const overall = normalizeOverallByRecommendation(
    score.overallScore,
    score.recommendation
  );

  const technical = clampScore(score.technicalScore);
  const communication = clampScore(score.communicationScore);
  const problemSolving = clampScore(score.problemSolvingScore);

  const cappedTechnical = overall <= 45 ? Math.min(technical, 50) : technical;
  const cappedCommunication =
    overall <= 45 ? Math.min(communication, 52) : communication;
  const cappedProblemSolving =
    overall <= 45 ? Math.min(problemSolving, 50) : problemSolving;

  return {
    ...score,
    overallScore: overall,
    technicalScore: cappedTechnical,
    communicationScore: cappedCommunication,
    problemSolvingScore: cappedProblemSolving,
  };
}

function computeStrictFallbackScore(app: ExternalApplication): {
  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  problemSolvingScore: number;
  recommendation: "strong_hire" | "hire" | "maybe" | "no_hire";
} {
  let overall = 0;

  if (app.interviewStatus === "completed") overall = 38;
  else if (app.interviewStatus === "in_progress") overall = 24;
  else if (app.interviewStatus === "invited") overall = 14;
  else overall = 8;

  if (app.status === "shortlisted") {
    overall = Math.max(overall, 55);
  } else if (app.status === "rejected") {
    overall = Math.min(overall, 22);
  }

  const nameHash = String(app.candidateName || "")
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const variance = (nameHash % 12) - 6;
  overall = clampScore(overall + variance, 5, 95);

  let recommendation: "strong_hire" | "hire" | "maybe" | "no_hire" =
    "no_hire";
  if (app.status === "rejected") recommendation = "no_hire";
  else if (overall >= 90) recommendation = "strong_hire";
  else if (overall >= 82) recommendation = "hire";
  else if (overall >= 60) recommendation = "maybe";

  return {
    overallScore: overall,
    technicalScore: clampScore(overall + ((nameHash % 8) - 5), 5, 95),
    communicationScore: clampScore(overall + ((nameHash % 6) - 4), 5, 95),
    problemSolvingScore: clampScore(overall + ((nameHash % 10) - 6), 5, 95),
    recommendation,
  };
}

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
  const appsCollection = db.collection("external_applications");
  let query: FirebaseFirestore.Query = appsCollection;

  if (filters?.roleCategory) query = query.where("roleCategory", "==", filters.roleCategory);
  if (filters?.companyName) query = query.where("companyName", "==", filters.companyName);
  if (filters?.sourcePlatform) query = query.where("sourcePlatform", "==", filters.sourcePlatform);

  const appsSnapshot = await query.get();

  const entries: LeaderboardEntry[] = [];

  for (const doc of appsSnapshot.docs) {
    const app = doc.data() as ExternalApplication;
    const shouldCheckScore =
      app.scoreStatus === "available" ||
      app.interviewStatus === "completed" ||
      app.interviewStatus === "in_progress" ||
      app.status === "shortlisted";

    const persistedScore = shouldCheckScore
      ? await getScoreByApplication(doc.id)
      : null;

    const score = persistedScore
      ? normalizeRecruiterScoreForDisplay(persistedScore)
      : app.interviewStatus === "completed" ||
        app.interviewStatus === "in_progress" ||
        app.status === "shortlisted"
      ? computeStrictFallbackScore(app)
      : null;

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

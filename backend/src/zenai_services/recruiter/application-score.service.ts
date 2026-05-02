import { db } from "@/services/firebase/admin";
import {
  ApplicationScore,
  LeaderboardEntry,
  ExternalApplication,
} from "@/types/external-application";
import {
  attachScoreIntegrityFields,
  buildScoreFingerprintInput,
  verifyScoreSignature,
} from "@/services/recruiter/score-integrity.service";

const COLLECTION = "application_scores";

function toMillis(value: unknown): number {
  const ms = new Date(String(value || "")).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function getValidatedScoreFromDoc(
  doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>
): ApplicationScore | null {
  const raw = doc.data() as ApplicationScore & { signature?: string; sealed?: boolean };
  const score = { id: doc.id, ...raw } as ApplicationScore;

  const fingerprintPayload = buildScoreFingerprintInput(score);
  const validSignature = verifyScoreSignature({
    payload: fingerprintPayload,
    expectedSignature: raw.signature,
  });

  if (!raw.sealed || !validSignature) {
    return null;
  }

  return score;
}

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
  return {
    ...score,
    overallScore: clampScore(score.overallScore),
    technicalScore: clampScore(score.technicalScore),
    communicationScore: clampScore(score.communicationScore),
    problemSolvingScore: clampScore(score.problemSolvingScore),
  };
}

function computeStrictFallbackScore(app: ExternalApplication): {
  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  problemSolvingScore: number;
  recommendation: "strong_hire" | "hire" | "maybe" | "no_hire";
} {
  let overall = 6;

  if (app.interviewStatus === "completed") overall = 12;
  else if (app.interviewStatus === "in_progress") overall = 7;
  else if (app.interviewStatus === "invited") overall = 5;
  else overall = 4;

  if (app.status === "shortlisted") {
    overall = Math.max(overall, 18);
  } else if (app.status === "rejected") {
    overall = Math.min(overall, 6);
  }

  overall = clampScore(overall, 0, 100);

  let recommendation: "strong_hire" | "hire" | "maybe" | "no_hire" =
    "no_hire";
  if (app.status === "rejected") recommendation = "no_hire";
  else if (overall >= 90) recommendation = "strong_hire";
  else if (overall >= 80) recommendation = "hire";
  else if (overall >= 60) recommendation = "maybe";

  return {
    overallScore: overall,
    technicalScore: clampScore(Math.max(0, overall - 2), 0, 100),
    communicationScore: clampScore(Math.max(0, overall - 1), 0, 100),
    problemSolvingScore: clampScore(Math.max(0, overall - 3), 0, 100),
    recommendation,
  };
}

export async function saveScore(
  data: Omit<ApplicationScore, "id" | "createdAt">,
  metadata?: Record<string, unknown>
): Promise<string> {
  const createdAt = new Date().toISOString();
  const { signature } = attachScoreIntegrityFields({
    ...data,
    createdAt,
  });

  const docRef = await db.collection(COLLECTION).add({
    ...data,
    createdAt,
    signature,
    sealed: true,
    lockedBy: "recruiter-score-pipeline",
    schemaVersion: 2,
    ...(metadata || {}),
  });
  return docRef.id;
}

export async function getScoreByApplication(applicationId: string): Promise<ApplicationScore | null> {
  const snapshot = await db
    .collection(COLLECTION)
    .where("applicationId", "==", applicationId)
    .get();

  if (snapshot.empty) return null;

  const sortedDocs = [...snapshot.docs].sort((a, b) => {
    return toMillis(b.data()?.createdAt) - toMillis(a.data()?.createdAt);
  });

  for (const doc of sortedDocs) {
    const score = getValidatedScoreFromDoc(doc);
    if (score) return score;
  }

  return null;
}

export async function getScoreByInterview(interviewId: string): Promise<ApplicationScore | null> {
  const snapshot = await db
    .collection(COLLECTION)
    .where("interviewId", "==", interviewId)
    .get();

  if (snapshot.empty) return null;

  const sortedDocs = [...snapshot.docs].sort((a, b) => {
    return toMillis(b.data()?.createdAt) - toMillis(a.data()?.createdAt);
  });

  for (const doc of sortedDocs) {
    const score = getValidatedScoreFromDoc(doc);
    if (score) return score;
  }

  return null;
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

    // Only include candidates with actual AI-generated scores
    // No more fake fallback scores that give everyone the same number
    const score = persistedScore
      ? normalizeRecruiterScoreForDisplay(persistedScore)
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
  return snapshot.docs
    .sort((a, b) => toMillis(b.data()?.createdAt) - toMillis(a.data()?.createdAt))
    .map((doc) => getValidatedScoreFromDoc(doc))
    .filter(Boolean) as ApplicationScore[];
}

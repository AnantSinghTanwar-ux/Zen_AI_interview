import { db } from "@/services/firebase/admin";
import { RecruitmentJob } from "@/types/recruiter";

function isMissingIndexError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const maybeError = error as {
    code?: unknown;
    details?: unknown;
    message?: unknown;
  };

  const code = typeof maybeError.code === "number" ? maybeError.code : null;
  const details = typeof maybeError.details === "string" ? maybeError.details : "";
  const message = typeof maybeError.message === "string" ? maybeError.message : "";

  if (code !== 9) return false;

  return (
    details.toLowerCase().includes("query requires an index") ||
    message.toLowerCase().includes("query requires an index")
  );
}

function toMillis(value: unknown): number {
  if (!value) return 0;

  if (typeof value === "string" || typeof value === "number") {
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? 0 : ms;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate();
    return date.getTime();
  }

  return 0;
}

class JobService {
  private readonly COLLECTION = "jobs";

  async createJob(
    data: Omit<RecruitmentJob, "id" | "createdAt" | "applicantIds">
  ): Promise<string> {
    const docRef = await db.collection(this.COLLECTION).add({
      ...data,
      applicantIds: [],
      createdAt: new Date().toISOString(),
    });
    return docRef.id;
  }

  async getJob(jobId: string): Promise<RecruitmentJob | null> {
    const doc = await db.collection(this.COLLECTION).doc(jobId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as RecruitmentJob;
  }

  async listJobsByRecruiter(recruiterId: string): Promise<RecruitmentJob[]> {
    let snapshot;

    try {
      snapshot = await db
        .collection(this.COLLECTION)
        .where("recruiterId", "==", recruiterId)
        .orderBy("createdAt", "desc")
        .get();
    } catch (error) {
      if (!isMissingIndexError(error)) {
        throw error;
      }

      console.warn(
        "[JobService] Missing Firestore index detected, falling back to in-memory sort for jobs."
      );

      snapshot = await db
        .collection(this.COLLECTION)
        .where("recruiterId", "==", recruiterId)
        .get();
    }

    return snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort(
        (a, b) =>
          toMillis((b as { createdAt?: unknown }).createdAt) -
          toMillis((a as { createdAt?: unknown }).createdAt)
      ) as RecruitmentJob[];
  }

  async updateJob(
    jobId: string,
    updates: Partial<RecruitmentJob>
  ): Promise<void> {
    await db.collection(this.COLLECTION).doc(jobId).update(updates);
  }

  async addApplicantToJob(jobId: string, applicantId: string): Promise<void> {
    const doc = await db.collection(this.COLLECTION).doc(jobId).get();
    const current = doc.data()?.applicantIds || [];
    if (!current.includes(applicantId)) {
      await db
        .collection(this.COLLECTION)
        .doc(jobId)
        .update({ applicantIds: [...current, applicantId] });
    }
  }

  async closeJob(jobId: string): Promise<void> {
    await db.collection(this.COLLECTION).doc(jobId).update({ status: "closed" });
  }
}

export const jobService = new JobService();

import { db } from "@/services/firebase/admin";
import { RecruitmentJob } from "@/types/recruiter";

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
    const snapshot = await db
      .collection(this.COLLECTION)
      .where("recruiterId", "==", recruiterId)
      .get();

    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort(
        (a, b) =>
          toMillis((b as { createdAt?: unknown }).createdAt) -
          toMillis((a as { createdAt?: unknown }).createdAt)
      ) as RecruitmentJob[];
  }

  /**
   * List all active jobs — used by the public job board.
   * Supports search and filter parameters.
   */
  async listActiveJobs(filters?: {
    search?: string;
    experienceLevel?: string;
    type?: string;
    skills?: string[];
  }): Promise<RecruitmentJob[]> {
    const snapshot = await db
      .collection(this.COLLECTION)
      .where("status", "==", "active")
      .get();

    let jobs = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as RecruitmentJob
    );

    // Apply in-memory filters (Firestore doesn't support substring or array-contains-any with other where clauses well)
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      jobs = jobs.filter(
        (j) =>
          j.title.toLowerCase().includes(searchLower) ||
          j.description.toLowerCase().includes(searchLower) ||
          j.companyName.toLowerCase().includes(searchLower)
      );
    }

    if (filters?.experienceLevel) {
      jobs = jobs.filter((j) => j.experienceLevel === filters.experienceLevel);
    }

    if (filters?.type) {
      jobs = jobs.filter((j) => j.type === filters.type);
    }

    if (filters?.skills && filters.skills.length > 0) {
      const skillsLower = filters.skills.map((s) => s.toLowerCase());
      jobs = jobs.filter((j) =>
        skillsLower.some((skill) =>
          j.requiredSkills.some((rs) => rs.toLowerCase().includes(skill))
        )
      );
    }

    // Check deadline — filter out expired jobs
    const now = Date.now();
    jobs = jobs.filter((j) => {
      if (!j.deadline) return true;
      return new Date(j.deadline).getTime() > now;
    });

    return jobs.sort(
      (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)
    );
  }

  async updateJob(
    jobId: string,
    updates: Partial<RecruitmentJob>
  ): Promise<void> {
    // Prevent updating immutable fields
    const { id: _id, createdAt: _ca, recruiterId: _rid, ...safeUpdates } = updates;
    await db.collection(this.COLLECTION).doc(jobId).update(safeUpdates);
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

  /**
   * Delete a job (soft delete — sets status to closed).
   * Hard delete is intentionally not supported to preserve referential integrity.
   */
  async deleteJob(jobId: string): Promise<void> {
    await this.closeJob(jobId);
  }
}

export const jobService = new JobService();

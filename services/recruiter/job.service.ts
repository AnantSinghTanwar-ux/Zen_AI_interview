import { db } from "@/services/firebase/admin";
import { RecruitmentJob } from "@/types/recruiter";

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

    const jobs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as RecruitmentJob[];

    // Sort in memory to avoid needing a composite Firestore index
    return jobs.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
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

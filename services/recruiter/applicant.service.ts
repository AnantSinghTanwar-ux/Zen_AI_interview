import { db } from "@/services/firebase/admin";
import { Applicant, ScreeningResult } from "@/types/recruiter";
import { jobService } from "./job.service";

class ApplicantService {
  private readonly COLLECTION = "applicants";
  private readonly RESULTS_COLLECTION = "screening_results";

  async importApplicants(
    jobId: string,
    applicants: Array<{ name: string; email: string; resumeUrl?: string }>
  ): Promise<{ imported: number; failed: number; duplicates: number }> {
    let imported = 0;
    let failed = 0;
    let duplicates = 0;

    // Get existing applicants for this job to check duplicates
    const existingSnapshot = await db
      .collection(this.COLLECTION)
      .where("jobId", "==", jobId)
      .get();
    const existingEmails = new Set(
      existingSnapshot.docs.map((doc) => doc.data().email?.toLowerCase())
    );

    const batch = db.batch();
    const newApplicantIds: string[] = [];

    for (const applicant of applicants) {
      if (!applicant.email || !applicant.name) {
        failed++;
        continue;
      }

      if (existingEmails.has(applicant.email.toLowerCase())) {
        duplicates++;
        continue;
      }

      const docRef = db.collection(this.COLLECTION).doc();
      batch.set(docRef, {
        jobId,
        name: applicant.name.trim(),
        email: applicant.email.trim().toLowerCase(),
        resumeUrl: applicant.resumeUrl?.trim() || "",
        status: "pending",
        appliedAt: new Date().toISOString(),
      });

      newApplicantIds.push(docRef.id);
      imported++;
    }

    if (imported > 0) {
      await batch.commit();

      // Update job applicantIds
      for (const id of newApplicantIds) {
        await jobService.addApplicantToJob(jobId, id);
      }
    }

    return { imported, failed, duplicates };
  }

  async getApplicantsByJob(
    jobId: string,
    status?: string
  ): Promise<Applicant[]> {
    let query: FirebaseFirestore.Query = db
      .collection(this.COLLECTION)
      .where("jobId", "==", jobId);

    if (status) {
      query = query.where("status", "==", status);
    }

    const snapshot = await query.get();

    const applicants = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Applicant[];

    // Sort in memory to avoid composite Firestore index requirement
    return applicants.sort((a, b) =>
      new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()
    );
  }

  async getApplicant(applicantId: string): Promise<Applicant | null> {
    const doc = await db.collection(this.COLLECTION).doc(applicantId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Applicant;
  }

  async updateApplicantStatus(
    applicantId: string,
    status: Applicant["status"],
    extras?: Partial<Applicant>
  ): Promise<void> {
    const updates: Record<string, any> = { status };

    if (status === "invited") updates.invitedAt = new Date().toISOString();
    if (status === "completed") updates.completedAt = new Date().toISOString();

    if (extras) {
      Object.assign(updates, extras);
    }

    await db.collection(this.COLLECTION).doc(applicantId).update(updates);
  }

  async getApplicantWithResults(
    applicantId: string
  ): Promise<(Applicant & { results?: ScreeningResult }) | null> {
    const applicant = await this.getApplicant(applicantId);
    if (!applicant) return null;

    const resultsSnapshot = await db
      .collection(this.RESULTS_COLLECTION)
      .where("applicantId", "==", applicantId)
      .limit(1)
      .get();

    const results = resultsSnapshot.empty
      ? undefined
      : ({ id: resultsSnapshot.docs[0].id, ...resultsSnapshot.docs[0].data() } as ScreeningResult);

    return { ...applicant, results };
  }

  async addNote(applicantId: string, note: string): Promise<void> {
    await db.collection(this.COLLECTION).doc(applicantId).update({ notes: note });
  }
}

export const applicantService = new ApplicantService();

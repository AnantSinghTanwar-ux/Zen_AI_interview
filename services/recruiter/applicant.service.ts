import { db } from "@/services/firebase/admin";
import { Applicant, ApplicantStatus, ScreeningResult, ResumeScreeningResult } from "@/types/recruiter";
import { jobService } from "./job.service";

class ApplicantService {
  private readonly COLLECTION = "applicants";
  private readonly RESULTS_COLLECTION = "screening_results";
  private readonly RESUME_SCREENINGS_COLLECTION = "resume_screenings";

  /**
   * Import applicants from CSV (existing flow — recruiter batch import).
   */
  async importApplicants(
    jobId: string,
    applicants: Array<{ name: string; email: string; resumeUrl?: string }>
  ): Promise<{ imported: number; failed: number; duplicates: number }> {
    let imported = 0;
    let failed = 0;
    let duplicates = 0;

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

      for (const id of newApplicantIds) {
        await jobService.addApplicantToJob(jobId, id);
      }
    }

    return { imported, failed, duplicates };
  }

  /**
   * Candidate self-application flow.
   * Returns the applicant ID if successful, null if duplicate.
   */
  async applyForJob(params: {
    jobId: string;
    name: string;
    email: string;
    resumeText?: string;
    coverLetter?: string;
    candidateUserId?: string;
  }): Promise<{ applicantId: string | null; isDuplicate: boolean }> {
    const email = params.email.trim().toLowerCase();

    // Check for duplicate application (same email + same job)
    const existingSnapshot = await db
      .collection(this.COLLECTION)
      .where("jobId", "==", params.jobId)
      .where("email", "==", email)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      return { applicantId: null, isDuplicate: true };
    }

    const now = new Date().toISOString();
    const docRef = await db.collection(this.COLLECTION).add({
      jobId: params.jobId,
      name: params.name.trim().slice(0, 200),
      email,
      resumeText: params.resumeText?.slice(0, 15_000) || "",
      coverLetter: params.coverLetter?.trim().slice(0, 5_000) || "",
      candidateUserId: params.candidateUserId || "",
      status: "pending" as ApplicantStatus,
      appliedAt: now,
    });

    // Add applicant to job's applicantIds array
    await jobService.addApplicantToJob(params.jobId, docRef.id);

    return { applicantId: docRef.id, isDuplicate: false };
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

    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as Applicant)
      .sort(
        (a, b) =>
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
    status: ApplicantStatus,
    extras?: Partial<Applicant>
  ): Promise<void> {
    const updates: Record<string, unknown> = { status };

    if (status === "invited") updates.invitedAt = new Date().toISOString();
    if (status === "completed") updates.completedAt = new Date().toISOString();

    if (extras) {
      // Only copy safe fields
      const { id: _id, jobId: _jid, email: _e, ...safeExtras } = extras;
      Object.assign(updates, safeExtras);
    }

    await db.collection(this.COLLECTION).doc(applicantId).update(updates);
  }

  /**
   * Get applicant with legacy interview screening results.
   */
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

  /**
   * Get applicant with AI resume screening result.
   */
  async getApplicantWithScreening(
    applicantId: string
  ): Promise<(Applicant & { screening?: ResumeScreeningResult }) | null> {
    const applicant = await this.getApplicant(applicantId);
    if (!applicant) return null;

    const screeningSnapshot = await db
      .collection(this.RESUME_SCREENINGS_COLLECTION)
      .where("applicantId", "==", applicantId)
      .limit(1)
      .get();

    const screening = screeningSnapshot.empty
      ? undefined
      : ({ id: screeningSnapshot.docs[0].id, ...screeningSnapshot.docs[0].data() } as ResumeScreeningResult);

    return { ...applicant, screening };
  }

  /**
   * Get all applications by a specific user (for candidate dashboard).
   */
  async getApplicationsByUser(userId: string): Promise<Applicant[]> {
    const snapshot = await db
      .collection(this.COLLECTION)
      .where("candidateUserId", "==", userId)
      .get();

    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as Applicant)
      .sort(
        (a, b) =>
          new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime()
      );
  }

  async addNote(applicantId: string, note: string): Promise<void> {
    await db
      .collection(this.COLLECTION)
      .doc(applicantId)
      .update({ notes: note.trim().slice(0, 2000) });
  }
}

export const applicantService = new ApplicantService();

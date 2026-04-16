import { db } from "@/services/firebase/admin";
import { RecruiterProfile } from "@/types/recruiter";

class RecruiterService {
  private readonly COLLECTION = "recruiters";

  async createRecruiterProfile(data: Omit<RecruiterProfile, "id">): Promise<string> {
    // Check if profile already exists for this user
    const existing = await db
      .collection(this.COLLECTION)
      .where("userId", "==", data.userId)
      .limit(1)
      .get();

    if (!existing.empty) {
      return existing.docs[0].id;
    }

    const docRef = await db.collection(this.COLLECTION).add({
      ...data,
      jobsCreated: 0,
      applicantsScreened: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Update user document with recruiter role
    await db.collection("users").doc(data.userId).update({
      userType: "recruiter",
      recruiterId: docRef.id,
    });

    return docRef.id;
  }

  async getRecruiterByUserId(userId: string): Promise<RecruiterProfile | null> {
    const snapshot = await db
      .collection(this.COLLECTION)
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as RecruiterProfile;
  }

  async getRecruiter(recruiterId: string): Promise<RecruiterProfile | null> {
    const doc = await db.collection(this.COLLECTION).doc(recruiterId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as RecruiterProfile;
  }

  async updateRecruiterStats(
    recruiterId: string,
    updates: Partial<Pick<RecruiterProfile, "jobsCreated" | "applicantsScreened">>
  ): Promise<void> {
    await db
      .collection(this.COLLECTION)
      .doc(recruiterId)
      .update({
        ...updates,
        updatedAt: new Date().toISOString(),
      });
  }

  async incrementJobCount(recruiterId: string): Promise<void> {
    const doc = await db.collection(this.COLLECTION).doc(recruiterId).get();
    const current = doc.data()?.jobsCreated || 0;
    await this.updateRecruiterStats(recruiterId, { jobsCreated: current + 1 });
  }

  async incrementApplicantCount(recruiterId: string, count: number): Promise<void> {
    const doc = await db.collection(this.COLLECTION).doc(recruiterId).get();
    const current = doc.data()?.applicantsScreened || 0;
    await this.updateRecruiterStats(recruiterId, {
      applicantsScreened: current + count,
    });
  }
}

export const recruiterService = new RecruiterService();

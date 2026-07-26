import { db } from "@/services/firebase/admin";
import type { ScheduledInterview, ScheduleStatus } from "@/types/recruiter";
import { notificationService } from "./notification.service";

const COLLECTION = "scheduled_interviews";

class SchedulingService {
  /**
   * Schedule an interview for a shortlisted candidate.
   */
  async scheduleInterview(params: {
    jobId: string;
    applicantId: string;
    recruiterId: string;
    candidateUserId?: string;
    candidateName: string;
    candidateEmail: string;
    jobTitle: string;
    scheduledAt: string;
    duration: number;
    interviewType?: "ai" | "external";
    meetingLink?: string;
    notes?: string;
  }): Promise<ScheduledInterview> {
    // Validate scheduled date is in the future
    const scheduledDate = new Date(params.scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      throw new Error("Invalid scheduled date");
    }
    if (scheduledDate.getTime() < Date.now() - 60_000) {
      throw new Error("Interview must be scheduled in the future");
    }

    // Validate duration
    const duration = Math.max(15, Math.min(180, params.duration || 30));

    const docRef = db.collection(COLLECTION).doc();

    let finalMeetingLink = params.meetingLink?.trim().slice(0, 500) || "";
    if (params.interviewType === "ai") {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://zen-ai-interview.vercel.app";
      // Generate a secure link that leads to the AI interview page with the scheduleId
      finalMeetingLink = `${baseUrl}/interview?scheduleId=${docRef.id}`;
    }

    const now = new Date().toISOString();
    const docData = {
      jobId: params.jobId,
      applicantId: params.applicantId,
      recruiterId: params.recruiterId,
      candidateUserId: params.candidateUserId || "",
      candidateName: params.candidateName.trim().slice(0, 200),
      candidateEmail: params.candidateEmail.trim().toLowerCase().slice(0, 254),
      jobTitle: params.jobTitle.trim().slice(0, 300),
      scheduledAt: scheduledDate.toISOString(),
      duration,
      interviewType: params.interviewType || "ai",
      meetingLink: finalMeetingLink,
      notes: params.notes?.trim().slice(0, 1000) || "",
      status: "scheduled" as ScheduleStatus,
      interviewId: "",
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(docData);
    const schedule: ScheduledInterview = { id: docRef.id, ...docData };

    // Send notification to candidate (fire-and-forget, don't block on failure)
    if (params.candidateUserId) {
      notificationService
        .notifyInterviewScheduled({
          candidateUserId: params.candidateUserId,
          jobTitle: params.jobTitle,
          scheduledAt: scheduledDate.toISOString(),
          jobId: params.jobId,
          scheduleId: docRef.id,
        })
        .catch((err) =>
          console.error("[SchedulingService] Failed to send notification:", err)
        );
    }

    return schedule;
  }

  /**
   * Get all scheduled interviews for a job.
   */
  async getSchedulesByJob(jobId: string): Promise<ScheduledInterview[]> {
    const snapshot = await db
      .collection(COLLECTION)
      .where("jobId", "==", jobId)
      .get();

    return this.sortByScheduledAt(
      snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as ScheduledInterview)
    );
  }

  /**
   * Get all scheduled interviews for a recruiter.
   */
  async getSchedulesByRecruiter(recruiterId: string): Promise<ScheduledInterview[]> {
    const snapshot = await db
      .collection(COLLECTION)
      .where("recruiterId", "==", recruiterId)
      .get();

    return this.sortByScheduledAt(
      snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as ScheduledInterview)
    );
  }

  /**
   * Get all scheduled interviews for a candidate by their userId.
   */
  async getSchedulesByCandidate(candidateUserId: string): Promise<ScheduledInterview[]> {
    const snapshot = await db
      .collection(COLLECTION)
      .where("candidateUserId", "==", candidateUserId)
      .get();

    return this.sortByScheduledAt(
      snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as ScheduledInterview)
    );
  }

  /**
   * Get a single schedule by ID.
   */
  async getSchedule(scheduleId: string): Promise<ScheduledInterview | null> {
    const doc = await db.collection(COLLECTION).doc(scheduleId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as ScheduledInterview;
  }

  /**
   * Update a scheduled interview.
   */
  async updateSchedule(
    scheduleId: string,
    updates: Partial<Pick<ScheduledInterview, "scheduledAt" | "duration" | "meetingLink" | "notes" | "status" | "interviewId">>
  ): Promise<void> {
    const sanitized: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (updates.scheduledAt !== undefined) {
      const date = new Date(updates.scheduledAt);
      if (isNaN(date.getTime())) throw new Error("Invalid scheduled date");
      sanitized.scheduledAt = date.toISOString();
    }

    if (updates.duration !== undefined) {
      sanitized.duration = Math.max(15, Math.min(180, updates.duration));
    }

    if (updates.meetingLink !== undefined) {
      sanitized.meetingLink = updates.meetingLink.trim().slice(0, 500);
    }

    if (updates.notes !== undefined) {
      sanitized.notes = updates.notes.trim().slice(0, 1000);
    }

    if (updates.status !== undefined) {
      const validStatuses: ScheduleStatus[] = ["scheduled", "completed", "cancelled"];
      if (!validStatuses.includes(updates.status)) {
        throw new Error(`Invalid status: ${updates.status}`);
      }
      sanitized.status = updates.status;
    }

    if (updates.interviewId !== undefined) {
      sanitized.interviewId = updates.interviewId;
    }

    await db.collection(COLLECTION).doc(scheduleId).update(sanitized);
  }

  /**
   * Cancel a scheduled interview.
   */
  async cancelSchedule(scheduleId: string): Promise<void> {
    const schedule = await this.getSchedule(scheduleId);
    if (!schedule) throw new Error("Schedule not found");

    await this.updateSchedule(scheduleId, { status: "cancelled" });

    // Notify candidate
    if (schedule.candidateUserId) {
      notificationService
        .createNotification({
          userId: schedule.candidateUserId,
          type: "interview_cancelled",
          title: "Interview Cancelled",
          message: `Your interview for "${schedule.jobTitle}" has been cancelled.`,
          metadata: {
            jobId: schedule.jobId,
            scheduleId,
          },
        })
        .catch((err) =>
          console.error("[SchedulingService] Failed to send cancellation notification:", err)
        );
    }
  }

  private sortByScheduledAt(schedules: ScheduledInterview[]): ScheduledInterview[] {
    return schedules.sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );
  }
}

export const schedulingService = new SchedulingService();

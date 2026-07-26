import { db } from "@/services/firebase/admin";
import type { Notification, NotificationType } from "@/types/recruiter";

const COLLECTION = "notifications";
const MAX_NOTIFICATIONS_PER_QUERY = 50;

class NotificationService {
  /**
   * Create a notification for a user.
   * Returns the notification ID.
   */
  async createNotification(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    metadata?: Record<string, string>;
  }): Promise<string> {
    if (!params.userId || !params.title) {
      throw new Error("userId and title are required for notifications");
    }

    const docRef = await db.collection(COLLECTION).add({
      userId: params.userId,
      type: params.type,
      title: params.title.slice(0, 200),
      message: params.message.slice(0, 1000),
      read: false,
      metadata: params.metadata || {},
      createdAt: new Date().toISOString(),
    });

    return docRef.id;
  }

  /**
   * Get notifications for a user, ordered by createdAt descending.
   * Unread notifications come first.
   */
  async getNotifications(
    userId: string,
    options?: { limit?: number; unreadOnly?: boolean }
  ): Promise<Notification[]> {
    const limit = Math.min(options?.limit || 20, MAX_NOTIFICATIONS_PER_QUERY);

    let query: FirebaseFirestore.Query = db
      .collection(COLLECTION)
      .where("userId", "==", userId);

    if (options?.unreadOnly) {
      query = query.where("read", "==", false);
    }

    // Firestore may need a composite index for userId + createdAt.
    // We sort in-memory to avoid missing-index errors gracefully.
    const snapshot = await query.get();

    const notifications = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() }) as Notification
    );

    // Sort: unread first, then by createdAt descending
    notifications.sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return notifications.slice(0, limit);
  }

  /**
   * Get count of unread notifications for a user.
   */
  async getUnreadCount(userId: string): Promise<number> {
    const snapshot = await db
      .collection(COLLECTION)
      .where("userId", "==", userId)
      .where("read", "==", false)
      .get();

    return snapshot.size;
  }

  /**
   * Mark a single notification as read.
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const doc = await db.collection(COLLECTION).doc(notificationId).get();

    if (!doc.exists) return;

    // Ensure the notification belongs to this user (authorization check)
    const data = doc.data();
    if (data?.userId !== userId) return;

    await doc.ref.update({ read: true });
  }

  /**
   * Mark all notifications as read for a user.
   */
  async markAllAsRead(userId: string): Promise<number> {
    const snapshot = await db
      .collection(COLLECTION)
      .where("userId", "==", userId)
      .where("read", "==", false)
      .get();

    if (snapshot.empty) return 0;

    const batch = db.batch();
    let count = 0;

    for (const doc of snapshot.docs) {
      batch.update(doc.ref, { read: true });
      count++;
      // Firestore batch limit is 500
      if (count % 490 === 0) {
        await batch.commit();
      }
    }

    if (count % 490 !== 0) {
      await batch.commit();
    }

    return count;
  }

  // ─── Convenience helpers for common notification scenarios ──────────

  async notifyScreeningComplete(params: {
    candidateUserId: string;
    jobTitle: string;
    recommendation: string;
    jobId: string;
    applicantId: string;
  }): Promise<void> {
    if (!params.candidateUserId) return;

    await this.createNotification({
      userId: params.candidateUserId,
      type: "screening_completed",
      title: "Resume Screening Complete",
      message: `Your application for "${params.jobTitle}" has been reviewed by our AI screening system.`,
      metadata: {
        jobId: params.jobId,
        applicantId: params.applicantId,
        recommendation: params.recommendation,
      },
    });
  }

  async notifyStatusChange(params: {
    candidateUserId: string;
    jobTitle: string;
    newStatus: string;
    jobId: string;
    applicantId: string;
  }): Promise<void> {
    if (!params.candidateUserId) return;

    const statusMessages: Record<string, { type: NotificationType; title: string; message: string }> = {
      shortlisted: {
        type: "shortlisted",
        title: "You've Been Shortlisted! 🎉",
        message: `Great news! You've been shortlisted for "${params.jobTitle}". An interview may be scheduled soon.`,
      },
      rejected: {
        type: "rejected",
        title: "Application Update",
        message: `Thank you for your interest in "${params.jobTitle}". Unfortunately, we've decided to move forward with other candidates.`,
      },
      invited: {
        type: "status_changed",
        title: "Interview Invitation",
        message: `You've been invited for an interview for "${params.jobTitle}".`,
      },
    };

    const config = statusMessages[params.newStatus] || {
      type: "status_changed" as NotificationType,
      title: "Application Status Updated",
      message: `Your application for "${params.jobTitle}" has been updated to: ${params.newStatus}.`,
    };

    await this.createNotification({
      userId: params.candidateUserId,
      type: config.type,
      title: config.title,
      message: config.message,
      metadata: {
        jobId: params.jobId,
        applicantId: params.applicantId,
        status: params.newStatus,
      },
    });
  }

  async notifyInterviewScheduled(params: {
    candidateUserId: string;
    jobTitle: string;
    scheduledAt: string;
    jobId: string;
    scheduleId: string;
  }): Promise<void> {
    if (!params.candidateUserId) return;

    const date = new Date(params.scheduledAt);
    const formattedDate = date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    await this.createNotification({
      userId: params.candidateUserId,
      type: "interview_scheduled",
      title: "Interview Scheduled 📅",
      message: `Your interview for "${params.jobTitle}" is scheduled for ${formattedDate}.`,
      metadata: {
        jobId: params.jobId,
        scheduleId: params.scheduleId,
        scheduledAt: params.scheduledAt,
      },
    });
  }
}

export const notificationService = new NotificationService();

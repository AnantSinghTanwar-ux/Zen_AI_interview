import { db } from "@/services/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

interface CallLogData {
  userId: string;
  vapiCallId: string;
  assistantId?: string | null;
  status: string;
  startedAt: string;
  endedAt?: string | null;
  duration?: number | null;
  cost?: number | null;
  costBreakdown?: {
    llm?: number;
    stt?: number;
    tts?: number;
    vapi?: number;
    total?: number;
  } | null;
  messageCount?: number;
  hasRecording?: boolean;
  hasTranscript?: boolean;
  summary?: string | null;
  analysis?: any;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export class CallLogService {
  private readonly COLLECTION = "callLogs";

  // Helper function to remove undefined values
  private cleanData(obj: CallLogData): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = value;
      }
    }

    return cleaned;
  }

  async saveCallLog(
    callData: Omit<CallLogData, "createdAt" | "updatedAt">
  ): Promise<string> {
    try {
      const now = Timestamp.now();
      const docData: CallLogData = {
        ...callData,
        createdAt: now,
        updatedAt: now,
      };

      // Remove undefined values before saving to Firestore
      const cleanedDocData = this.cleanData(docData);

      const docRef = await db.collection(this.COLLECTION).add(cleanedDocData);
      console.log(`Call log saved with ID: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error("Error saving call log:", error);
      throw error;
    }
  }

  async updateCallLog(
    docId: string,
    updates: Partial<CallLogData>
  ): Promise<void> {
    try {
      const updateData = {
        ...updates,
        updatedAt: Timestamp.now(),
      };

      await db.collection(this.COLLECTION).doc(docId).update(updateData);
      console.log(`Call log updated: ${docId}`);
    } catch (error) {
      console.error("Error updating call log:", error);
      throw error;
    }
  }

  async getCallLogsByUser(
    userId: string,
    limit: number = 20
  ): Promise<CallLogData[]> {
    try {
      const snapshot = await db
        .collection(this.COLLECTION)
        .where("userId", "==", userId)
        .get();

      // Sort in memory since we can't orderBy without index
      const docs = snapshot.docs
        .map(
          (doc) =>
            ({ ...doc.data(), id: doc.id } as CallLogData & { id: string })
        )
        .sort((a, b) => {
          const aTime = a.createdAt?.toMillis
            ? a.createdAt.toMillis()
            : new Date(a.createdAt?.toDate?.() || a.createdAt).getTime();
          const bTime = b.createdAt?.toMillis
            ? b.createdAt.toMillis()
            : new Date(b.createdAt?.toDate?.() || b.createdAt).getTime();
          return bTime - aTime; // Descending order (newest first)
        })
        .slice(0, limit);

      return docs;
    } catch (error) {
      console.error("Error fetching call logs:", error);
      throw error;
    }
  }

  async getCallLogByVapiId(
    vapiCallId: string
  ): Promise<(CallLogData & { id: string }) | null> {
    try {
      const snapshot = await db
        .collection(this.COLLECTION)
        .where("vapiCallId", "==", vapiCallId)
        .limit(1)
        .get();

      if (snapshot.empty) return null;

      const doc = snapshot.docs[0];
      return { ...doc.data(), id: doc.id } as CallLogData & { id: string };
    } catch (error) {
      console.error("Error fetching call log by Vapi ID:", error);
      throw error;
    }
  }

  async addUserIdToExistingLogs(defaultUserId: string): Promise<void> {
    try {
      const snapshot = await db
        .collection(this.COLLECTION)
        .where("userId", "==", null)
        .get();

      const batch = db.batch();

      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
          userId: defaultUserId,
          updatedAt: Timestamp.now(),
        });
      });

      await batch.commit();
      console.log(
        `Updated ${snapshot.docs.length} existing call logs with userId`
      );
    } catch (error) {
      console.error("Error updating existing call logs:", error);
      throw error;
    }
  }

  async getAllCallLogsWithoutUserId(): Promise<
    (CallLogData & { id: string })[]
  > {
    try {
      const snapshot = await db.collection(this.COLLECTION).get();

      return snapshot.docs
        .map(
          (doc) =>
            ({ ...doc.data(), id: doc.id } as CallLogData & { id: string })
        )
        .filter((log) => !log.userId);
    } catch (error) {
      console.error("Error fetching logs without userId:", error);
      throw error;
    }
  }
}

export const callLogService = new CallLogService();

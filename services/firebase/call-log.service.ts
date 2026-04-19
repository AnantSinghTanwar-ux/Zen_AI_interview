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
  transcript?: string | null;
  summary?: string | null;
  analysis?: any;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export class CallLogService {
  private readonly COLLECTION = "callLogs";

  private sanitizeValue(value: unknown): unknown {
    if (value === undefined) {
      return undefined;
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => this.sanitizeValue(item))
        .filter((item) => item !== undefined);
    }

    if (value instanceof Timestamp || value instanceof Date) {
      return value;
    }

    if (value && typeof value === "object") {
      const cleanedObject: Record<string, unknown> = {};

      for (const [key, nestedValue] of Object.entries(
        value as Record<string, unknown>
      )) {
        const cleanedNestedValue = this.sanitizeValue(nestedValue);
        if (cleanedNestedValue !== undefined) {
          cleanedObject[key] = cleanedNestedValue;
        }
      }

      return cleanedObject;
    }

    return value;
  }

  private toMillis(value: unknown): number {
    if (!value) return 0;

    if (typeof value === "string" || typeof value === "number") {
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    }

    if (value instanceof Timestamp) {
      return value.toMillis();
    }

    if (typeof value === "object") {
      const candidate = value as {
        toDate?: () => Date;
        _seconds?: number;
        seconds?: number;
      };

      if (typeof candidate.toDate === "function") {
        const parsed = candidate.toDate().getTime();
        return Number.isFinite(parsed) ? parsed : 0;
      }

      const seconds =
        typeof candidate._seconds === "number"
          ? candidate._seconds
          : candidate.seconds;

      if (typeof seconds === "number") {
        return seconds * 1000;
      }
    }

    return 0;
  }

  private getSortTimestamp(log: Record<string, unknown>): number {
    return this.toMillis(log.startedAt) || this.toMillis(log.createdAt) || 0;
  }

  // Helper function to remove undefined values
  private cleanData(obj: CallLogData): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const cleanedValue = this.sanitizeValue(value);
      if (cleanedValue !== undefined) {
        cleaned[key] = cleanedValue;
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
    const safeLimit =
      Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 20;

    try {
      // Uses composite index: (userId ASC, createdAt DESC)
      // See firestore.indexes.json — deploy via: firebase deploy --only firestore:indexes
      const snapshot = await db
        .collection(this.COLLECTION)
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .limit(safeLimit)
        .get();

      return snapshot.docs.map(
        (doc) =>
          ({ ...doc.data(), id: doc.id } as CallLogData & { id: string })
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const code = (error as { code?: unknown })?.code;
      const isMissingIndexError =
        code === 9 ||
        code === "failed-precondition" ||
        message.includes("FAILED_PRECONDITION") ||
        message.toLowerCase().includes("index");

      if (!isMissingIndexError) {
        console.error("Error fetching call logs:", error);
        throw error;
      }

      console.warn(
        "[CallLogService] Missing Firestore index detected, falling back to in-memory sort for call logs."
      );

      const fallbackSnapshot = await db
        .collection(this.COLLECTION)
        .where("userId", "==", userId)
        .limit(Math.max(100, safeLimit * 5))
        .get();

      const fallbackLogs = fallbackSnapshot.docs.map(
        (doc) =>
          ({ ...doc.data(), id: doc.id } as CallLogData & { id: string })
      );

      fallbackLogs.sort(
        (a, b) =>
          this.getSortTimestamp(b as unknown as Record<string, unknown>) -
          this.getSortTimestamp(a as unknown as Record<string, unknown>)
      );

      return fallbackLogs.slice(0, safeLimit);
    }
  }

  async getCallLogById(
    docId: string
  ): Promise<(CallLogData & { id: string }) | null> {
    try {
      const doc = await db.collection(this.COLLECTION).doc(docId).get();
      if (!doc.exists) return null;
      return { ...doc.data(), id: doc.id } as CallLogData & { id: string };
    } catch (error) {
      console.error("Error fetching call log by doc ID:", error);
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

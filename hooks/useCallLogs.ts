import { useState, useEffect } from "react";

interface CallLog {
  id: string;
  userId: string;
  vapiCallId: string;
  assistantId?: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  duration?: number;
  cost?: number;
  costBreakdown?: {
    llm?: number;
    stt?: number;
    tts?: number;
    vapi?: number;
    total?: number;
  };
  messageCount?: number;
  hasRecording?: boolean;
  hasTranscript?: boolean;
  summary?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  analysis?: any;
  createdAt: Date;
  updatedAt: Date;
}

export function useCallLogs(userId: string | null | undefined) {
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCallLogs = async (limit: number = 20) => {
    if (!userId) {
      setCallLogs([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/call-logs?limit=${limit}`, {
        credentials: "include",
      });

      if (response.status === 401 || response.status === 403) {
        setCallLogs([]);
        setError(null);
        return;
      }

      if (!response.ok) {
        let message = "Failed to fetch call logs";
        try {
          const payload = await response.json();
          message = payload?.error || payload?.details || message;
        } catch {
          // Ignore parse failures and keep generic message.
        }
        throw new Error(message);
      }

      const logs = await response.json();
      setCallLogs(Array.isArray(logs) ? logs : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch call logs"
      );
      console.error("Error fetching call logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const saveCallLog = async (vapiCallId: string, jobContext?: string, sessionId?: string) => {
    if (!userId || !vapiCallId) {
      console.warn("Skipping call log save because userId or vapiCallId is missing");
      return;
    }

    try {
      const body: Record<string, unknown> = {
        vapiCallId,
        userId,
      };

      if (sessionId) {
        body.sessionId = sessionId;
      }

      // If job context is available (from extension), pass it so the API
      // can auto-create an external_application for the recruiter pipeline.
      if (jobContext) {
        body.jobContext = jobContext;
      }

      const response = await fetch("/api/call-logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": `call-log:${userId}:${vapiCallId}`,
        },
        body: JSON.stringify(body),
      });

      if (response.status === 409) {
        // Idempotent request is already being processed by another in-flight call-end event.
        await fetchCallLogs();
        return {
          success: true,
          inProgress: true,
        };
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.error || errorData.details || "Failed to save call log";
        throw new Error(errorMessage);
      }

      // Refresh the call logs after saving
      await fetchCallLogs();

      return await response.json();
    } catch (err) {
      console.error("Error saving call log:", err);
      throw err;
    }
  };

  useEffect(() => {
    if (userId) {
      fetchCallLogs();
    }
  }, [userId]);

  return {
    callLogs,
    loading,
    error,
    fetchCallLogs,
    saveCallLog,
  };
}

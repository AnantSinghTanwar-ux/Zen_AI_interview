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
    console.log("Our userId is: ", userId ?? "Empty for now");
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/call-logs?userId=${userId}&limit=${limit}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch call logs");
      }

      const logs = await response.json();
      setCallLogs(logs);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch call logs"
      );
      console.error("Error fetching call logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const saveCallLog = async (vapiCallId: string) => {
    if (!userId || !vapiCallId) {
      console.log("No user or call Id");
      return;
    }

    try {
      const response = await fetch("/api/call-logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vapiCallId,
          userId,
        }),
      });

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

import { NextRequest, NextResponse } from "next/server";
import { callLogService } from "@/services/firebase/call-log.service";
import { vapiCallDataService } from "@/services/vapi/call-data.service";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { checkRateLimit } from "@/lib/services/rate-limit.service";
import {
  checkPremiumAccessForFeature,
  getPremiumRequiredErrorPayload,
} from "@/lib/services/premium-access.service";

function parseLimit(rawValue: string | null, fallback: number = 20): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), 100);
}

function toIsoDateString(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (typeof value === "object") {
    const candidate = value as {
      toDate?: () => Date;
      _seconds?: number;
      seconds?: number;
    };

    if (typeof candidate.toDate === "function") {
      const date = candidate.toDate();
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    const seconds =
      typeof candidate._seconds === "number"
        ? candidate._seconds
        : candidate.seconds;

    if (typeof seconds === "number") {
      return new Date(seconds * 1000).toISOString();
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get("limit"), 20);

    // Get the current authenticated user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { allowed, response } = await checkRateLimit(request, user.id, "call-data");
    if (!allowed) return response!;

    const premiumAccess = await checkPremiumAccessForFeature({
      userId: user.id,
      email: user.email,
      featureKeys: ["vapi-call-data:list"],
    });

    if (!premiumAccess.allowed) {
      return NextResponse.json(getPremiumRequiredErrorPayload(), { status: 402 });
    }

    // Fetch call logs from Firestore filtered by the current user
    const callLogs = await callLogService.getCallLogsByUser(user.id, limit);

    // Bound external Vapi sync work per request to keep list responses fast under load.
    const syncCandidateIds = new Set(
      callLogs
        .filter(
          (log: any) =>
            (log.status === "in-progress" || log.status === "unknown") &&
            Boolean(log.vapiCallId)
        )
        .slice(0, 2)
        .map((log: any) => String(log.id))
    );

    const processedCalls = await Promise.all(callLogs.map(async (log: any) => {
      let currentStatus = log.status || "unknown";
      let endedAt = log.endedAt || null;
      let cost = log.cost || null;
      let costBreakdown = log.costBreakdown || null;
      let messageCount = log.messageCount || 0;
      let hasRecording = log.hasRecording || false;
      let hasTranscript = log.hasTranscript || false;

      // Sync with Vapi only for a small bounded subset to avoid request fan-out.
      if (syncCandidateIds.has(String(log.id)) && log.vapiCallId) {
        try {
          const vapiData = await Promise.race([
            vapiCallDataService.getCall(log.vapiCallId),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Vapi sync timeout")), 4000)
            ),
          ]);

          if (vapiData && (vapiData.status !== currentStatus || vapiData.endedAt)) {
            currentStatus = vapiData.status || currentStatus;
            endedAt = vapiData.endedAt || endedAt;
            cost = vapiData.cost || cost;
            costBreakdown = vapiData.costBreakdown || costBreakdown;
            messageCount = vapiData.artifact?.messages?.length || messageCount;
            hasRecording = !!(vapiData.artifact?.recordingUrl || vapiData.recordingUrl);
            hasTranscript = !!(vapiData.artifact?.transcript || vapiData.transcript);

            // Update in background
            callLogService.updateCallLog(log.id, {
              status: currentStatus,
              endedAt,
              cost,
              costBreakdown,
              messageCount,
              hasRecording,
              hasTranscript,
            }).catch(e => console.error(`Background update failed for ${log.id}:`, e));
          }
        } catch (syncError) {
          console.warn(`Could not sync stuck document ${log.id} with Vapi:`, syncError);
        }
      }

      const startedAt =
        toIsoDateString(log.startedAt) ||
        toIsoDateString(log.createdAt) ||
        new Date().toISOString();
      const normalizedEndedAt = toIsoDateString(endedAt);

      return {
        id: log.id,
        vapiCallId: log.vapiCallId || null,
        status: currentStatus,
        startedAt,
        endedAt: normalizedEndedAt,
        cost,
        costBreakdown,
        messageCount,
        hasArtifact: hasRecording || hasTranscript,
      };
    }));

    return NextResponse.json(processedCalls, { status: 200 });

  } catch (error) {
    console.error("Error in call-data API:", error);

    const errorMessage = error instanceof Error ? error.message : "Failed to fetch call data";

    return NextResponse.json({
      error: errorMessage,
      message: "Failed to fetch call data",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { callLogService } from "@/services/firebase/call-log.service";
import { vapiCallDataService } from "@/services/vapi/call-data.service";
import { checkRateLimit } from "@/lib/services/rate-limit.service";
import {
	checkPremiumAccessForFeature,
	getPremiumRequiredErrorPayload,
} from "@/lib/services/premium-access.service";

function parseSyncLimit(raw: unknown, fallback: number = 3): number {
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
	return Math.min(Math.floor(parsed), 10);
}

function hasRelevantChanges(
	before: {
		status: string;
		endedAt: string | null;
		cost: number | null;
		messageCount: number;
		hasRecording: boolean;
		hasTranscript: boolean;
	},
	after: {
		status: string;
		endedAt: string | null;
		cost: number | null;
		messageCount: number;
		hasRecording: boolean;
		hasTranscript: boolean;
	}
) {
	return (
		before.status !== after.status ||
		String(before.endedAt || "") !== String(after.endedAt || "") ||
		Number(before.cost || 0) !== Number(after.cost || 0) ||
		Number(before.messageCount || 0) !== Number(after.messageCount || 0) ||
		Boolean(before.hasRecording) !== Boolean(after.hasRecording) ||
		Boolean(before.hasTranscript) !== Boolean(after.hasTranscript)
	);
}

async function syncOneCall(log: any, dryRun: boolean) {
	const base = {
		status: String(log.status || "unknown"),
		endedAt: log.endedAt ? String(log.endedAt) : null,
		cost: Number.isFinite(Number(log.cost)) ? Number(log.cost) : null,
		messageCount: Number.isFinite(Number(log.messageCount)) ? Number(log.messageCount) : 0,
		hasRecording: Boolean(log.hasRecording),
		hasTranscript: Boolean(log.hasTranscript),
	};

	try {
		const vapiData = (await Promise.race([
			vapiCallDataService.getCall(String(log.vapiCallId)),
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error("Vapi sync timeout")), 4000)
			),
		])) as any;

		const next = {
			status: String(vapiData?.status || base.status),
			endedAt: vapiData?.endedAt ? String(vapiData.endedAt) : base.endedAt,
			cost: Number.isFinite(Number(vapiData?.cost)) ? Number(vapiData.cost) : base.cost,
			messageCount: Number(vapiData?.artifact?.messages?.length || base.messageCount),
			hasRecording: Boolean(vapiData?.artifact?.recordingUrl || vapiData?.recordingUrl),
			hasTranscript: Boolean(vapiData?.artifact?.transcript || vapiData?.transcript),
		};

		const changed = hasRelevantChanges(base, next);

		if (changed && !dryRun) {
			await callLogService.updateCallLog(String(log.id), {
				status: next.status,
				endedAt: next.endedAt,
				cost: next.cost,
				costBreakdown: vapiData?.costBreakdown || log.costBreakdown || null,
				messageCount: next.messageCount,
				hasRecording: next.hasRecording,
				hasTranscript: next.hasTranscript,
			});
		}

		return {
			id: String(log.id),
			vapiCallId: String(log.vapiCallId || ""),
			status: changed ? (dryRun ? "would-update" : "updated") : "unchanged",
			syncedStatus: next.status,
			syncedEndedAt: next.endedAt,
			changed,
		};
	} catch (error) {
		return {
			id: String(log.id),
			vapiCallId: String(log.vapiCallId || ""),
			status: "failed",
			changed: false,
			error: error instanceof Error ? error.message : "Failed to sync call",
		};
	}
}

async function handleSync(request: NextRequest, body?: any) {
	const user = await getCurrentUser();
	if (!user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { allowed, response } = await checkRateLimit(request, user.id, "call-data-sync");
	if (!allowed) return response!;

	const premiumAccess = await checkPremiumAccessForFeature({
		userId: user.id,
		email: user.email,
		featureKeys: ["vapi-call-data:sync"],
	});

	if (!premiumAccess.allowed) {
		return NextResponse.json(getPremiumRequiredErrorPayload(), { status: 402 });
	}

	const url = new URL(request.url);
	const queryLimit = parseSyncLimit(url.searchParams.get("limit"), 3);
	const bodyLimit = parseSyncLimit(body?.limit, queryLimit);
	const limit = bodyLimit;
	const dryRun =
		String(url.searchParams.get("dryRun") || "").toLowerCase() === "true" ||
		Boolean(body?.dryRun);

	const callLogs = await callLogService.getCallLogsByUser(user.id, Math.max(30, limit * 10));
	const candidates = callLogs
		.filter(
			(log: any) =>
				(log.status === "in-progress" || log.status === "unknown") &&
				Boolean(log.vapiCallId)
		)
		.slice(0, limit);

	const results = [] as Array<Record<string, unknown>>;
	for (const log of candidates) {
		const result = await syncOneCall(log, dryRun);
		results.push(result);
	}

	const updated = results.filter((item) => item.status === "updated").length;
	const unchanged = results.filter((item) => item.status === "unchanged").length;
	const failed = results.filter((item) => item.status === "failed").length;
	const wouldUpdate = results.filter((item) => item.status === "would-update").length;

	return NextResponse.json(
		{
			success: true,
			dryRun,
			examined: results.length,
			updated,
			unchanged,
			failed,
			wouldUpdate,
			results,
			timestamp: new Date().toISOString(),
		},
		{ status: 200 }
	);
}

export async function GET(request: NextRequest) {
	try {
		return await handleSync(request);
	} catch (error) {
		console.error("[CallDataSync] GET error:", error);
		return NextResponse.json(
			{
				error: "Failed to sync call data",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		const body = await request.json().catch(() => ({}));
		return await handleSync(request, body);
	} catch (error) {
		console.error("[CallDataSync] POST error:", error);
		return NextResponse.json(
			{
				error: "Failed to sync call data",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}

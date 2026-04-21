import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { checkRateLimit } from "@/lib/services/rate-limit.service";
import {
  checkAndConsumePremiumDailyLimit,
  PremiumDailyLimitResult,
  PremiumDailyLimitKind,
  checkPremiumAccessForFeature,
  getPremiumDailyLimitErrorPayload,
  getPremiumRequiredErrorPayload,
} from "@/lib/services/premium-access.service";

function toNonEmptyString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function resolveQuotaKind(feature: string, quotaKind: string): PremiumDailyLimitKind | null {
  const normalizedQuota = quotaKind.toLowerCase();
  if (normalizedQuota === "feedback" || normalizedQuota === "interview") {
    return normalizedQuota;
  }

  const normalizedFeature = feature.toLowerCase();
  if (normalizedFeature.includes("interview") || normalizedFeature.includes("dsa") || normalizedFeature.includes("practice")) {
    return "interview";
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { allowed, response } = await checkRateLimit(
      request,
      user.id,
      "premium-vapi-access-check"
    );
    if (!allowed) return response!;

    const body = await request.json().catch(() => ({}));
    const usageKey = toNonEmptyString(body?.usageKey);
    const feature = toNonEmptyString(body?.feature) || "vapi";
    const quotaKind = toNonEmptyString(body?.quotaKind);

    const resolvedUsageKey = usageKey || `${feature}:default`;

    const access = await checkPremiumAccessForFeature({
      userId: user.id,
      email: user.email,
      featureKeys: [resolvedUsageKey],
    });

    if (!access.allowed) {
      return NextResponse.json({
        allowed: false,
        ...getPremiumRequiredErrorPayload(),
        usageKey: resolvedUsageKey,
        isPremium: access.isPremium,
        reason: access.reason,
        trialConsumed: access.trialConsumed,
      });
    }

    const resolvedQuotaKind = resolveQuotaKind(feature, quotaKind);
    let quota: PremiumDailyLimitResult | null = null;

    if (resolvedQuotaKind) {
      quota = await checkAndConsumePremiumDailyLimit({
        userId: user.id,
        email: user.email,
        kind: resolvedQuotaKind,
        usageKey: resolvedUsageKey,
        consume: true,
      });

      if (!quota.allowed) {
        return NextResponse.json({
          allowed: false,
          usageKey: resolvedUsageKey,
          ...getPremiumDailyLimitErrorPayload({
            kind: quota.kind,
            limit: quota.limit,
            date: quota.date,
          }),
          dailyLimit: {
            kind: quota.kind,
            limit: quota.limit,
            used: quota.used,
            remaining: quota.remaining,
            date: quota.date,
          },
        });
      }
    }

    return NextResponse.json({
      allowed: true,
      isPremium: access.isPremium,
      reason: access.reason,
      trialConsumed: access.trialConsumed,
      usageKey: resolvedUsageKey,
      dailyLimit: quota
        ? {
            kind: quota.kind,
            limit: quota.limit,
            used: quota.used,
            remaining: quota.remaining,
            date: quota.date,
          }
        : null,
    });
  } catch (error) {
    console.error("Error checking premium Vapi access:", error);
    return NextResponse.json(
      { error: "Failed to validate premium Vapi access" },
      { status: 500 }
    );
  }
}

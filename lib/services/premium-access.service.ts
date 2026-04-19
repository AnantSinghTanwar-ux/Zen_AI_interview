import { db } from "@/services/firebase/admin";

const DEFAULT_PREMIUM_EMAIL_SEEDS = ["anantsa@gmail.com"];

function normalizeEmail(email?: string | null): string {
  return String(email || "").trim().toLowerCase();
}

function normalizeCallIds(callIds: Array<string | null | undefined>): string[] {
  const values = callIds
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return Array.from(new Set(values));
}

function getSeededPremiumEmails(): Set<string> {
  const envEmails = (process.env.PREMIUM_SEED_EMAILS || "")
    .split(",")
    .map((value) => normalizeEmail(value))
    .filter(Boolean);

  return new Set([...DEFAULT_PREMIUM_EMAIL_SEEDS, ...envEmails]);
}

const SEEDED_PREMIUM_EMAILS = getSeededPremiumEmails();

const PREMIUM_DAILY_LIMITS = {
  feedback: Number(process.env.PREMIUM_DAILY_FEEDBACK_LIMIT ?? 3),
  interview: Number(process.env.PREMIUM_DAILY_INTERVIEW_LIMIT ?? 3),
} as const;

export type PremiumDailyLimitKind = keyof typeof PREMIUM_DAILY_LIMITS;

function getTodayUtcKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function getSafeDailyLimit(kind: PremiumDailyLimitKind): number {
  const parsed = Number(PREMIUM_DAILY_LIMITS[kind]);
  if (!Number.isFinite(parsed) || parsed <= 0) return 3;
  return Math.floor(parsed);
}

interface PremiumUserDocument {
  email?: string;
  isPremium?: boolean;
  premiumSource?: string;
  freeTrialUsed?: boolean;
  freeTrialCallIds?: string[];
  freeTrialCallId?: string;
  premiumDailyUsage?: {
    date?: string;
    feedbackKeys?: string[];
    interviewKeys?: string[];
  };
}

export interface PremiumAccessState {
  isPremium: boolean;
  freeTrialUsed: boolean;
  freeTrialCallIds: string[];
}

export interface PremiumAccessResult {
  allowed: boolean;
  isPremium: boolean;
  reason: "premium" | "free-trial" | "upgrade-required";
  trialConsumed: boolean;
  freeTrialCallIds: string[];
}

export interface PremiumDailyLimitResult {
  allowed: boolean;
  isPremium: boolean;
  kind: PremiumDailyLimitKind;
  date: string;
  limit: number;
  used: number;
  remaining: number;
}

export async function grantPremiumAccess(params: {
  userId: string;
  source?: string;
}): Promise<void> {
  const now = new Date().toISOString();

  await db.collection("users").doc(params.userId).set(
    {
      isPremium: true,
      premiumSource: params.source || "self-confirmed",
      premiumGrantedAt: now,
      updatedAt: now,
    },
    { merge: true }
  );
}

export function isSeedPremiumEmail(email?: string | null): boolean {
  return SEEDED_PREMIUM_EMAILS.has(normalizeEmail(email));
}

export async function ensureSeedPremiumAccess(params: {
  userId: string;
  email?: string | null;
}): Promise<boolean> {
  const normalizedEmail = normalizeEmail(params.email);
  if (!isSeedPremiumEmail(normalizedEmail)) {
    return false;
  }

  const userRef = db.collection("users").doc(params.userId);
  const userSnap = await userRef.get();
  const existing = (userSnap.data() || {}) as PremiumUserDocument;

  if (existing.isPremium === true) {
    return true;
  }

  const now = new Date().toISOString();
  await userRef.set(
    {
      isPremium: true,
      premiumSource: existing.premiumSource || "seed-email",
      premiumGrantedAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  return true;
}

async function readPremiumState(params: {
  userId: string;
  email?: string | null;
}): Promise<PremiumAccessState> {
  await ensureSeedPremiumAccess({ userId: params.userId, email: params.email });

  const userSnap = await db.collection("users").doc(params.userId).get();
  const userData = (userSnap.data() || {}) as PremiumUserDocument;

  const emailFromDoc = normalizeEmail(userData.email);
  const fallbackSeedPremium = isSeedPremiumEmail(params.email) || isSeedPremiumEmail(emailFromDoc);

  const freeTrialCallIds = normalizeCallIds([
    ...(Array.isArray(userData.freeTrialCallIds) ? userData.freeTrialCallIds : []),
    userData.freeTrialCallId,
  ]);

  return {
    isPremium: Boolean(userData.isPremium) || fallbackSeedPremium,
    freeTrialUsed: Boolean(userData.freeTrialUsed) || freeTrialCallIds.length > 0,
    freeTrialCallIds,
  };
}

export async function checkPremiumAccessForCall(params: {
  userId: string;
  email?: string | null;
  callIds: Array<string | null | undefined>;
}): Promise<PremiumAccessResult> {
  const state = await readPremiumState({
    userId: params.userId,
    email: params.email,
  });

  const requestedCallIds = normalizeCallIds(params.callIds);

  if (state.isPremium) {
    return {
      allowed: true,
      isPremium: true,
      reason: "premium",
      trialConsumed: false,
      freeTrialCallIds: state.freeTrialCallIds,
    };
  }

  const hasExistingTrialAccess = requestedCallIds.some((id) =>
    state.freeTrialCallIds.includes(id)
  );

  if (hasExistingTrialAccess) {
    const mergedCallIds = normalizeCallIds([
      ...state.freeTrialCallIds,
      ...requestedCallIds,
    ]);

    if (mergedCallIds.length !== state.freeTrialCallIds.length) {
      await db.collection("users").doc(params.userId).set(
        {
          freeTrialCallIds: mergedCallIds,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    return {
      allowed: true,
      isPremium: false,
      reason: "free-trial",
      trialConsumed: false,
      freeTrialCallIds: mergedCallIds,
    };
  }

  if (!state.freeTrialUsed && requestedCallIds.length > 0) {
    const now = new Date().toISOString();

    await db.collection("users").doc(params.userId).set(
      {
        freeTrialUsed: true,
        freeTrialCallIds: requestedCallIds,
        freeTrialUsedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    return {
      allowed: true,
      isPremium: false,
      reason: "free-trial",
      trialConsumed: true,
      freeTrialCallIds: requestedCallIds,
    };
  }

  if (state.freeTrialUsed && state.freeTrialCallIds.length === 0 && requestedCallIds.length > 0) {
    const now = new Date().toISOString();

    await db.collection("users").doc(params.userId).set(
      {
        freeTrialCallIds: requestedCallIds,
        updatedAt: now,
      },
      { merge: true }
    );

    return {
      allowed: true,
      isPremium: false,
      reason: "free-trial",
      trialConsumed: false,
      freeTrialCallIds: requestedCallIds,
    };
  }

  return {
    allowed: false,
    isPremium: false,
    reason: "upgrade-required",
    trialConsumed: false,
    freeTrialCallIds: state.freeTrialCallIds,
  };
}

export async function checkPremiumAccessForFeature(params: {
  userId: string;
  email?: string | null;
  featureKeys: Array<string | null | undefined>;
}): Promise<PremiumAccessResult> {
  return checkPremiumAccessForCall({
    userId: params.userId,
    email: params.email,
    callIds: params.featureKeys,
  });
}

export async function checkAndConsumePremiumDailyLimit(params: {
  userId: string;
  email?: string | null;
  kind: PremiumDailyLimitKind;
  usageKey?: string | null;
  consume?: boolean;
}): Promise<PremiumDailyLimitResult> {
  const today = getTodayUtcKey();
  const limit = getSafeDailyLimit(params.kind);
  const resolvedUsageKey =
    String(params.usageKey || "").trim() || `${params.kind}:${Date.now()}`;
  const shouldConsume = params.consume !== false;

  let result: PremiumDailyLimitResult = {
    allowed: true,
    isPremium: false,
    kind: params.kind,
    date: today,
    limit,
    used: 0,
    remaining: limit,
  };

  await ensureSeedPremiumAccess({ userId: params.userId, email: params.email });

  const userRef = db.collection("users").doc(params.userId);

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef);
    const userData = (snapshot.data() || {}) as PremiumUserDocument;

    const emailFromDoc = normalizeEmail(userData.email);
    const isPremium =
      Boolean(userData.isPremium) ||
      isSeedPremiumEmail(params.email) ||
      isSeedPremiumEmail(emailFromDoc);

    if (!isPremium) {
      result = {
        ...result,
        isPremium: false,
      };
      return;
    }

    const dailyUsage = userData.premiumDailyUsage || {};
    const isSameDay = dailyUsage.date === today;

    const feedbackKeys = isSameDay
      ? normalizeCallIds(dailyUsage.feedbackKeys || [])
      : [];
    const interviewKeys = isSameDay
      ? normalizeCallIds(dailyUsage.interviewKeys || [])
      : [];

    const usageBucket =
      params.kind === "feedback" ? feedbackKeys : interviewKeys;
    const alreadyCounted = usageBucket.includes(resolvedUsageKey);

    if (!alreadyCounted && usageBucket.length >= limit) {
      result = {
        allowed: false,
        isPremium: true,
        kind: params.kind,
        date: today,
        limit,
        used: usageBucket.length,
        remaining: 0,
      };
      return;
    }

    let nextUsed = usageBucket.length;
    let shouldWrite = !isSameDay;

    if (shouldConsume && !alreadyCounted) {
      usageBucket.push(resolvedUsageKey);
      nextUsed = usageBucket.length;
      shouldWrite = true;
    }

    if (shouldWrite) {
      transaction.set(
        userRef,
        {
          premiumDailyUsage: {
            date: today,
            feedbackKeys,
            interviewKeys,
          },
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }

    result = {
      allowed: true,
      isPremium: true,
      kind: params.kind,
      date: today,
      limit,
      used: nextUsed,
      remaining: Math.max(0, limit - nextUsed),
    };
  });

  return result;
}

export function getPremiumDailyLimitErrorPayload(params: {
  kind: PremiumDailyLimitKind;
  limit: number;
  date: string;
}) {
  const targetLabel =
    params.kind === "feedback"
      ? "feedback analyses"
      : "interviews";

  return {
    code: "PREMIUM_DAILY_LIMIT_REACHED",
    error: "Daily premium limit reached",
    message: `Premium users can use up to ${params.limit} ${targetLabel} per day. Today's limit is already reached.`,
    kind: params.kind,
    limit: params.limit,
    date: params.date,
  };
}

export function getPremiumRequiredErrorPayload() {
  return {
    code: "PREMIUM_REQUIRED",
    error: "Premium subscription required",
    message:
      "This Vapi AI feature requires Premium after your first free usage. Click 'Yes I am a premium user' to continue.",
  };
}

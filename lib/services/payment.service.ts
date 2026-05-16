import { db } from "@/services/firebase/admin";
import crypto from "crypto";

// ─── Product Catalog ────────────────────────────────────────────────────────
export const PRODUCTS = {
  INTERVIEW_10: {
    id: "interview_10",
    name: "10-Min Interview Session",
    description: "10-minute AI-powered voice interview with focused feedback",
    priceInPaise: 14900, // ₹149 (standard)
    creditType: "interviews10" as const,
    credits: 1,
    timeLimitMinutes: 10,
  },
  INTERVIEW_30: {
    id: "interview_30",
    name: "30-Min Interview Session",
    description: "30-minute AI-powered voice interview with detailed feedback",
    priceInPaise: 39900, // ₹399 (standard)
    creditType: "interviews30" as const,
    credits: 1,
    timeLimitMinutes: 30,
  },
  // Legacy aliases kept for older orders and backwards compatibility.
  SINGLE_INTERVIEW: {
    id: "single_interview",
    name: "Single Interview Session (Legacy)",
    description: "30-minute AI-powered voice interview with detailed feedback",
    priceInPaise: 39900, // ₹399
    creditType: "interviews30" as const,
    credits: 1,
    timeLimitMinutes: 30,
  },
  LIMITED_OFFER_INTERVIEW: {
    id: "limited_offer_interview",
    name: "Limited Offer Interview Session (Legacy)",
    description: "30-minute AI-powered voice interview with detailed feedback (Legacy offer)",
    priceInPaise: 14900, // ₹149
    creditType: "interviews30" as const,
    credits: 1,
    timeLimitMinutes: 30,
  },
  DSA_STARTER: {
    id: "dsa_starter",
    name: "DSA Starter",
    description: "1 AI-guided DSA practice session — try it out",
    priceInPaise: 2900, // ₹29
    creditType: "dsaSessions" as const,
    credits: 1,
    timeLimitMinutes: 30,
    messageLimit: 60,
  },
  DSA_PRACTICE: {
    id: "dsa_practice",
    name: "DSA Practice Pack",
    description: "5 AI-guided DSA practice sessions — best for students",
    priceInPaise: 9900, // ₹99
    creditType: "dsaSessions" as const,
    credits: 5,
    timeLimitMinutes: 30,
    messageLimit: 60,
  },
  DSA_PRO: {
    id: "dsa_pro",
    name: "DSA Pro Pack",
    description: "12 AI-guided DSA practice sessions — maximum value",
    priceInPaise: 19900, // ₹199
    creditType: "dsaSessions" as const,
    credits: 12,
    timeLimitMinutes: 30,
    messageLimit: 60,
  },
  INTERVIEW_PACK_5: {
    id: "interview_pack_5",
    name: "Interview Pack (5 Sessions)",
    description: "5 AI-powered voice interview sessions — save 25%",
    priceInPaise: 149900, // ₹1,499
    creditType: "interviews30" as const,
    credits: 5,
    timeLimitMinutes: 30,
  },
  BULK_COLLEGE_PLAN: {
    id: "bulk_college_plan",
    name: "College Bulk Plan",
    description: "Custom bulk interviews for students",
    priceInPaise: 0, // Dynamic
    creditType: "interviews30" as const,
    credits: 0, // Dynamic
    timeLimitMinutes: 30,
  },
  RECRUITER_VISIBILITY: {
    id: "recruiter_visibility",
    name: "Recruiter Visibility Add-on",
    description: "Get your interview performance visible to recruiters for hiring",
    priceInPaise: 3000, // ₹30
    creditType: "interviews30" as const,
    credits: 0, // No interview credits — this is a visibility add-on
    timeLimitMinutes: 0,
  },
} as const;

export type ProductId = keyof typeof PRODUCTS;
export type CreditType = "interviews10" | "interviews30" | "interviews" | "dsaSessions";

const PROMO_LIMIT = 10;

const PROMO_PRICES: Record<string, number> = {
  interview_10: 4900,
  interview_30: 14900,
  dsa_starter: 1900,
  dsa_practice: 7900,
  dsa_pro: 15900,
};

type PromoKind = "interview" | "dsa";

export function getProductById(productId: string) {
  return Object.values(PRODUCTS).find((p) => p.id === productId) || null;
}

// ─── Limited Offer Tracking ─────────────────────────────────────────────────
export async function getUserPromoUsage(userId: string): Promise<{ interview: number; dsa: number }> {
  const userRef = db.collection("users").doc(userId);
  const userSnap = await userRef.get();
  const data = userSnap.data() || {};
  const promo = (data.promoUsage || {}) as { interview?: number; dsa?: number };

  return {
    interview: Number(promo.interview ?? 0),
    dsa: Number(promo.dsa ?? 0),
  };
}

export async function incrementUserPromoUsage(userId: string, kind: PromoKind): Promise<number> {
  const userRef = db.collection("users").doc(userId);
  let updatedCount = 0;

  await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    const data = userSnap.data() || {};
    const promo = (data.promoUsage || {}) as { interview?: number; dsa?: number };
    const current = Number(promo[kind] ?? 0);
    updatedCount = current + 1;

    transaction.set(
      userRef,
      { promoUsage: { ...promo, [kind]: updatedCount } },
      { merge: true }
    );
  });

  return updatedCount;
}

export async function getPromoRemaining(userId: string | null, kind: PromoKind): Promise<number> {
  if (!userId) return PROMO_LIMIT;
  const usage = await getUserPromoUsage(userId);
  const used = kind === "interview" ? usage.interview : usage.dsa;
  return Math.max(0, PROMO_LIMIT - used);
}

export function getPromoPrice(productId: string): number | null {
  return PROMO_PRICES[productId] ?? null;
}

export function getPromoKind(productId: string): PromoKind | null {
  if (productId === "interview_10" || productId === "interview_30") return "interview";
  if (productId === "dsa_starter" || productId === "dsa_practice" || productId === "dsa_pro") return "dsa";
  return null;
}

// ─── Razorpay Order Creation ────────────────────────────────────────────────
interface CreateOrderParams {
  amountInPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}

interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  created_at: number;
}

export async function createRazorpayOrder(
  params: CreateOrderParams
): Promise<RazorpayOrder> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials not configured");
  }

  if (params.amountInPaise < 100) {
    throw new Error("Amount must be at least 100 paise (₹1)");
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.amountInPaise,
      currency: params.currency || "INR",
      receipt: params.receipt,
      notes: params.notes || {},
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Razorpay order creation failed:", response.status, errorBody);

    if (response.status === 401) {
      throw new Error("RAZORPAY_AUTH_FAILED");
    }
    throw new Error(`Razorpay API error: ${response.status}`);
  }

  return response.json();
}

export async function fetchRazorpayOrder(orderId: string): Promise<any> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials not configured");
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const response = await fetch(`https://api.razorpay.com/v1/orders/${orderId}`, {
    method: "GET",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Razorpay API error: ${response.status}`);
  }

  return response.json();
}

// ─── Signature Verification ─────────────────────────────────────────────────
export function verifyRazorpaySignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    throw new Error("Razorpay key secret not configured");
  }

  const body = `${params.orderId}|${params.paymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(body)
    .digest("hex");

  // Timing-safe comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(params.signature, "hex")
    );
  } catch {
    return false;
  }
}

// ─── Credit Management ──────────────────────────────────────────────────────
interface UserCredits {
  interviews: number;
  interviews10: number;
  interviews30: number;
  dsaSessions: number;
}

export async function getUserCredits(userId: string): Promise<UserCredits> {
  const userRef = db.collection("users").doc(userId);
  const userSnap = await userRef.get();
  const data = userSnap.data() || {};

  const legacyInterviews = Number(data.credits?.interviews ?? 0);
  const interviews10 = Number(data.credits?.interviews10 ?? 0);
  let interviews30 = Number(data.credits?.interviews30 ?? 0);

  if (legacyInterviews > 0 && interviews10 === 0 && interviews30 === 0) {
    interviews30 = legacyInterviews;
  }

  return {
    interviews: interviews10 + interviews30,
    interviews10,
    interviews30,
    dsaSessions: Number(data.credits?.dsaSessions ?? 0),
  };
}

export async function grantCredits(params: {
  userId: string;
  creditType: CreditType;
  amount: number;
  paymentId: string;
  orderId: string;
  productId: string;
  hasVisibility?: boolean;
}): Promise<UserCredits> {
  const userRef = db.collection("users").doc(params.userId);

  let updatedCredits: UserCredits = { interviews: 0, dsaSessions: 0 };

  await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    const userData = userSnap.data() || {};

    const legacyInterviews = Number(userData.credits?.interviews ?? 0);
    const currentCredits: UserCredits = {
      interviews10: Number(userData.credits?.interviews10 ?? 0),
      interviews30: Number(userData.credits?.interviews30 ?? 0),
      interviews: 0,
      dsaSessions: Number(userData.credits?.dsaSessions ?? 0),
    };

    if (legacyInterviews > 0 && currentCredits.interviews10 === 0 && currentCredits.interviews30 === 0) {
      currentCredits.interviews30 = legacyInterviews;
    }

    const creditKey =
      params.creditType === "interviews"
        ? "interviews30"
        : params.creditType;

    if (creditKey !== "dsaSessions") {
      currentCredits[creditKey as "interviews10" | "interviews30"] += params.amount;
    } else {
      currentCredits.dsaSessions += params.amount;
    }

    currentCredits.interviews = currentCredits.interviews10 + currentCredits.interviews30;
    updatedCredits = { ...currentCredits };

    const now = new Date().toISOString();

    // Build payment record
    const paymentRecord = {
      paymentId: params.paymentId,
      orderId: params.orderId,
      productId: params.productId,
      creditType: params.creditType,
      creditsGranted: params.amount,
      hasVisibility: params.hasVisibility || false,
      timestamp: now,
      status: "verified",
    };

    const updateData: any = {
      credits: {
        interviews: currentCredits.interviews,
        interviews10: currentCredits.interviews10,
        interviews30: currentCredits.interviews30,
        dsaSessions: currentCredits.dsaSessions,
      },
      updatedAt: now,
    };

    if (params.hasVisibility) {
      updateData.recruiterVisible = true;
    }

    transaction.set(
      userRef,
      updateData,
      { merge: true }
    );

    // Store payment record in a sub-collection for audit trail
    const paymentRef = db
      .collection("users")
      .doc(params.userId)
      .collection("payments")
      .doc(params.paymentId);
    transaction.set(paymentRef, paymentRecord);
  });

  return updatedCredits;
}

export async function consumeCredit(params: {
  userId: string;
  creditType: CreditType;
}): Promise<{ allowed: boolean; remaining: number }> {
  const userRef = db.collection("users").doc(params.userId);

  let result = { allowed: false, remaining: 0 };

  await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    const userData = userSnap.data() || {};

    const legacyInterviews = Number(userData.credits?.interviews ?? 0);
    const currentCredits: UserCredits = {
      interviews10: Number(userData.credits?.interviews10 ?? 0),
      interviews30: Number(userData.credits?.interviews30 ?? 0),
      interviews: 0,
      dsaSessions: Number(userData.credits?.dsaSessions ?? 0),
    };

    if (legacyInterviews > 0 && currentCredits.interviews10 === 0 && currentCredits.interviews30 === 0) {
      currentCredits.interviews30 = legacyInterviews;
    }

    const creditKey =
      params.creditType === "interviews"
        ? "interviews30"
        : params.creditType;

    const available = creditKey === "dsaSessions"
      ? currentCredits.dsaSessions
      : currentCredits[creditKey as "interviews10" | "interviews30"];

    if (available <= 0) {
      result = { allowed: false, remaining: 0 };
      return;
    }

    if (creditKey === "dsaSessions") {
      currentCredits.dsaSessions -= 1;
    } else {
      currentCredits[creditKey as "interviews10" | "interviews30"] -= 1;
    }

    currentCredits.interviews = currentCredits.interviews10 + currentCredits.interviews30;

    transaction.set(
      userRef,
      {
        credits: {
          interviews: currentCredits.interviews,
          interviews10: currentCredits.interviews10,
          interviews30: currentCredits.interviews30,
          dsaSessions: currentCredits.dsaSessions,
        },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    const remaining = creditKey === "dsaSessions"
      ? currentCredits.dsaSessions
      : currentCredits[creditKey as "interviews10" | "interviews30"];

    result = {
      allowed: true,
      remaining,
    };
  });

  return result;
}

// ─── Payment Verification Check ─────────────────────────────────────────────
export async function isPaymentAlreadyProcessed(
  paymentId: string,
  userId: string
): Promise<boolean> {
  const paymentRef = db
    .collection("users")
    .doc(userId)
    .collection("payments")
    .doc(paymentId);

  const paymentSnap = await paymentRef.get();
  return paymentSnap.exists;
}

// ─── Premium Session Tracking (Server-side enforcement) ───────────────────
export type PremiumFeature = "interview" | "dsa-practice";

export interface PremiumSession {
  id: string;
  userId: string;
  feature: PremiumFeature;
  planId: string;
  timeLimitMinutes: number;
  messageLimit?: number | null;
  createdAt: string;
  expiresAtMs: number;
  status: "active" | "expired" | "completed";
}

export async function createPremiumSession(params: {
  userId: string;
  feature: PremiumFeature;
  planId: string;
  timeLimitMinutes: number;
  messageLimit?: number | null;
}): Promise<PremiumSession> {
  const sessionRef = db.collection("premium_sessions").doc();
  const now = Date.now();
  const expiresAtMs = now + params.timeLimitMinutes * 60 * 1000;
  const payload: PremiumSession = {
    id: sessionRef.id,
    userId: params.userId,
    feature: params.feature,
    planId: params.planId,
    timeLimitMinutes: params.timeLimitMinutes,
    messageLimit: params.messageLimit ?? null,
    createdAt: new Date(now).toISOString(),
    expiresAtMs,
    status: "active",
  };

  await sessionRef.set(payload, { merge: true });
  return payload;
}

export async function getPremiumSession(sessionId: string): Promise<PremiumSession | null> {
  const ref = db.collection("premium_sessions").doc(sessionId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  return snap.data() as PremiumSession;
}

export async function markPremiumSessionStatus(sessionId: string, status: PremiumSession["status"]): Promise<void> {
  const ref = db.collection("premium_sessions").doc(sessionId);
  await ref.set({ status }, { merge: true });
}

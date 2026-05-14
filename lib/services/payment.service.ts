import { db } from "@/services/firebase/admin";
import crypto from "crypto";

// ─── Product Catalog ────────────────────────────────────────────────────────
export const PRODUCTS = {
  SINGLE_INTERVIEW: {
    id: "single_interview",
    name: "Single Interview Session",
    description: "30-minute AI-powered voice interview with detailed feedback",
    priceInPaise: 39900, // ₹399
    creditType: "interviews" as const,
    credits: 1,
    timeLimitMinutes: 30,
  },
  LIMITED_OFFER_INTERVIEW: {
    id: "limited_offer_interview",
    name: "Limited Offer Interview Session",
    description: "30-minute AI-powered voice interview with detailed feedback (First 10 Users)",
    priceInPaise: 19900, // ₹199
    creditType: "interviews" as const,
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
    creditType: "interviews" as const,
    credits: 5,
    timeLimitMinutes: 30,
  },
} as const;

export type ProductId = keyof typeof PRODUCTS;
export type CreditType = "interviews" | "dsaSessions";

export function getProductById(productId: string) {
  return Object.values(PRODUCTS).find((p) => p.id === productId) || null;
}

// ─── Limited Offer Tracking ─────────────────────────────────────────────────
export async function getLimitedOfferCount(): Promise<number> {
  const docRef = db.collection("system").doc("pricing");
  const snap = await docRef.get();
  return snap.data()?.limitedOfferCount || 0;
}

export async function incrementLimitedOfferCount(): Promise<void> {
  const docRef = db.collection("system").doc("pricing");
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(docRef);
    const count = snap.data()?.limitedOfferCount || 0;
    transaction.set(docRef, { limitedOfferCount: count + 1 }, { merge: true });
  });
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
  dsaSessions: number;
}

export async function getUserCredits(userId: string): Promise<UserCredits> {
  const userRef = db.collection("users").doc(userId);
  const userSnap = await userRef.get();
  const data = userSnap.data() || {};

  return {
    interviews: Number(data.credits?.interviews ?? 0),
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
}): Promise<UserCredits> {
  const userRef = db.collection("users").doc(params.userId);

  let updatedCredits: UserCredits = { interviews: 0, dsaSessions: 0 };

  await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    const userData = userSnap.data() || {};

    const currentCredits: UserCredits = {
      interviews: Number(userData.credits?.interviews ?? 0),
      dsaSessions: Number(userData.credits?.dsaSessions ?? 0),
    };

    // Add new credits
    currentCredits[params.creditType] += params.amount;
    updatedCredits = { ...currentCredits };

    const now = new Date().toISOString();

    // Build payment record
    const paymentRecord = {
      paymentId: params.paymentId,
      orderId: params.orderId,
      productId: params.productId,
      creditType: params.creditType,
      creditsGranted: params.amount,
      timestamp: now,
      status: "verified",
    };

    transaction.set(
      userRef,
      {
        credits: currentCredits,
        updatedAt: now,
      },
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

    const currentCredits: UserCredits = {
      interviews: Number(userData.credits?.interviews ?? 0),
      dsaSessions: Number(userData.credits?.dsaSessions ?? 0),
    };

    if (currentCredits[params.creditType] <= 0) {
      result = { allowed: false, remaining: 0 };
      return;
    }

    currentCredits[params.creditType] -= 1;

    transaction.set(
      userRef,
      {
        credits: currentCredits,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    result = {
      allowed: true,
      remaining: currentCredits[params.creditType],
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

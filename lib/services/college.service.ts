import { db } from "@/services/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

// ─── College Domain Management ──────────────────────────────────────────────

export interface CollegePlan {
  collegeName: string;
  emailDomain: string; // e.g. "srmist.edu.in"
  totalInterviews: number;
  usedInterviews: number;
  contactEmail: string;
  purchasedAt: string;
  active: boolean;
}

/**
 * Register a college's email domain with a purchased interview pool.
 * Called by the admin or via a college purchase API.
 */
export async function registerCollegePlan(params: {
  collegeName: string;
  emailDomain: string;
  totalInterviews: number;
  contactEmail: string;
}): Promise<CollegePlan> {
  const domain = params.emailDomain.toLowerCase().trim();
  const planRef = db.collection("college_plans").doc(domain);

  const plan: CollegePlan = {
    collegeName: params.collegeName,
    emailDomain: domain,
    totalInterviews: params.totalInterviews,
    usedInterviews: 0,
    contactEmail: params.contactEmail.toLowerCase(),
    purchasedAt: new Date().toISOString(),
    active: true,
  };

  await planRef.set(plan);
  return plan;
}

/**
 * Check if a user's email matches any active college plan.
 * Extracts domain from email (after @) and looks up Firestore.
 */
export async function getCollegePlanForUser(
  userEmail: string
): Promise<CollegePlan | null> {
  if (!userEmail || !userEmail.includes("@")) return null;

  const domain = userEmail.split("@")[1].toLowerCase().trim();
  const planRef = db.collection("college_plans").doc(domain);
  const planSnap = await planRef.get();

  if (!planSnap.exists) return null;

  const plan = planSnap.data() as CollegePlan;
  if (!plan.active) return null;

  return plan;
}

/**
 * Consume one interview from a college's pool.
 * Returns whether the consumption was allowed.
 * Uses a Firestore transaction to prevent race conditions.
 */
export async function consumeCollegeInterview(params: {
  userEmail: string;
  userId: string;
}): Promise<{ allowed: boolean; remaining: number; collegeName: string }> {
  const domain = params.userEmail.split("@")[1].toLowerCase().trim();
  const planRef = db.collection("college_plans").doc(domain);

  let result = { allowed: false, remaining: 0, collegeName: "" };

  await db.runTransaction(async (transaction) => {
    const planSnap = await transaction.get(planRef);

    if (!planSnap.exists) {
      result = { allowed: false, remaining: 0, collegeName: "" };
      return;
    }

    const plan = planSnap.data() as CollegePlan;

    if (!plan.active) {
      result = { allowed: false, remaining: 0, collegeName: plan.collegeName };
      return;
    }

    const remaining = plan.totalInterviews - plan.usedInterviews;

    if (remaining <= 0) {
      result = { allowed: false, remaining: 0, collegeName: plan.collegeName };
      return;
    }

    // Deduct one interview
    transaction.update(planRef, {
      usedInterviews: FieldValue.increment(1),
    });

    // Log the usage for audit
    const usageRef = db
      .collection("college_plans")
      .doc(domain)
      .collection("usage_log")
      .doc();

    transaction.set(usageRef, {
      userId: params.userId,
      userEmail: params.userEmail,
      timestamp: new Date().toISOString(),
      type: "interview",
    });

    result = {
      allowed: true,
      remaining: remaining - 1,
      collegeName: plan.collegeName,
    };
  });

  return result;
}

/**
 * Get remaining interviews for a college plan by domain.
 */
export async function getCollegePlanStatus(
  emailDomain: string
): Promise<{ remaining: number; total: number; active: boolean } | null> {
  const domain = emailDomain.toLowerCase().trim();
  const planRef = db.collection("college_plans").doc(domain);
  const planSnap = await planRef.get();

  if (!planSnap.exists) return null;

  const plan = planSnap.data() as CollegePlan;

  return {
    remaining: plan.totalInterviews - plan.usedInterviews,
    total: plan.totalInterviews,
    active: plan.active,
  };
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { getPromoRemaining } from "@/lib/services/payment.service";

export async function GET() {
  try {
    const user = await getCurrentUser().catch(() => null);
    const interviewRemaining = await getPromoRemaining(user?.id ?? null, "interview");
    const dsaRemaining = await getPromoRemaining(user?.id ?? null, "dsa");

    const interviewPromoActive = interviewRemaining > 0;
    const dsaPromoActive = dsaRemaining > 0;

    return NextResponse.json({
      interview: {
        promoRemaining: interviewRemaining,
        plans: {
          interview_10: {
            price: interviewPromoActive ? 49 : 149,
            productId: "interview_10",
            minutes: 10,
          },
          interview_30: {
            price: interviewPromoActive ? 149 : 399,
            productId: "interview_30",
            minutes: 30,
          },
        },
      },
      dsa: {
        promoRemaining: dsaRemaining,
        tiers: {
          starter: {
            price: dsaPromoActive ? 19 : 29,
            productId: "dsa_starter",
            sessions: 1,
          },
          pack: {
            price: dsaPromoActive ? 79 : 99,
            productId: "dsa_practice",
            sessions: 5,
          },
          pro: {
            price: dsaPromoActive ? 159 : 199,
            productId: "dsa_pro",
            sessions: 12,
          },
        },
      },
    });
  } catch (error) {
    console.error("Failed to fetch interview price:", error);
    return NextResponse.json({
      interview: {
        promoRemaining: 0,
        plans: {
          interview_10: { price: 149, productId: "interview_10", minutes: 10 },
          interview_30: { price: 399, productId: "interview_30", minutes: 30 },
        },
      },
      dsa: {
        promoRemaining: 0,
        tiers: {
          starter: { price: 29, productId: "dsa_starter", sessions: 1 },
          pack: { price: 99, productId: "dsa_practice", sessions: 5 },
          pro: { price: 199, productId: "dsa_pro", sessions: 12 },
        },
      },
    });
  }
}

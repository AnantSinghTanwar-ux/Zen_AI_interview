import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { registerCollegePlan } from "@/lib/services/college.service";

// Seed admin emails that can register college plans
const ADMIN_EMAILS = [
  "anantsa@gmail.com",
  "anant@srmist.edu.in",
];

/**
 * POST /api/college/register
 * Admin-only endpoint to register a college email domain with purchased interviews.
 *
 * Body: { collegeName, emailDomain, totalInterviews, contactEmail }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can register college plans
    if (!ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? "")) {
      return NextResponse.json(
        { error: "Only administrators can register college plans" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { collegeName, emailDomain, totalInterviews, contactEmail } = body;

    // Validate required fields
    if (!collegeName || !emailDomain || !totalInterviews || !contactEmail) {
      return NextResponse.json(
        { error: "collegeName, emailDomain, totalInterviews, and contactEmail are required" },
        { status: 400 }
      );
    }

    // Validate email domain format
    const domainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(emailDomain)) {
      return NextResponse.json(
        { error: "Invalid email domain format" },
        { status: 400 }
      );
    }

    if (typeof totalInterviews !== "number" || totalInterviews < 1) {
      return NextResponse.json(
        { error: "totalInterviews must be a positive number" },
        { status: 400 }
      );
    }

    const plan = await registerCollegePlan({
      collegeName,
      emailDomain: emailDomain.toLowerCase(),
      totalInterviews,
      contactEmail,
    });

    return NextResponse.json({
      success: true,
      plan: {
        collegeName: plan.collegeName,
        emailDomain: plan.emailDomain,
        totalInterviews: plan.totalInterviews,
        message: `College plan registered. Students with @${plan.emailDomain} email can now use interviews.`,
      },
    });
  } catch (error) {
    console.error("College register error:", error);
    return NextResponse.json(
      { error: "Failed to register college plan" },
      { status: 500 }
    );
  }
}

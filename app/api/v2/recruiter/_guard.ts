import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { isAllowedRecruiterEmail } from "@/lib/auth/recruiter-access";

// Shared guard: only allow the demo recruiter account
export async function recruiterGuard() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!isAllowedRecruiterEmail(user.email)) {
    return { user: null, error: NextResponse.json({ error: "Access denied" }, { status: 403 }) };
  }
  return { user, error: null };
}

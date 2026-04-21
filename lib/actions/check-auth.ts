"use server";

import { getCurrentUser } from "@/lib/actions/auth.actions";
import { RECRUITER_EMAIL } from "@/types/external-application";

export async function checkAuthStatus() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { isAuthenticated: false, isRecruiter: false };
    }

    const email = String(user.email || "").trim().toLowerCase();
    const userType = String((user as { userType?: string }).userType || "").trim().toLowerCase();
    const isRecruiter = email === RECRUITER_EMAIL.toLowerCase() || userType === "recruiter";

    return { isAuthenticated: true, isRecruiter };
  } catch (error) {
    console.error("Error checking auth status:", error);
    return { isAuthenticated: false, isRecruiter: false };
  }
}

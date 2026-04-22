"use server";

import { getCurrentUser } from "@/lib/actions/auth.actions";
import { isAllowedRecruiterEmail } from "@/lib/auth/recruiter-access";

export async function checkAuthStatus() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { isAuthenticated: false, isRecruiter: false };
    }

    const isRecruiter = isAllowedRecruiterEmail(user.email);

    return { isAuthenticated: true, isRecruiter };
  } catch (error) {
    console.error("Error checking auth status:", error);
    return { isAuthenticated: false, isRecruiter: false };
  }
}

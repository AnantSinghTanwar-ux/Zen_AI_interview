"use server";

import { getCurrentUser } from "@/lib/actions/auth.actions";
import { isAllowedRecruiterEmail } from "@/lib/auth/recruiter-access";

import { db } from "@/services/firebase/admin";

export async function checkAuthStatus() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { isAuthenticated: false, isRecruiter: false };
    }

    let isRecruiter = isAllowedRecruiterEmail(user.email);

    // If not a hardcoded admin recruiter, check the Firestore userType
    if (!isRecruiter) {
      const userDoc = await db.collection("users").doc(user.uid).get();
      if (userDoc.exists) {
        const data = userDoc.data();
        if (data?.userType === "recruiter") {
          isRecruiter = true;
        }
      }
    }

    return { isAuthenticated: true, isRecruiter };
  } catch (error) {
    console.error("Error checking auth status:", error);
    return { isAuthenticated: false, isRecruiter: false };
  }
}

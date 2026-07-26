import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { isAllowedRecruiterEmail } from "@/lib/auth/recruiter-access";
import { db } from "@/services/firebase/admin";

export async function recruiterGuard() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  
  let isRecruiter = isAllowedRecruiterEmail(user.email);
  if (!isRecruiter) {
      const userDoc = await db.collection("users").doc(user.uid).get();
      if (userDoc.exists && userDoc.data()?.userType === "recruiter") {
          isRecruiter = true;
      }
  }

  if (!isRecruiter) {
    return { user: null, error: NextResponse.json({ error: "Access denied" }, { status: 403 }) };
  }
  return { user, error: null };
}

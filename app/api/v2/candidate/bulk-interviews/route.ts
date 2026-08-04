import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { db } from "@/services/firebase/admin";
import { COLLECTION_BULK_CANDIDATES } from "@/constants/screening.config";

/**
 * GET /api/v2/candidate/bulk-interviews — Get shortlisted bulk applications for the current user.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = user.email.toLowerCase();

    // Fetch shortlisted candidates for this email
    const snapshot = await db
      .collection(COLLECTION_BULK_CANDIDATES)
      .where("email", "==", email)
      .where("isShortlisted", "==", true)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ interviews: [] });
    }

    // Since we need job details (title, companyName) we fetch them
    const interviews = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const jobId = data.jobId;
      
      let jobTitle = "Unknown Position";
      let companyName = "Unknown Company";

      if (jobId) {
        const jobDoc = await db.collection("jobs").doc(jobId).get();
        if (jobDoc.exists) {
          const jobData = jobDoc.data()!;
          jobTitle = jobData.title || jobTitle;
          companyName = jobData.companyName || companyName;
        }
      }

      interviews.push({
        id: doc.id,
        bulkJobId: data.bulkJobId,
        jobId,
        jobTitle,
        companyName,
        interviewToken: data.interviewToken,
        interviewCompletedAt: data.interviewCompletedAt,
        interviewScore: data.interviewScore,
        createdAt: data.createdAt,
      });
    }

    return NextResponse.json({ interviews });
  } catch (error) {
    console.error("[GET /api/v2/candidate/bulk-interviews] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch scheduled bulk interviews" },
      { status: 500 }
    );
  }
}

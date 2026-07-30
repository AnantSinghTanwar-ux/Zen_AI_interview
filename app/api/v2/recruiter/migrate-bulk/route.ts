import { NextResponse } from "next/server";
import { db } from "@/services/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export async function GET() {
  try {
    const bulkCandidates = await db.collection("bulk_candidates").get();
    let migratedCount = 0;

    for (const doc of bulkCandidates.docs) {
      const data = doc.data();
      if (!data.jobId) continue;
      
      const exist = await db.collection("applicants")
        .where("jobId", "==", data.jobId)
        .where("email", "==", data.email)
        .get();

      let applicantId = "";
      if (exist.empty) {
        const appRef = db.collection("applicants").doc();
        await appRef.set({
          jobId: data.jobId,
          name: data.name || data.fileName || "Candidate",
          email: data.email || "no-email@test.com",
          resumeText: data.resumeText || "",
          status: data.isShortlisted ? "shortlisted" : "pending",
          appliedAt: data.createdAt,
          interviewScore: data.interviewScore || null,
          interviewRecommendation: data.interviewFeedback || null,
        });
        applicantId = appRef.id;
      } else {
         applicantId = exist.docs[0].id;
         await db.collection("applicants").doc(applicantId).update({
            interviewScore: data.interviewScore || null,
            interviewRecommendation: data.interviewFeedback || null,
         });
      }

      try {
        await db.collection("jobs").doc(data.jobId).update({
          applicantIds: FieldValue.arrayUnion(applicantId)
        });
      } catch(e) {}
      
      migratedCount++;
    }

    return NextResponse.json({ success: true, migratedCount });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

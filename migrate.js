require('dotenv').config({ path: '.env.local' });
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const fs = require('fs');

if (getApps().length === 0) {
  let serviceAccount = null;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const decodedKey = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf8');
      serviceAccount = JSON.parse(decodedKey);
    } catch (e) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    }
  } else if (fs.existsSync('./service-account.json')) {
    serviceAccount = require('./service-account.json');
  }
  
  if (serviceAccount) {
    initializeApp({ credential: cert(serviceAccount) });
  } else {
    initializeApp();
  }
}
const db = getFirestore();

async function run() {
  const bulkCandidates = await db.collection("bulk_candidates").get();
  console.log("Found " + bulkCandidates.docs.length + " bulk candidates");
  
  for (const doc of bulkCandidates.docs) {
    const data = doc.data();
    if (!data.jobId) continue;
    
    // Check if applicant exists with this email
    const exist = await db.collection("applicants").where("jobId", "==", data.jobId).where("email", "==", data.email).get();
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
    console.log("Migrated " + data.email);
  }
}
run().then(() => console.log("Done")).catch(console.error);

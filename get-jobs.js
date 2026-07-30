const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

let serviceAccount = null;
if (fs.existsSync('./service-account.json')) {
  serviceAccount = require('./service-account.json');
} else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    const decodedKey = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf8');
    serviceAccount = JSON.parse(decodedKey);
  } catch (e) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  }
}

if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });

async function getJobs() {
  const db = getFirestore();
  const snapshot = await db.collection("jobs").limit(1).get();
  console.log("Job ID:", snapshot.docs[0]?.id);
}
getJobs();

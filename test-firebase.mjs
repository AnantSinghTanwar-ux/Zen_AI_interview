import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
let privateKey = rawPrivateKey ? rawPrivateKey.trim() : '';
if ((privateKey.startsWith('"') && privateKey.endsWith('"')) || (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
  privateKey = privateKey.slice(1, -1);
}
privateKey = privateKey.replace(/\\n/g, "\n");

try {
  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
  console.log("App initialized");
  const auth = getAuth(app);
  console.log("Auth initialized");
  const db = getFirestore(app);
  console.log("Firestore initialized");
  
  const testSnap = await db.collection("users").limit(1).get();
  console.log("Firestore fetch success, docs:", testSnap.size);
} catch (e) {
  console.error("Error:", e);
}

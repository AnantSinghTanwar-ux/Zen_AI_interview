import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const normalizePrivateKey = (rawKey: string): string => {
  let privateKey = rawKey.trim();

  // Remove wrapping quotes if user copied a quoted value into env.
  if (
    (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
    (privateKey.startsWith("'") && privateKey.endsWith("'"))
  ) {
    privateKey = privateKey.slice(1, -1);
  }

  // Convert literal escaped newlines to actual newlines.
  privateKey = privateKey.replace(/\\n/g, "\n");

  // Support base64-encoded private key values.
  if (!privateKey.includes("BEGIN PRIVATE KEY") && /^[A-Za-z0-9+/=\r\n]+$/.test(privateKey)) {
    try {
      const decoded = Buffer.from(privateKey.replace(/\s+/g, ""), "base64").toString("utf8");
      if (decoded.includes("BEGIN PRIVATE KEY")) {
        privateKey = decoded;
      }
    } catch {
      // Keep original value if decode fails.
    }
  }

  return privateKey;
};

const initializeFirebaseAdmin = () => {
  const apps = getApps();

  if (apps.length > 0) {
    return apps[0];
  }

  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
  
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !rawPrivateKey) {
    const missing = [];
    if (!process.env.FIREBASE_PROJECT_ID) missing.push("FIREBASE_PROJECT_ID");
    if (!process.env.FIREBASE_CLIENT_EMAIL) missing.push("FIREBASE_CLIENT_EMAIL");
    if (!rawPrivateKey) missing.push("FIREBASE_PRIVATE_KEY");
    
    console.error(
      `❌ Firebase Admin: Missing environment variables: ${missing.join(", ")}.`
    );
    return null;
  }

    const privateKey = normalizePrivateKey(rawPrivateKey);

  try {
    return initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
  } catch (error) {
    console.error("❌ Firebase Admin: Failed to initialize:", error);
    return null;
  }
};

const app = initializeFirebaseAdmin();

export const auth = app ? getAuth(app) : new Proxy({} as any, {
    get: (_, prop) => {
        throw new Error(`❌ Firebase Admin: Cannot access "auth.${String(prop)}" because initialization failed. Check your environment variables and logs.`);
    }
});

export const db = app ? getFirestore(app) : new Proxy({} as any, {
    get: (_, prop) => {
        throw new Error(`❌ Firebase Admin: Cannot access "db.${String(prop)}" because initialization failed. Check your environment variables and logs.`);
    }
});



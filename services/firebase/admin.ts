import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

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

  // Robust private key formatting
  let privateKey = rawPrivateKey;
  
  // 1. Remove enclosing quotes if they exist
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
  } else if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
      privateKey = privateKey.slice(1, -1);
  }

  // 2. Handle literal \n sequences vs actual newlines
  if (privateKey.includes("\\n")) {
      privateKey = privateKey.replace(/\\n/g, "\n");
  }

  // 3. Ensure headers exist and are on their own lines
  if (!privateKey.startsWith("-----BEGIN PRIVATE KEY-----")) {
      privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}`;
  }
  if (!privateKey.endsWith("-----END PRIVATE KEY-----")) {
      privateKey = `${privateKey}\n-----END PRIVATE KEY-----\n`;
  }
  
  // 4. Aggressive body normalization
  if (privateKey.includes("-----BEGIN PRIVATE KEY-----") && privateKey.includes("-----END PRIVATE KEY-----")) {
      const parts = privateKey.split("-----");
      // Split by "-----" results in:
      // ["", "BEGIN PRIVATE KEY", "BODY_CONTENT", "END PRIVATE KEY", ""]
      if (parts.length >= 5) {
          const body = parts[2].replace(/\s+/g, ""); // Remove ALL whitespace/newlines from body
          // Re-insert newlines every 64 characters
          const formattedBody = body.match(/.{1,64}/g)?.join("\n") || body;
          privateKey = `-----BEGIN PRIVATE KEY-----\n${formattedBody}\n-----END PRIVATE KEY-----\n`;
      }

  }
  
  // Debug info (safe: only lengths and non-sensitive parts)
  console.log("🔑 [Firebase Admin Debug] Project ID:", process.env.FIREBASE_PROJECT_ID);
  console.log("🔑 [Firebase Admin Debug] Normalized Key Length:", privateKey.length);
  console.log("🔑 [Firebase Admin Debug] Normalized Key Start:", JSON.stringify(privateKey.substring(0, 40)));
  console.log("🔑 [Firebase Admin Debug] Normalized Key End:", JSON.stringify(privateKey.substring(privateKey.length - 40)));

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



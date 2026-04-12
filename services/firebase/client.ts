import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const hasFirebaseClientConfig = () => {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId
  );
};

const getFirebaseApp = (): FirebaseApp => {
  if (typeof window === "undefined") {
    throw new Error("Firebase client cannot be initialized on the server.");
  }

  if (!hasFirebaseClientConfig()) {
    throw new Error(
      "Missing NEXT_PUBLIC_FIREBASE_* environment variables for Firebase client initialization."
    );
  }

  return !getApps().length ? initializeApp(firebaseConfig) : getApp();
};

export const getClientAuth = (): Auth => {
  return getAuth(getFirebaseApp());
};

export const getClientDb = (): Firestore => {
  return getFirestore(getFirebaseApp());
};

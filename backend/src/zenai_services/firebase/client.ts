import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const FIREBASE_PUBLIC_FALLBACKS = {
  apiKey: "AIzaSyArWBhcxCttU2QOR1hkIBG9o640JHbtXS8",
  authDomain: "bodhai-62ef5.firebaseapp.com",
  projectId: "bodhai-62ef5",
  storageBucket: "bodhai-62ef5.appspot.com",
  messagingSenderId: "651506890265",
  appId: "1:651506890265:web:d5adbfb6bd4a06c1015c88",
  measurementId: "G-43LSPVTM83",
};

const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY || FIREBASE_PUBLIC_FALLBACKS.apiKey,
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    FIREBASE_PUBLIC_FALLBACKS.authDomain,
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    FIREBASE_PUBLIC_FALLBACKS.projectId,
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    FIREBASE_PUBLIC_FALLBACKS.storageBucket,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    FIREBASE_PUBLIC_FALLBACKS.messagingSenderId,
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID || FIREBASE_PUBLIC_FALLBACKS.appId,
  measurementId:
    process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ||
    FIREBASE_PUBLIC_FALLBACKS.measurementId,
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
    throw new Error("Firebase client configuration is missing.");
  }

  return !getApps().length ? initializeApp(firebaseConfig) : getApp();
};

export const getClientAuth = (): Auth => {
  return getAuth(getFirebaseApp());
};

export const getClientDb = (): Firestore => {
  return getFirestore(getFirebaseApp());
};

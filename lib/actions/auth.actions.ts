"use server";
import { SignInParams, SignUpParams, User } from "@/types";
import { FirebaseError } from "firebase/app";
import { auth, db } from "@/services/firebase/admin";
import { cookies } from "next/headers";
import {
  ensureSeedPremiumAccess,
  isSeedPremiumEmail,
} from "@/lib/services/premium-access.service";

const SESSION_COOKIE_EXPIRES_IN = 60 * 60 * 24 * 7 * 1000; // 7 days

const ensureUserProfile = async (params: {
  uid: string;
  email?: string | null;
  name?: string | null;
}) => {
  const { uid, email, name } = params;
  const userRef = db.collection("users").doc(uid);
  
  // 1. Get the current snapshot
  const userSnap = await userRef.get();

  if (userSnap.exists) {
    const existingData = (userSnap.data() || {}) as Record<string, unknown>;
    const existingEmail =
      (typeof existingData.email === "string" && existingData.email.trim()) ||
      email?.trim() ||
      "";

    // 2. Only write/update if premium status needs syncing (Seed emails)
    if (isSeedPremiumEmail(existingEmail) && existingData.isPremium !== true) {
      await ensureSeedPremiumAccess({ userId: uid, email: existingEmail });
      
      // Return updated data
      return {
        ...existingData,
        email: existingEmail,
        isPremium: true,
        premiumSource: existingData.premiumSource || "seed-email",
        id: userSnap.id,
      } as User;
    }

    // 3. Just return existing data, no write performed
    return {
      ...existingData,
      id: userSnap.id,
    } as User;
  }

  // 4. User doesn't exist, create them (1 Write)
  const fallbackName = name?.trim() || email?.split("@")[0] || "User";
  const fallbackEmail = email?.trim() || "";
  const seedPremium = isSeedPremiumEmail(fallbackEmail);

  const newUser = {
    name: fallbackName,
    email: fallbackEmail,
    createdAt: new Date().toISOString(),
    source: "auto-created-on-signin",
    ...(seedPremium
      ? {
          isPremium: true,
          premiumSource: "seed-email",
          premiumGrantedAt: new Date().toISOString(),
        }
      : {}),
  };

  await userRef.set(newUser, { merge: true });

  return {
    ...newUser,
    id: uid,
  } as User;
};

export const signUp = async (params: SignUpParams) => {
  const { uid, email, name, userType } = params;
  try {
    const user = await db.collection("users").doc(uid).get();

    if (user.exists) {
      return { success: false, message: "User already exists" };
    }

    await db.collection("users").doc(uid).set({
      name,
      email,
      userType: userType || "candidate",
      createdAt: new Date().toISOString(),
    });

    return { success: true, message: "User created successfully" };
  } catch (error) {
    console.error(`Error signing up user ${uid}: ${(error as Error)?.message}`);

    if (error instanceof FirebaseError) {
      if (error.code === "auth/email-already-in-use") {
        return { success: false, message: "Email already in use" };
      }
    }

    return { success: false, message: "Something went wrong" };
  }
};

export const signIn = async (params: SignInParams) => {
  const { email, idToken } = params;
  try {
    const userRecord = await auth.getUserByEmail(email);

    if (!userRecord) {
      return { success: false, message: "User not found" };
    }

    const cookieResult = await setSessionCookie(idToken);

    if (!cookieResult.success) {
      return { success: false, message: cookieResult.message };
    }

    await ensureUserProfile({
      uid: userRecord.uid,
      email: userRecord.email,
      name: userRecord.displayName,
    });

    return { success: true, message: "User signed in successfully" };
  } catch (error) {
    console.error(
      `Error signing up user ${email}: ${(error as Error)?.message}`
    );

    if (error instanceof FirebaseError) {
      if (error.code === "auth/invalid-credential") {
        return { success: false, message: "Invalid credentials" };
      }
    }

    // Return the actual error message to help debugging
    return { success: false, message: (error as Error)?.message || "Something went wrong" };
  }
};

export const setSessionCookie = async (idToken: string) => {
  try {
    const cookieStore = await cookies();

    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_COOKIE_EXPIRES_IN,
    });

    cookieStore.set("session", sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_COOKIE_EXPIRES_IN,
      sameSite: "lax",
      path: "/",
    });

    return { success: true, message: "Session cookie set successfully" };
  } catch (error) {
    console.error(`Error setting session cookie: ${(error as Error)?.message}`);
    // Include specific error in message
    return { success: false, message: `Error setting session cookie: ${(error as Error)?.message}` };
  }
};

export const getCurrentUser = async () => {
  const cookieStore = await cookies();
  const session = cookieStore.get("session");

  if (!session) {
    return null;
  }

  try {
    const token = await auth.verifySessionCookie(session.value, true);
    
    if (!token?.uid) {
       return null;
    }

    // Optimization: Return user data from token if possible to avoid Firestore READ on every page load
    // If you need full Firestore data (like isPremium), you should call a specific function for that.
    return {
      id: token.uid,
      uid: token.uid,
      email: token.email || "",
      name: token.name || "User",
      // These will be missing if only using token, which is fine for basic UI
    } as User;

  } catch (error) {
    console.error("Error verifying session cookie:", error);
    return null;
  }
};

export async function isAuthenticated() {
  try {
    const user = await getCurrentUser();

    return !!user;
  } catch (error) {
    console.error(
      `Error checking authentication: ${(error as Error)?.message}`
    );
    return false;
  }
}

export async function logout() {
  try {
    const cookieStore = await cookies();
    
    // Clear the session cookie
    cookieStore.delete('session');
    
    // Set expired cookie as backup in case deletion doesn't work
    cookieStore.set('session', '', {
      expires: new Date(0),
      path: '/'
    });
    
    return { success: true, message: "Logged out successfully" };
  } catch (error) {
    console.error("Error during logout:", error);
    // Still return success to ensure smooth user experience
    return { success: true, message: "Logged out successfully" };
  }
}
export const verifyCaptcha = async (token: string) => {
  try {
    const res = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`,
      { method: "POST" }
    );
    const data = await res.json();
    return { success: data.success, score: data.score };
  } catch (error) {
    console.error("Captcha verification error:", error);
    return { success: false };
  }
};

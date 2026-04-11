"use server";
import { SignInParams, SignUpParams, User } from "@/types";
import { FirebaseError } from "firebase/app";
import { auth, db } from "@/services/firebase/admin";
import { cookies } from "next/headers";

const SESSION_COOKIE_EXPIRES_IN = 60 * 60 * 24 * 7 * 1000; // 7 days

export const signUp = async (params: SignUpParams) => {
  const { uid, email, name } = params;
  try {
    const user = await db.collection("users").doc(uid).get();

    if (user.exists) {
      return { success: false, message: "User already exists" };
    }

    await db.collection("users").doc(uid).set({
      name,
      email,
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
    // console.log("No session cookie found");
    return null;
  }

  try {
    const token = await auth.verifySessionCookie(session.value, true);
    
    if (!token?.uid) {
       console.log("Token verification failed or no UID");
       return null;
    }

    const user = await db.collection("users").doc(token.uid).get();

    if (!user.exists) {
      console.log("User doc not found for UID:", token.uid);
      return null;
    }

    return {
      ...user.data(),
      id: user.id,
    } as User;
  } catch (error) {
    // Log the actual error to help debugging
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

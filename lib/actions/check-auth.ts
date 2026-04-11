"use server";

import { isAuthenticated } from "@/lib/actions/auth.actions";

export async function checkAuthStatus() {
  try {
    const isAuth = await isAuthenticated();
    return { isAuthenticated: isAuth };
  } catch (error) {
    console.error("Error checking auth status:", error);
    return { isAuthenticated: false };
  }
}

import AuthForm from "@/components/AuthForm";
import React from "react";
import { isAuthenticated } from "@/lib/actions/auth.actions";
import { redirect } from "next/navigation";

// Force dynamic rendering for auth pages
export const dynamic = 'force-dynamic';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const isAuth = await isAuthenticated();
  if (isAuth) {
    const sp = await searchParams;
    const redirectUrl = Array.isArray(sp?.redirect) ? sp.redirect[0] : sp?.redirect;
    redirect(redirectUrl || "/");
  }

  return <AuthForm type="sign-in" />;
}

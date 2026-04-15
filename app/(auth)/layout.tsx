import { isAuthenticated } from "@/lib/actions/auth.actions";
import { redirect } from "next/navigation";
import { ReactNode } from "react";
import { Toaster } from "sonner";
import Navbar from "@/components/Navbar";
import { GridBackground } from "@/components/GridBackground";

export const dynamic = "force-dynamic";

async function AuthLayout({ children }: { children: ReactNode }) {
  const isAuth = await isAuthenticated();
  if (isAuth) {
    redirect("/");
  }
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar />
      <GridBackground>
        {children}
        <Toaster position="top-center" />
      </GridBackground>
    </div>
  );
}

export default AuthLayout;

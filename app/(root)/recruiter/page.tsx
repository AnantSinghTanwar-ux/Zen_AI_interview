import RecruiterDashboard from "@/components/recruiter/RecruiterDashboard";
import PageLayout from "@/components/PageLayout";
import { Suspense } from "react";
import { checkAuthStatus } from "@/lib/actions/check-auth";
import { redirect } from "next/navigation";

export const revalidate = 60;

export default async function RecruiterPage() {
  const authStatus = await checkAuthStatus();

  if (!authStatus.isAuthenticated) {
    redirect("/sign-in?clear_session=true&redirect=/recruiter");
  }

  if (!authStatus.isRecruiter) {
    redirect("/pricing");
  }

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>}>
          <RecruiterDashboard />
        </Suspense>
      </div>
    </PageLayout>
  );
}

import RecruiterDashboard from "@/components/recruiter/RecruiterDashboard";
import PageLayout from "@/components/PageLayout";
import { checkAuthStatus } from "@/lib/actions/check-auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

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
        <RecruiterDashboard />
      </div>
    </PageLayout>
  );
}

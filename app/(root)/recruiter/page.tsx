import RecruiterDashboard from "@/components/recruiter/RecruiterDashboard";
import PageLayout from "@/components/PageLayout";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RecruiterPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in?redirect=/recruiter");
  }

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <RecruiterDashboard />
      </div>
    </PageLayout>
  );
}

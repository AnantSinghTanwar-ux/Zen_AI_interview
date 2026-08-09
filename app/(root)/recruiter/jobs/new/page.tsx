import JobForm from "@/components/recruiter/JobForm";
import PageLayout from "@/components/PageLayout";
import { checkAuthStatus } from "@/lib/actions/check-auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NewJobPage() {
  const authStatus = await checkAuthStatus();

  if (!authStatus.isAuthenticated) {
    redirect("/sign-in?clear_session=true&redirect=/recruiter/jobs/new");
  }

  if (!authStatus.isRecruiter) {
    redirect("/pricing");
  }

  return (
    <PageLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="rounded-2xl border border-white/10 bg-card/60 backdrop-blur-sm p-8">
          <h1 className="text-2xl font-bold text-foreground mb-6">
            Create New Job Posting
          </h1>
          <JobForm />
        </div>
      </div>
    </PageLayout>
  );
}

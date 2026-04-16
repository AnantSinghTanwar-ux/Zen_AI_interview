import JobForm from "@/components/recruiter/JobForm";
import PageLayout from "@/components/PageLayout";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NewJobPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in?redirect=/recruiter/jobs/new");
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

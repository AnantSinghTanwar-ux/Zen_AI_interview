import PageLayout from "@/components/PageLayout";
import { db } from "@/services/firebase/admin";
import JobDetailClient from "@/components/recruiter/JobDetailClient";
import { checkAuthStatus } from "@/lib/actions/check-auth";
import { redirect } from "next/navigation";
import JobApplicantManager from "@/components/recruiter/JobApplicantManager";

export const revalidate = 30;

export default async function RecruiterJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  
  const authStatus = await checkAuthStatus();
  if (!authStatus.isAuthenticated) {
    redirect(`/sign-in?redirect=/recruiter/jobs/${jobId}`);
  }

  if (!authStatus.isRecruiter) {
    redirect("/pricing");
  }

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <JobApplicantManager jobId={jobId} />
      </div>
    </PageLayout>
  );
}

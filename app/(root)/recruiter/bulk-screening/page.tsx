import PageLayout from "@/components/PageLayout";
import { checkAuthStatus } from "@/lib/actions/check-auth";
import { redirect } from "next/navigation";
import BulkScreeningWrapper from "./BulkScreeningWrapper";

export const dynamic = "force-dynamic";

export default async function BulkScreeningPage({
  searchParams,
}: {
  searchParams: Promise<{ jobId?: string }>;
}) {
  const authStatus = await checkAuthStatus();

  if (!authStatus.isAuthenticated) {
    redirect("/sign-in?clear_session=true&redirect=/recruiter/bulk-screening");
  }

  if (!authStatus.isRecruiter) {
    redirect("/pricing");
  }

  const { jobId } = await searchParams;

  return (
    <PageLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <BulkScreeningWrapper initialJobId={jobId} />
      </div>
    </PageLayout>
  );
}

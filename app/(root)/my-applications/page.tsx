import PageLayout from "@/components/PageLayout";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { redirect } from "next/navigation";
import CandidateDashboard from "@/components/candidate/CandidateDashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Applications | ZenAI",
  description: "Track your job applications, AI screening results, and interview schedule.",
};

export default async function MyApplicationsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in?redirect=/my-applications");
  }

  return (
    <PageLayout>
      <div className="min-h-screen bg-background text-foreground py-12 px-6 pt-28">
        <div className="max-w-6xl mx-auto">
          <CandidateDashboard />
        </div>
      </div>
    </PageLayout>
  );
}

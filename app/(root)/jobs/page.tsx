import PageLayout from "@/components/PageLayout";
import JobBoardClient from "@/components/candidate/JobBoardClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Job Board | ZenAI",
  description: "Browse and apply for open positions with AI-powered resume screening.",
};

export default function JobBoardPage() {
  return (
    <PageLayout>
      <div className="min-h-screen bg-background text-foreground py-12 px-6 pt-28">
        <div className="max-w-6xl mx-auto">
          <JobBoardClient />
        </div>
      </div>
    </PageLayout>
  );
}

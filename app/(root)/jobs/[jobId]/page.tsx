import PageLayout from "@/components/PageLayout";
import JobDetailClient from "@/components/candidate/JobDetailClient";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: any) {
  const params = await props.params;
  const jobId = params.jobId;
  return {
    title: `Job Details | ZenAI`,
    description: "View job details and apply with AI-powered resume screening.",
  };
}

export default async function JobDetailPage(props: any) {
  const params = await props.params;
  const jobId = params.jobId;

  return (
    <PageLayout>
      <div className="min-h-screen bg-background text-foreground py-12 px-6 pt-28">
        <div className="max-w-4xl mx-auto">
          <JobDetailClient jobId={jobId} />
        </div>
      </div>
    </PageLayout>
  );
}

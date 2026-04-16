import PracticeSessionBuilder from "@/components/PracticeSessionBuilder";
import PageLayout from "@/components/PageLayout";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { redirect } from "next/navigation";

const safeDecodeJobContext = (value: string | undefined) => {
  if (!value) {
    return "";
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    return JSON.stringify(parsed);
  } catch (error) {
    console.warn("Invalid job context in interview query", error);
    return "";
  }
};

async function InterviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  const query = await searchParams;

  if (!user) {
    const rawJobParam = Array.isArray(query.job) ? query.job[0] : query.job;
    const redirectUrl = rawJobParam 
      ? `/sign-in?redirect=${encodeURIComponent(`/interview?job=${rawJobParam}&source=extension`)}`
      : `/sign-in`;
    redirect(redirectUrl);
  }

  const rawJobParam = Array.isArray(query.job) ? query.job[0] : query.job;
  const jobContextJson = safeDecodeJobContext(rawJobParam);

  return (
    <>
      <PageLayout showFooter={false}>
        <div className="w-full">
          <PracticeSessionBuilder
            userName={user.name}
            userId={user.id}
            jobContextJson={jobContextJson}
          />
        </div>
      </PageLayout>
    </>
  );
}

export default InterviewPage;

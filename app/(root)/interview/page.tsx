import PracticeSessionBuilder from "@/components/PracticeSessionBuilder";
import PageLayout from "@/components/PageLayout";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { redirect } from "next/navigation";
import { getPracticeCompanyProfile, PracticeCompanyKey } from "@/constants/practice";
import { generateInterviewContext, generateVapiPromptContext } from "@/constants/datasets/context-generator";
import { getCompanyByKey } from "@/constants/datasets/index";

const safeDecodeJobContext = (value: string | undefined) => {
  if (!value) {
    return "";
  }

  const candidates: string[] = [value];

  try {
    candidates.push(decodeURIComponent(value));
  } catch {
    // Ignore decode errors; raw value may already be decoded.
  }

  try {
    candidates.push(decodeURIComponent(value.replace(/\+/g, "%20")));
  } catch {
    // Ignore decode errors; keep trying other candidates.
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      return JSON.stringify(parsed);
    } catch {
      // Try next candidate representation.
    }
  }

  console.warn("Invalid job context in interview query");
  return "";
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

  // Build practiceContextJson from Job Prep query params if present
  const companyKey = (Array.isArray(query.company) ? query.company[0] : query.company) as PracticeCompanyKey | undefined;
  const roleParam = Array.isArray(query.role) ? query.role[0] : query.role;
  const levelParam = Array.isArray(query.level) ? query.level[0] : query.level;
  const focusParam = Array.isArray(query.focus) ? query.focus[0] : query.focus;
  const sourceParam = Array.isArray(query.source) ? query.source[0] : query.source;

  let jobPrepContextJson: string | undefined;
  if (sourceParam === "job-prep" && companyKey) {
    const companyProfile = getCompanyByKey(companyKey);
    if (companyProfile) {
      const contextConfig = generateInterviewContext(
        companyProfile,
        roleParam || "Software Engineer",
        levelParam || "SDE-1",
        "fullstack" // Default domain, could be parsed from focus
      );
      
      jobPrepContextJson = JSON.stringify({
        mode: "job-prep",
        ...contextConfig,
        vapiContext: generateVapiPromptContext(contextConfig),
        selectedFocusAreas: focusParam ? focusParam.split(",") : ["Core CS Fundamentals"],
        notes: "This session is from Job Prep. Tailor interview questions to the company profile, target role, and selected focus. Keep follow-ups aligned with the experience level.",
      });
    }
  }

  return (
    <>
      <PageLayout showFooter={false}>
        <div className="w-full">
          <PracticeSessionBuilder
            userName={user.name}
            userId={user.id}
            jobContextJson={jobContextJson}
            initialPracticeContextJson={jobPrepContextJson}
            autoStart={sourceParam === "job-prep"}
          />
        </div>
      </PageLayout>
    </>
  );
}

export default InterviewPage;

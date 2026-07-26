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

  const scheduleIdParam = Array.isArray(query.scheduleId) ? query.scheduleId[0] : query.scheduleId;
  let jobPrepContextJson: string | undefined;

  if (scheduleIdParam) {
    // We import dynamically or inline fetch if needed, but since this is a server component, we can use services directly.
    const { schedulingService } = await import("@/services/recruiter/scheduling.service");
    const { jobService } = await import("@/services/recruiter/job.service");
    
    const schedule = await schedulingService.getSchedule(scheduleIdParam);
    if (schedule) {
      const job = await jobService.getJob(schedule.jobId);
      if (job) {
        // Find best matching company profile or use default
        const allCompanies = ["google", "microsoft", "amazon", "apple", "meta", "stripe"];
        const matchedKey = allCompanies.find(k => job.companyName.toLowerCase().includes(k)) || "microsoft";
        const companyProfile = getCompanyByKey(matchedKey as PracticeCompanyKey);
        
        if (companyProfile) {
           const contextConfig = generateInterviewContext(
             companyProfile,
             job.title,
             job.experienceLevel,
             "fullstack"
           );

           // Tailor focus areas and instructions based on job type
           let selectedFocusAreas = ["Behavioral", "Technical"];
           let typeInstruction = "This is a comprehensive interview covering both technical skills and behavioral fit.";
           
           if (job.type === "technical") {
             selectedFocusAreas = ["Core CS Fundamentals", "System Design", "Problem Solving"];
             typeInstruction = "This is a STRICTLY TECHNICAL interview. Focus entirely on technical questions, coding concepts, system design, and the required skills. Do NOT ask behavioral questions.";
           } else if (job.type === "behavioral") {
             selectedFocusAreas = ["Behavioral", "Communication", "Leadership"];
             typeInstruction = "This is a STRICTLY BEHAVIORAL interview. Focus entirely on past experiences, conflict resolution, leadership, and cultural fit using the STAR method. Do NOT ask technical coding questions.";
           }

           jobPrepContextJson = JSON.stringify({
             mode: "real-interview",
             ...contextConfig,
             company: job.companyName,
             vapiContext: `You are an AI interviewer conducting a REAL interview for the position of ${job.title} at ${job.companyName}. The candidate's name is ${schedule.candidateName}.\n\n${typeInstruction}\n\n${generateVapiPromptContext(contextConfig)}\n\nJob Description: ${job.description}\nRequired Skills: ${job.requiredSkills.join(", ")}\nRecruiter Notes: ${schedule.notes || "None"}`,
             selectedFocusAreas,
             notes: `This is a REAL scheduled interview. Conduct it professionally and rigorously according to the job description and interview type (${job.type}).`,
           });
        }
      }
    }
  } else if (sourceParam === "job-prep" && companyKey) {
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

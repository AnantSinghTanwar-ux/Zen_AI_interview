import { redirect } from "next/navigation";
import { db } from "@/services/firebase/admin";
import { COLLECTION_BULK_CANDIDATES } from "@/constants/screening.config";
import CandidateAgent from "@/components/candidate/CandidateAgent";
import PageLayout from "@/components/PageLayout";

interface CandidateContext {
  candidateId: string;
  name: string;
  resumeText: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  requiredSkills: string[];
}

export default async function CandidateInterviewJoinPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const token = Array.isArray(query.token) ? query.token[0] : query.token;

  if (!token) {
    return (
      <PageLayout className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-red-500">Invalid Link</h1>
          <p className="text-muted-foreground">The interview link you clicked is missing a token.</p>
        </div>
      </PageLayout>
    );
  }

  // Find candidate by token
  const candidatesSnap = await db
    .collection(COLLECTION_BULK_CANDIDATES)
    .where("interviewToken", "==", token)
    .limit(1)
    .get();

  if (candidatesSnap.empty) {
    return (
      <PageLayout className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-red-500">Interview Not Found</h1>
          <p className="text-muted-foreground">
            This interview link is invalid or has expired. Please contact your recruiter.
          </p>
        </div>
      </PageLayout>
    );
  }

  const candidateDoc = candidatesSnap.docs[0];
  const candidateData = candidateDoc.data();

  // If already interviewed
  if (candidateData.interviewScore !== undefined && candidateData.interviewScore !== null) {
    return (
      <PageLayout className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-primary">Interview Completed</h1>
          <p className="text-muted-foreground">
            You have already completed this AI interview. The recruiter has been notified of your results!
          </p>
        </div>
      </PageLayout>
    );
  }

  // Fetch Job Details
  const jobDoc = await db.collection("jobs").doc(candidateData.jobId).get();
  if (!jobDoc.exists) {
    return (
      <PageLayout className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-red-500">Job Not Found</h1>
          <p className="text-muted-foreground">The job associated with this interview could not be found.</p>
        </div>
      </PageLayout>
    );
  }
  const jobData = jobDoc.data()!;

  const context: CandidateContext = {
    candidateId: candidateDoc.id,
    name: candidateData.name || "Candidate",
    resumeText: candidateData.resumeText || "",
    jobId: jobDoc.id,
    jobTitle: jobData.title || "the position",
    companyName: jobData.companyName || "our company",
    jobDescription: jobData.description || "",
    requiredSkills: jobData.skills || [],
  };

  return (
    <PageLayout>
      <div className="max-w-5xl mx-auto py-8">
        <CandidateAgent context={context} />
      </div>
    </PageLayout>
  );
}

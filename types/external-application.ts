// Hardcoded recruiter account for hackathon demo
export const RECRUITER_EMAIL = "anantsa@gmail.com";

export type SourcePlatform = "linkedin" | "jobyt" | "naukri" | "indeed" | "glassdoor" | "other";
export type RoleCategory = "backend" | "frontend" | "fullstack" | "devops" | "data" | "mobile" | "design" | "qa" | "management" | "other";
export type InterviewStatus = "pending" | "invited" | "in_progress" | "completed" | "expired";
export type ScoreStatus = "pending" | "processing" | "available" | "failed";
export type ApplicationStatus = "pending" | "invited" | "in_progress" | "completed" | "shortlisted" | "rejected";

export interface ExternalApplication {
  id: string;
  candidateName: string;
  candidateEmail: string;
  resumeUrl?: string;

  // Source metadata
  sourcePlatform: SourcePlatform;
  companyName: string;
  roleTitle: string;
  roleCategory: RoleCategory;
  externalJobId?: string;
  externalJobUrl?: string;

  // Interview tracking
  interviewId?: string;
  interviewStatus: InterviewStatus;
  inviteLink?: string;

  // Scoring
  scoreStatus: ScoreStatus;
  scoreId?: string;

  // Status
  status: ApplicationStatus;

  // Ownership (always recruiter email for demo)
  recruiterOwnerId: string;

  createdAt: string;
  updatedAt: string;
}

export interface ApplicationScore {
  id: string;
  applicationId: string;
  interviewId: string;

  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  problemSolvingScore: number;

  recommendation: "strong_hire" | "hire" | "maybe" | "no_hire";
  strengths: string[];
  weaknesses: string[];
  feedbackSummary: string;

  generatedBy: "gemini" | "openrouter" | "local" | "cached";
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  applicationId: string;
  candidateName: string;
  candidateEmail: string;
  roleTitle: string;
  companyName: string;
  sourcePlatform: SourcePlatform;
  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  problemSolvingScore: number;
  recommendation: string;
}

export interface RecruiterDashboardStats {
  totalApplications: number;
  completedInterviews: number;
  pendingInterviews: number;
  averageScore: number;
  byRole: Record<string, number>;
  byCompany: Record<string, number>;
  bySource: Record<string, number>;
  topCandidates: LeaderboardEntry[];
}

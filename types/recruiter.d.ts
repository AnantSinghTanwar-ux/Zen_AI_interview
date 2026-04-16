export interface RecruiterProfile {
  id?: string;
  userId: string;
  companyName: string;
  industry: string;
  role: 'recruiter' | 'hiring_manager' | 'admin';
  jobsCreated: number;
  applicantsScreened: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecruitmentJob {
  id: string;
  recruiterId: string;
  companyName: string;
  title: string;
  description: string;
  requiredSkills: string[];
  experienceLevel: 'junior' | 'mid' | 'senior' | 'lead';
  type: 'technical' | 'behavioral' | 'mixed';
  salaryRange?: {
    min: number;
    max: number;
  };
  applicantIds: string[];
  status: 'draft' | 'active' | 'closed';
  createdAt: string;
}

export interface Applicant {
  id: string;
  jobId: string;
  name: string;
  email: string;
  resumeUrl?: string;
  status: 'pending' | 'invited' | 'in_progress' | 'completed' | 'rejected' | 'shortlisted';
  interviewId?: string;
  screeningResultId?: string;
  appliedAt: string;
  invitedAt?: string;
  completedAt?: string;
  notes?: string;
}

export interface Screening {
  id: string;
  jobId: string;
  applicantId: string;
  interviewId: string;
  status: 'pending' | 'sent' | 'accepted' | 'completed' | 'failed';
  inviteLink: string;
  createdAt: string;
  sentAt?: string;
  completedAt?: string;
}

export interface ScreeningResult {
  id: string;
  applicantId: string;
  jobId: string;
  interviewId: string;
  overallScore: number;
  technicalScore: number;
  communicationScore: number;
  problemSolvingScore: number;
  strengths: string[];
  weaknesses: string[];
  recommendation: 'shortlist' | 'maybe' | 'reject';
  transcript?: string;
  feedbackSummary: string;
  createdAt: string;
}

export interface RecruiterDashboardStats {
  totalApplicants: number;
  byStatus: Record<string, number>;
  averageScore: number;
  topCandidates: Applicant[];
}

// ─── Recruiter Profile ──────────────────────────────────────────────────────

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

// ─── Recruitment Job ────────────────────────────────────────────────────────

export interface RecruitmentJob {
  id: string;
  recruiterId: string;
  companyName: string;
  title: string;
  description: string;
  requiredSkills: string[];
  experienceLevel: 'junior' | 'mid' | 'senior' | 'lead';
  type: 'technical' | 'behavioral' | 'mixed';
  location?: string;
  salaryRange?: {
    min: number;
    max: number;
  };
  deadline?: string;
  applicantIds: string[];
  status: 'draft' | 'active' | 'closed';
  createdAt: string;
}

// ─── Applicant ──────────────────────────────────────────────────────────────

export type ApplicantStatus =
  | 'pending'
  | 'screening'
  | 'screened'
  | 'invited'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'shortlisted';

export interface Applicant {
  id: string;
  jobId: string;
  name: string;
  email: string;
  resumeUrl?: string;
  resumeText?: string;
  coverLetter?: string;
  candidateUserId?: string;
  status: ApplicantStatus;
  interviewId?: string;
  screeningResultId?: string;
  appliedAt: string;
  invitedAt?: string;
  completedAt?: string;
  notes?: string;
}

// ─── AI Resume Screening ────────────────────────────────────────────────────

export interface ResumeScreeningResult {
  id: string;
  applicantId: string;
  jobId: string;
  overallScore: number;
  skillMatchPercent: number;
  matchedSkills: string[];
  missingSkills: string[];
  strengths: string[];
  weaknesses: string[];
  recommendation: 'shortlist' | 'review' | 'reject';
  summary: string;
  createdAt: string;
}

// ─── Interview Screening (legacy — kept for backward compat) ────────────────

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

// ─── Interview Scheduling ───────────────────────────────────────────────────

export type ScheduleStatus = 'scheduled' | 'completed' | 'cancelled';

export interface ScheduledInterview {
  id: string;
  jobId: string;
  applicantId: string;
  recruiterId: string;
  candidateUserId?: string;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  scheduledAt: string;
  duration: number; // minutes
  meetingLink?: string;
  interviewType?: 'ai' | 'external';
  notes?: string;
  status: ScheduleStatus;
  interviewId?: string; // link to existing AI interview
  createdAt: string;
  updatedAt: string;
}

// ─── Notifications ──────────────────────────────────────────────────────────

export type NotificationType =
  | 'application_received'
  | 'screening_completed'
  | 'shortlisted'
  | 'rejected'
  | 'interview_scheduled'
  | 'interview_cancelled'
  | 'status_changed';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  metadata?: Record<string, string>;
  createdAt: string;
}

// ─── Dashboard Stats ────────────────────────────────────────────────────────

export interface RecruiterDashboardStats {
  totalApplicants: number;
  byStatus: Record<string, number>;
  averageScore: number;
  topCandidates: Applicant[];
}

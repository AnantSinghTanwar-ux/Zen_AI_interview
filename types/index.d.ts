interface Feedback {
  id: string;
  interviewId: string;
  totalScore: number;
  categoryScores: Array<{
    name: string;
    score: number;
    comment: string;
  }>;
  strengths: string[];
  areasForImprovement: string[];
  finalAssessment: string;
  createdAt: string;
}

export interface Interview {
  id: string;
  role: string;
  level: string;
  questions: string[];
  techstack: string[];
  createdAt: string;
  userId: string;
  type: string;
  finalized: boolean;
  jobId?: string; // Reference back to recruitment job if created by recruiter
}

interface CreateFeedbackParams {
  interviewId: string;
  userId: string;
  transcript: { role: string; content: string }[];
  feedbackId?: string;
}

interface User {
  name: string;
  email: string;
  id: string;
  userType?: 'candidate' | 'recruiter';
  recruiterId?: string;
  isPremium?: boolean;
  premiumSource?: string;
}

interface InterviewCardProps {
  interviewId?: string;
  userId?: string;
  role: string;
  type: string;
  techstack: string[];
  createdAt?: string;
}

interface AgentProps {
  userName: string;
  userId?: string;
  interviewId?: string;
  feedbackId?: string;
  type: "generate" | "interview";
  questions?: string[];
  jobContextJson?: string;
  practiceContextJson?: string;
}

interface RouteParams {
  params: Promise<Record<string, string>>;
  searchParams: Promise<Record<string, string>>;
}

interface GetFeedbackByInterviewIdParams {
  interviewId: string;
  userId: string;
}

interface GetLatestInterviewsParams {
  userId: string;
  limit?: number;
}

interface SignInParams {
  email: string;
  idToken: string;
}

interface SignUpParams {
  uid: string;
  name: string;
  email: string;
  password: string;
  userType?: 'candidate' | 'recruiter';
}

type FormType = "sign-in" | "sign-up";

interface InterviewFormProps {
  interviewId: string;
  role: string;
  level: string;
  type: string;
  techstack: string[];
  amount: number;
}

interface TechIconProps {
  techStack: string[];
}

// Interview Evaluation Types
export interface InterviewEvaluation {
  overallRating: number; // 1-10
  aspects: {
    technicalKnowledge: AspectRating;
    problemSolving: AspectRating;
    communication: AspectRating;
    criticalThinking: AspectRating;
    codeQuality: AspectRating;
    systemDesign: AspectRating;
    behavioralFit: AspectRating;
  };
  strengths: string[];
  areasForImprovement: string[];
  recommendation: 'Strong Hire' | 'Hire' | 'No Hire' | 'Strong No Hire';
  detailedFeedback: string;
  confidenceLevel: number; // 1-10
}

export interface AspectRating {
  score: number; // 1-10
  feedback: string;
  evidence: string[];
}

export interface EvaluationResponse {
  success: boolean;
  evaluation: InterviewEvaluation;
  callId: string;
  evaluatedAt: string;
}

interface CallLog {
  id: string;
  userId: string;
  vapiCallId: string;
  assistantId?: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  duration?: number;
  cost?: number;
  costBreakdown?: {
    llm?: number;
    stt?: number;
    tts?: number;
    vapi?: number;
    total?: number;
  };
  messageCount?: number;
  hasRecording?: boolean;
  hasTranscript?: boolean;
  summary?: string;
  analysis?: any;
  createdAt: any;
  updatedAt: any;
}

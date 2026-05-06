// ─── Shared Dataset Types ──────────────────────────────────────────

export type Difficulty = "Easy" | "Medium" | "Hard";
export type InterviewRound = "OA" | "Phone" | "Onsite" | "System Design" | "Behavioral" | "HR" | "Manager" | "Bar Raiser";
export type Domain = "frontend" | "backend" | "fullstack" | "ml-ai" | "cloud-devops" | "data" | "mobile" | "security" | "embedded";
export type InterviewerPersonality = "friendly" | "strict" | "fast-paced" | "detail-oriented" | "startup-casual" | "academic";

export interface CompanyProfile {
  key: string;
  name: string;
  tier: "FAANG" | "Tier1" | "Tier2" | "Startup" | "ServiceBased" | "Finance" | "Product";
  hq: string;
  interviewStyle: string;
  interviewerPersonality: InterviewerPersonality;
  totalRounds: number;
  roundStructure: string[];
  behavioralFocus: string[];
  technicalFocus: string[];
  dsaPatterns: string[];
  codingDifficulty: Difficulty;
  techStack: string[];
  oaPattern: string;
  hrQuestions: string[];
  mostRepeatedCategories: string[];
  commonTopics: string[];
  followUpStyle: string;
}

export interface DSAQuestion {
  id: string;
  title: string;
  difficulty: Difficulty;
  topic: string;
  companies: string[];
  prompt: string;
  hints: string[];
  optimalTimeComplexity: string;
  optimalSpaceComplexity: string;
  followUpStyle?: string;
}

export interface BehavioralQuestion {
  id: string;
  category: string;
  question: string;
  followUps: string[];
  whatInterviewerLooksFor: string;
  companies: string[];
  seniority: string[];
}

export interface SystemDesignQuestion {
  id: string;
  category: string;
  title: string;
  prompt: string;
  whatInterviewerLooksFor: string;
  companies: string[];
  seniority: string[];
  topics: string[];
}

export interface DomainTopic {
  topic: string;
  subtopics: string[];
  difficulty: Difficulty;
  commonQuestions: string[];
  companies: string[];
}

export interface InterviewContextConfig {
  company: string;
  role: string;
  experienceLevel: string;
  domain: Domain;
  likelyFocus: string[];
  likelyDSAEmphasis: string[];
  likelyBehavioralExpectations: string[];
  interviewerPersonality: InterviewerPersonality;
  followUpStyle: string;
  roundStructure: string[];
}

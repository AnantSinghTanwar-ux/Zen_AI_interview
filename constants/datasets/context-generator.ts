import { CompanyProfile, InterviewContextConfig, Domain, InterviewerPersonality } from "./types";

/**
 * Generates a dynamic interview context configuration based on user selections.
 * This is used by Vapi to seed the AI interviewer with realistic, company-specific context.
 */
export function generateInterviewContext(
  company: CompanyProfile,
  role: string,
  experienceLevel: string,
  domain: Domain = "fullstack"
): InterviewContextConfig {
  // Map experience level to likely focus areas
  const focusByLevel: Record<string, string[]> = {
    "Intern": ["DSA basics", "OOP fundamentals", "Communication", "Learning ability"],
    "SDE-1 / New Grad": ["Core DSA", "Clean code", "Problem solving", "Basic system awareness"],
    "SDE-1 / Early Career": ["Core DSA", "Clean code", "Problem solving", "Basic system awareness"],
    "SDE-2 / Mid Level": ["Advanced DSA", "Low-level design", "System design basics", "Ownership stories"],
    "Senior / Staff": ["System design depth", "Architecture trade-offs", "Leadership", "Cross-team impact"],
    "Staff / Principal": ["System design depth", "Architecture trade-offs", "Technical strategy", "Org-wide impact"],
    "Engineering Manager": ["System design", "People management", "Technical strategy", "Delivery track record"],
  };

  // DSA emphasis by experience
  const dsaByLevel: Record<string, string[]> = {
    "Intern": ["arrays", "strings", "sorting", "searching", "hashing"],
    "SDE-1 / New Grad": company.dsaPatterns.slice(0, 5),
    "SDE-1 / Early Career": company.dsaPatterns.slice(0, 5),
    "SDE-2 / Mid Level": company.dsaPatterns,
    "Senior / Staff": company.dsaPatterns.slice(0, 3).concat(["system-design"]),
    "Staff / Principal": ["system-design", "architecture"],
    "Engineering Manager": ["system-design", "architecture"],
  };

  // Domain-specific topics
  const domainTopics: Record<Domain, string[]> = {
    "frontend": ["React", "TypeScript", "Next.js", "State management", "Performance", "Accessibility", "CSS architecture"],
    "backend": ["Node.js", "Databases", "API design", "Caching", "Message queues", "Authentication", "Microservices"],
    "fullstack": ["Full-stack architecture", "API design", "Database design", "Frontend frameworks", "DevOps basics"],
    "ml-ai": ["ML fundamentals", "Transformers", "Embeddings", "RAG", "Model optimization", "Data pipelines"],
    "cloud-devops": ["AWS/GCP/Azure", "Docker", "Kubernetes", "CI/CD", "Infrastructure as Code", "Monitoring"],
    "data": ["SQL", "Data modeling", "ETL pipelines", "Data warehousing", "Analytics", "Visualization"],
    "mobile": ["iOS/Android", "React Native", "Flutter", "Mobile architecture", "Performance optimization"],
    "security": ["Authentication", "Encryption", "OWASP", "Network security", "Compliance"],
    "embedded": ["C/C++", "RTOS", "Hardware interfaces", "Memory management", "Power optimization"],
  };

  // Behavioral expectations by company tier
  const behavioralExpectations = [
    ...company.behavioralFocus,
    ...(company.tier === "FAANG" ? ["Technical communication", "Structured problem-solving approach"] : []),
    ...(company.tier === "Startup" ? ["Scrappiness", "Moving fast", "Wearing multiple hats"] : []),
    ...(company.tier === "ServiceBased" ? ["Adaptability", "Communication", "Willingness to learn"] : []),
    ...(company.tier === "Finance" ? ["Attention to detail", "Risk awareness", "Compliance mindset"] : []),
  ];

  const level = experienceLevel || "SDE-1 / New Grad";

  return {
    company: company.name,
    role,
    experienceLevel: level,
    domain,
    likelyFocus: [
      ...(focusByLevel[level] || focusByLevel["SDE-1 / New Grad"]),
      ...(domainTopics[domain] || []).slice(0, 3),
    ],
    likelyDSAEmphasis: dsaByLevel[level] || company.dsaPatterns,
    likelyBehavioralExpectations: behavioralExpectations.slice(0, 6),
    interviewerPersonality: company.interviewerPersonality,
    followUpStyle: company.followUpStyle,
    roundStructure: company.roundStructure,
  };
}

/**
 * Generate a Vapi-compatible prompt context string for the interview.
 */
export function generateVapiPromptContext(config: InterviewContextConfig): string {
  return `
INTERVIEW_CONTEXT:
Company: ${config.company}
Role: ${config.role}
Experience Level: ${config.experienceLevel}
Domain: ${config.domain}
Interviewer Style: ${config.interviewerPersonality}

FOCUS_AREAS: ${config.likelyFocus.join(", ")}
DSA_EMPHASIS: ${config.likelyDSAEmphasis.join(", ")}
BEHAVIORAL_EXPECTATIONS: ${config.likelyBehavioralExpectations.join(", ")}
FOLLOW_UP_STYLE: ${config.followUpStyle}
ROUND_STRUCTURE: ${config.roundStructure.join(" → ")}
`.trim();
}

import { BehavioralQuestion } from "./types";

export const BEHAVIORAL_QUESTIONS: BehavioralQuestion[] = [
  // ─── Teamwork ──────────────────────
  { id: "bh-team-1", category: "Teamwork", question: "Tell me about a time you worked with a difficult team member. How did you handle it?", followUps: ["What would you do differently?", "How did the team dynamic change after?"], whatInterviewerLooksFor: "Empathy, conflict resolution, maturity, specific outcome", companies: ["amazon", "google", "microsoft", "meta"], seniority: ["all"] },
  { id: "bh-team-2", category: "Teamwork", question: "Describe a situation where you had to collaborate across teams to deliver a project.", followUps: ["What was the biggest challenge?", "How did you align priorities?"], whatInterviewerLooksFor: "Cross-functional communication, stakeholder management", companies: ["google", "microsoft", "atlassian"], seniority: ["mid", "senior"] },
  { id: "bh-team-3", category: "Teamwork", question: "Give an example of when you helped a teammate who was struggling.", followUps: ["How did you identify they needed help?"], whatInterviewerLooksFor: "Empathy, mentoring instinct, team-first attitude", companies: ["microsoft", "atlassian", "salesforce"], seniority: ["all"] },
  { id: "bh-team-4", category: "Teamwork", question: "Tell me about a time the team disagreed on a technical approach. What happened?", followUps: ["How did you resolve the disagreement?", "What was the outcome?"], whatInterviewerLooksFor: "Constructive debate, data-driven decisions, compromise", companies: ["google", "amazon", "meta"], seniority: ["all"] },

  // ─── Conflict Resolution ───────────
  { id: "bh-conf-1", category: "Conflict Resolution", question: "Describe a time you had a disagreement with your manager. How did you resolve it?", followUps: ["Would you handle it the same way again?"], whatInterviewerLooksFor: "Professional maturity, respect for hierarchy while standing ground", companies: ["amazon", "microsoft", "netflix"], seniority: ["all"] },
  { id: "bh-conf-2", category: "Conflict Resolution", question: "Tell me about a time when two stakeholders wanted conflicting features.", followUps: ["How did you prioritize?", "What data did you use?"], whatInterviewerLooksFor: "Stakeholder management, prioritization, communication", companies: ["google", "meta", "airbnb"], seniority: ["mid", "senior"] },

  // ─── Leadership ────────────────────
  { id: "bh-lead-1", category: "Leadership", question: "Describe a time you took the lead on a project without being asked.", followUps: ["What motivated you?", "What was the outcome?"], whatInterviewerLooksFor: "Initiative, ownership, self-direction", companies: ["amazon", "netflix", "uber"], seniority: ["all"] },
  { id: "bh-lead-2", category: "Leadership", question: "Tell me about a time you mentored a junior engineer.", followUps: ["How did you measure their growth?", "What was challenging about mentoring?"], whatInterviewerLooksFor: "Teaching ability, patience, impact on others", companies: ["google", "microsoft", "meta"], seniority: ["mid", "senior"] },
  { id: "bh-lead-3", category: "Leadership", question: "Give an example of when you influenced a technical decision without authority.", followUps: ["How did you build consensus?"], whatInterviewerLooksFor: "Influence without authority, persuasion with data", companies: ["amazon", "netflix", "google"], seniority: ["senior"] },

  // ─── Deadlines & Pressure ──────────
  { id: "bh-dead-1", category: "Deadlines", question: "Tell me about a time you had to deliver under a very tight deadline.", followUps: ["What trade-offs did you make?", "What would you do differently?"], whatInterviewerLooksFor: "Prioritization, pragmatism, composure", companies: ["amazon", "uber", "meta", "swiggy"], seniority: ["all"] },
  { id: "bh-dead-2", category: "Deadlines", question: "Describe a situation where you had to cut scope to meet a deadline.", followUps: ["How did you decide what to cut?", "How did stakeholders react?"], whatInterviewerLooksFor: "Decision-making under pressure, stakeholder communication", companies: ["amazon", "flipkart", "razorpay"], seniority: ["all"] },
  { id: "bh-dead-3", category: "Pressure Handling", question: "Tell me about a time you handled a production incident under pressure.", followUps: ["What was the root cause?", "How did you prevent recurrence?"], whatInterviewerLooksFor: "Incident response, calm under pressure, post-mortem discipline", companies: ["google", "amazon", "netflix", "uber"], seniority: ["mid", "senior"] },

  // ─── Failures ──────────────────────
  { id: "bh-fail-1", category: "Failures", question: "Tell me about your biggest professional failure. What did you learn?", followUps: ["How did it change your approach?", "Would you make the same decision again?"], whatInterviewerLooksFor: "Self-awareness, growth mindset, accountability", companies: ["google", "amazon", "netflix", "meta"], seniority: ["all"] },
  { id: "bh-fail-2", category: "Failures", question: "Describe a project that didn't go as planned. What went wrong?", followUps: ["What was your role in the failure?", "How did the team recover?"], whatInterviewerLooksFor: "Accountability, analytical thinking, resilience", companies: ["microsoft", "adobe", "atlassian"], seniority: ["all"] },

  // ─── Ownership ─────────────────────
  { id: "bh-own-1", category: "Ownership", question: "Give an example of when you went above and beyond your job description.", followUps: ["What motivated you?", "What impact did it have?"], whatInterviewerLooksFor: "Ownership, proactivity, impact", companies: ["amazon", "netflix", "flipkart"], seniority: ["all"] },
  { id: "bh-own-2", category: "Ownership", question: "Tell me about a time you identified a problem nobody else noticed.", followUps: ["How did you address it?", "What was the impact?"], whatInterviewerLooksFor: "Attention to detail, initiative, systemic thinking", companies: ["google", "uber", "razorpay"], seniority: ["all"] },

  // ─── Communication ─────────────────
  { id: "bh-comm-1", category: "Communication", question: "Describe a time you had to explain a complex technical concept to a non-technical audience.", followUps: ["How did you ensure they understood?"], whatInterviewerLooksFor: "Simplification, empathy, audience awareness", companies: ["google", "microsoft", "salesforce"], seniority: ["all"] },
  { id: "bh-comm-2", category: "Communication", question: "Tell me about a time you received harsh feedback. How did you respond?", followUps: ["Did it change your behavior?"], whatInterviewerLooksFor: "Emotional intelligence, growth mindset, professionalism", companies: ["netflix", "meta", "amazon"], seniority: ["all"] },

  // ─── Project Explanation ───────────
  { id: "bh-proj-1", category: "Project Discussion", question: "Walk me through your most technically challenging project.", followUps: ["What architecture decisions did you make?", "What would you change in hindsight?"], whatInterviewerLooksFor: "Technical depth, decision rationale, self-reflection", companies: ["google", "amazon", "meta", "microsoft"], seniority: ["all"] },
  { id: "bh-proj-2", category: "Project Discussion", question: "Tell me about a project where you had to learn a new technology quickly.", followUps: ["How did you ramp up?", "What resources did you use?"], whatInterviewerLooksFor: "Learning agility, resourcefulness, adaptability", companies: ["uber", "flipkart", "swiggy", "meesho"], seniority: ["all"] },

  // ─── Difficult Teammate ────────────
  { id: "bh-diff-1", category: "Difficult Teammate", question: "Tell me about working with someone who wasn't pulling their weight.", followUps: ["Did you address it directly?", "What was the outcome?"], whatInterviewerLooksFor: "Directness balanced with empathy, team accountability", companies: ["amazon", "google", "atlassian"], seniority: ["all"] },

  // ─── Amazon LPs Specific ───────────
  { id: "bh-amz-1", category: "Customer Obsession", question: "Tell me about a time you went backwards from the customer to define a solution.", followUps: ["How did you validate the customer need?"], whatInterviewerLooksFor: "Customer-first thinking, working backwards methodology", companies: ["amazon"], seniority: ["all"] },
  { id: "bh-amz-2", category: "Dive Deep", question: "Give me an example of when you had to dive deep into data to solve a problem.", followUps: ["What metrics did you use?", "What did you discover?"], whatInterviewerLooksFor: "Analytical depth, data-driven decision making", companies: ["amazon"], seniority: ["all"] },
  { id: "bh-amz-3", category: "Bias for Action", question: "Describe a time you made a decision with incomplete information.", followUps: ["What was the risk?", "How did it turn out?"], whatInterviewerLooksFor: "Calculated risk-taking, speed of decision", companies: ["amazon", "uber", "swiggy"], seniority: ["all"] },

  // ─── Google-specific ───────────────
  { id: "bh-goog-1", category: "Googleyness", question: "Tell me about a time you navigated ambiguity to deliver a result.", followUps: ["How did you create structure from chaos?"], whatInterviewerLooksFor: "Comfort with ambiguity, self-direction, structured thinking", companies: ["google"], seniority: ["all"] },
  { id: "bh-goog-2", category: "Googleyness", question: "Describe a time you pushed back on a popular but technically flawed idea.", followUps: ["How did you present your counterargument?"], whatInterviewerLooksFor: "Intellectual courage, data-backed argumentation", companies: ["google", "netflix"], seniority: ["mid", "senior"] },
];

export const BEHAVIORAL_CATEGORIES = [
  "Teamwork", "Conflict Resolution", "Leadership", "Deadlines",
  "Failures", "Ownership", "Communication", "Difficult Teammate",
  "Pressure Handling", "Project Discussion", "Customer Obsession",
  "Dive Deep", "Bias for Action", "Googleyness",
] as const;

export const getBehavioralByCategory = (category: string) =>
  BEHAVIORAL_QUESTIONS.filter((q) => q.category === category);

export const getBehavioralForCompany = (companyKey: string) =>
  BEHAVIORAL_QUESTIONS.filter((q) => q.companies.includes(companyKey));

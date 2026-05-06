// Expanded to cover all 32+ companies in datasets
import { DSA_QUESTIONS } from "./datasets";

export type PracticeCompanyKey =
  | "microsoft" | "amazon" | "google" | "meta" | "oracle" | "adobe" | "netflix"
  | "apple" | "uber" | "atlassian" | "airbnb" | "linkedin" | "salesforce"
  | "nvidia" | "intel" | "qualcomm" | "samsung"
  | "goldman-sachs" | "jpmorgan" | "deloitte" | "accenture" | "morgan-stanley"
  | "flipkart" | "swiggy" | "zomato" | "razorpay" | "phonepe" | "cred" | "meesho"
  | "tcs" | "infosys" | "wipro"
  | "generic";

export interface PracticeCompanyProfile {
  key: PracticeCompanyKey;
  name: string;
  interviewStyle: string;
  behavioralFocus: string[];
  technicalFocus: string[];
  dsaPatterns: string[];
}

export interface PopularDSAQuestion {
  id: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  topic: string;
  companies: PracticeCompanyKey[];
  prompt: string;
}

export const PRACTICE_COMPANY_PROFILES: PracticeCompanyProfile[] = [
  {
    key: "microsoft",
    name: "Microsoft",
    interviewStyle: "Collaborative, clarity-first, practical engineering judgment",
    behavioralFocus: [
      "Ownership and impact",
      "Cross-team collaboration",
      "Learning mindset",
    ],
    technicalFocus: [
      "Core data structures",
      "Clean code and edge cases",
      "Trade-offs and maintainability",
    ],
    dsaPatterns: ["arrays", "hashing", "trees", "binary-search", "graphs"],
  },
  {
    key: "amazon",
    name: "Amazon",
    interviewStyle: "Leadership principles plus data-backed decision making",
    behavioralFocus: ["Ownership", "Bias for action", "Customer obsession"],
    technicalFocus: ["Scalability", "Complexity analysis", "Reliability"],
    dsaPatterns: ["sliding-window", "heap", "graphs", "dp"],
  },
  {
    key: "google",
    name: "Google",
    interviewStyle: "Structured, algorithm-heavy, communication during problem solving",
    behavioralFocus: ["Googleyness", "Problem decomposition", "Clarity"],
    technicalFocus: ["Algorithms", "Big-O rigor", "Testing strategy"],
    dsaPatterns: ["graphs", "dp", "strings", "trees", "backtracking"],
  },
  {
    key: "meta",
    name: "Meta",
    interviewStyle: "Fast-paced coding and implementation quality",
    behavioralFocus: ["Execution speed", "Collaboration", "Product thinking"],
    technicalFocus: ["Coding rounds", "Bug-free implementation", "Optimization"],
    dsaPatterns: ["arrays", "two-pointers", "graphs", "trees"],
  },
  {
    key: "oracle",
    name: "Oracle",
    interviewStyle: "System reliability and fundamentals-oriented",
    behavioralFocus: ["Stability mindset", "Team delivery", "Ownership"],
    technicalFocus: ["Database concepts", "Backend fundamentals", "Code quality"],
    dsaPatterns: ["trees", "binary-search", "hashing", "dp"],
  },
  {
    key: "adobe",
    name: "Adobe",
    interviewStyle: "Strong fundamentals with practical product impact",
    behavioralFocus: ["Innovation", "User empathy", "Execution"],
    technicalFocus: ["Algorithms", "Design trade-offs", "Readable code"],
    dsaPatterns: ["strings", "arrays", "dp", "trees"],
  },
  {
    key: "netflix",
    name: "Netflix",
    interviewStyle: "High ownership, high context, architecture-focused",
    behavioralFocus: ["Impact", "Independence", "Judgment"],
    technicalFocus: ["System design", "Performance", "Failure handling"],
    dsaPatterns: ["graphs", "heap", "intervals", "dp"],
  },
  // ─── New Companies (bridged from datasets/) ───────────
  { key: "apple", name: "Apple", interviewStyle: "Deep technical depth. Craftsmanship and attention to detail.", behavioralFocus: ["Attention to detail", "Passion for craft", "Privacy-first thinking"], technicalFocus: ["Low-level systems", "Performance optimization", "UI/UX engineering"], dsaPatterns: ["arrays", "trees", "linked-list", "dp", "binary-search"] },
  { key: "uber", name: "Uber", interviewStyle: "Systems-heavy, real-world problem solving. Distributed systems emphasis.", behavioralFocus: ["Ownership", "Bias for action", "Moving fast with quality"], technicalFocus: ["Distributed systems", "Real-time data", "Geo-spatial algorithms"], dsaPatterns: ["graphs", "heap", "sliding-window", "dp", "intervals"] },
  { key: "atlassian", name: "Atlassian", interviewStyle: "Values-driven. Teamwork. Don't #@!% the customer.", behavioralFocus: ["Team player", "Customer focus", "Open culture"], technicalFocus: ["Clean architecture", "API design", "Testing"], dsaPatterns: ["arrays", "hashing", "trees", "graphs"] },
  { key: "airbnb", name: "Airbnb", interviewStyle: "Culture fit is paramount. Cross-functional thinking.", behavioralFocus: ["Belonging anywhere", "Host mentality", "Simplify"], technicalFocus: ["Full-stack capability", "Search & recommendation", "Frontend craft"], dsaPatterns: ["graphs", "dp", "hashing", "trees"] },
  { key: "linkedin", name: "LinkedIn", interviewStyle: "Microsoft-adjacent but with social network scale challenges.", behavioralFocus: ["Members first", "Act like an owner", "Be open"], technicalFocus: ["Distributed systems", "Graph databases", "Search infrastructure"], dsaPatterns: ["graphs", "hashing", "dp", "trees", "heap"] },
  { key: "salesforce", name: "Salesforce", interviewStyle: "Ohana culture. CRM domain knowledge is a plus.", behavioralFocus: ["Trust", "Customer success", "Innovation"], technicalFocus: ["Multi-tenant architecture", "API platform design", "Database optimization"], dsaPatterns: ["arrays", "hashing", "trees", "dp"] },
  { key: "nvidia", name: "Nvidia", interviewStyle: "Deep technical. GPU/parallel computing. Low-level systems.", behavioralFocus: ["Intellectual curiosity", "Innovation", "Technical depth"], technicalFocus: ["CUDA programming", "Parallel computing", "Memory optimization"], dsaPatterns: ["arrays", "dp", "binary-search", "graphs", "bit-manipulation"] },
  { key: "intel", name: "Intel", interviewStyle: "Hardware-software intersection. Strong CS fundamentals.", behavioralFocus: ["Analytical thinking", "Teamwork", "Quality focus"], technicalFocus: ["Computer architecture", "Compiler optimization", "Performance tuning"], dsaPatterns: ["arrays", "binary-search", "dp", "bit-manipulation"] },
  { key: "qualcomm", name: "Qualcomm", interviewStyle: "Embedded systems and wireless tech focus.", behavioralFocus: ["Innovation", "Teamwork", "Technical curiosity"], technicalFocus: ["Embedded C/C++", "Real-time systems", "OS internals"], dsaPatterns: ["arrays", "linked-list", "trees", "bit-manipulation"] },
  { key: "samsung", name: "Samsung", interviewStyle: "Strong coding test (Samsung SWC). Implementation-heavy.", behavioralFocus: ["Discipline", "Hard work", "Team collaboration"], technicalFocus: ["Implementation accuracy", "BFS/DFS", "Simulation problems"], dsaPatterns: ["bfs", "dfs", "simulation", "dp", "graphs", "backtracking"] },
  { key: "goldman-sachs", name: "Goldman Sachs", interviewStyle: "Heavy OA filter. System design for senior. Math/quant overlap.", behavioralFocus: ["Integrity", "Client focus", "Risk management"], technicalFocus: ["Concurrency", "Low-latency systems", "Financial modeling"], dsaPatterns: ["dp", "arrays", "hashing", "graphs", "math"] },
  { key: "jpmorgan", name: "JP Morgan Chase", interviewStyle: "Code for Good for campus. Standard SDE loop for experienced.", behavioralFocus: ["Teamwork", "Integrity", "Client-first"], technicalFocus: ["Core Java", "Spring Boot", "Database design"], dsaPatterns: ["arrays", "hashing", "trees", "dp"] },
  { key: "deloitte", name: "Deloitte", interviewStyle: "Consulting + tech hybrid. Case study rounds.", behavioralFocus: ["Client relationship", "Consulting mindset", "Communication"], technicalFocus: ["Cloud architecture", "Data analytics", "Enterprise solutions"], dsaPatterns: ["arrays", "hashing", "trees"] },
  { key: "accenture", name: "Accenture", interviewStyle: "Communication-focused. Mix of technical and behavioral.", behavioralFocus: ["Client delivery", "Teamwork", "Adaptability"], technicalFocus: ["Web development", "Cloud basics", "Agile methodology"], dsaPatterns: ["arrays", "strings", "hashing"] },
  { key: "morgan-stanley", name: "Morgan Stanley", interviewStyle: "Strong technical foundation. Java-heavy.", behavioralFocus: ["Integrity", "Excellence", "Diversity of thought"], technicalFocus: ["Core Java", "Multithreading", "Database design"], dsaPatterns: ["arrays", "dp", "hashing", "trees"] },
  { key: "flipkart", name: "Flipkart", interviewStyle: "Strong DSA focus. Machine coding round is unique.", behavioralFocus: ["Ownership", "Customer focus", "Scale thinking"], technicalFocus: ["Low-level design", "Machine coding", "Scalable architecture"], dsaPatterns: ["dp", "graphs", "trees", "arrays", "hashing", "greedy"] },
  { key: "swiggy", name: "Swiggy", interviewStyle: "Fast-paced startup. Real-world problem solving.", behavioralFocus: ["Speed", "Ownership", "Consumer thinking"], technicalFocus: ["Microservices", "Real-time tracking", "Geo-services"], dsaPatterns: ["graphs", "dp", "arrays", "hashing", "heap"] },
  { key: "zomato", name: "Zomato", interviewStyle: "Strong on DSA. Growing emphasis on system design.", behavioralFocus: ["Customer obsession", "Bias for action", "Ownership"], technicalFocus: ["Backend scalability", "Search systems", "Payment integration"], dsaPatterns: ["arrays", "dp", "graphs", "hashing"] },
  { key: "razorpay", name: "Razorpay", interviewStyle: "Fintech focus. Correctness and edge cases. System design important.", behavioralFocus: ["Reliability", "Ownership", "Customer trust"], technicalFocus: ["Payment systems", "Idempotency", "Transaction safety"], dsaPatterns: ["arrays", "hashing", "dp", "trees"] },
  { key: "phonepe", name: "PhonePe", interviewStyle: "UPI/fintech domain. Strong backend. Machine coding for SDE-1.", behavioralFocus: ["Speed", "Trust", "Innovation"], technicalFocus: ["UPI systems", "Real-time payments", "Scalable backends"], dsaPatterns: ["arrays", "dp", "hashing", "trees"] },
  { key: "cred", name: "CRED", interviewStyle: "Design-conscious. Premium product culture. Code quality focus.", behavioralFocus: ["Craftsmanship", "Design taste", "Product thinking"], technicalFocus: ["Frontend excellence", "Clean architecture", "Performance"], dsaPatterns: ["arrays", "dp", "trees", "hashing"] },
  { key: "meesho", name: "Meesho", interviewStyle: "Scale-focused. Social commerce. Strong DSA initial rounds.", behavioralFocus: ["Scale thinking", "User empathy", "Frugal innovation"], technicalFocus: ["High-throughput systems", "Search & discovery", "Mobile-first"], dsaPatterns: ["dp", "graphs", "arrays", "hashing", "greedy"] },
  { key: "tcs", name: "TCS", interviewStyle: "Aptitude-heavy for freshers. NQT is the main filter.", behavioralFocus: ["Adaptability", "Willingness to learn", "Team spirit"], technicalFocus: ["Programming basics", "DBMS", "OS", "Networking"], dsaPatterns: ["arrays", "strings", "hashing", "sorting"] },
  { key: "infosys", name: "Infosys", interviewStyle: "InfyTQ platform. Aptitude + basic programming.", behavioralFocus: ["Learnability", "Ethics", "Teamwork"], technicalFocus: ["Programming fundamentals", "DBMS", "OS", "Web basics"], dsaPatterns: ["arrays", "strings", "sorting", "hashing"] },
  { key: "wipro", name: "Wipro", interviewStyle: "NLTH program. Aptitude + technical basics.", behavioralFocus: ["Spirit of Wipro", "Integrity", "Respect"], technicalFocus: ["Programming basics", "DBMS", "Networking"], dsaPatterns: ["arrays", "strings", "sorting"] },
  // ─── Generic fallback ─────────────────────────────────
  {
    key: "generic",
    name: "General Tech",
    interviewStyle: "Balanced interview mix for most software roles",
    behavioralFocus: ["Communication", "Ownership", "Learning"],
    technicalFocus: ["Core DSA", "Coding clarity", "Trade-offs"],
    dsaPatterns: ["arrays", "strings", "trees", "graphs"],
  },
];

export const POPULAR_DSA_QUESTIONS: PopularDSAQuestion[] = DSA_QUESTIONS as unknown as PopularDSAQuestion[];

export const getPracticeCompanyProfile = (companyKey: PracticeCompanyKey) =>
  PRACTICE_COMPANY_PROFILES.find((profile) => profile.key === companyKey) ||
  PRACTICE_COMPANY_PROFILES[PRACTICE_COMPANY_PROFILES.length - 1];

export const getPopularDsaQuestionsForCompany = (companyKey: PracticeCompanyKey) =>
  POPULAR_DSA_QUESTIONS.filter((q) => q.companies.includes(companyKey));

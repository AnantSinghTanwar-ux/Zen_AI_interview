export type PracticeCompanyKey =
  | "microsoft"
  | "amazon"
  | "google"
  | "meta"
  | "oracle"
  | "adobe"
  | "netflix"
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
  {
    key: "generic",
    name: "General Tech",
    interviewStyle: "Balanced interview mix for most software roles",
    behavioralFocus: ["Communication", "Ownership", "Learning"],
    technicalFocus: ["Core DSA", "Coding clarity", "Trade-offs"],
    dsaPatterns: ["arrays", "strings", "trees", "graphs"],
  },
];

export const POPULAR_DSA_QUESTIONS: PopularDSAQuestion[] = [
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    topic: "Arrays",
    companies: ["microsoft", "amazon", "google", "meta", "oracle", "generic"],
    prompt:
      "Given an array of integers and a target sum, return indices of the two numbers such that they add up to the target.",
  },
  {
    id: "merge-intervals",
    title: "Merge Intervals",
    difficulty: "Medium",
    topic: "Intervals",
    companies: ["microsoft", "google", "amazon", "generic"],
    prompt:
      "Given a collection of intervals, merge all overlapping intervals and return the resulting non-overlapping intervals.",
  },
  {
    id: "lru-cache",
    title: "LRU Cache",
    difficulty: "Medium",
    topic: "Design",
    companies: ["microsoft", "amazon", "google", "meta", "netflix"],
    prompt:
      "Design and implement an LRU cache with O(1) average time complexity for get and put operations.",
  },
  {
    id: "word-ladder",
    title: "Word Ladder",
    difficulty: "Hard",
    topic: "Graphs",
    companies: ["google", "microsoft", "meta", "generic"],
    prompt:
      "Given beginWord, endWord, and a dictionary, return the shortest transformation sequence length where each step changes exactly one letter.",
  },
  {
    id: "binary-tree-level-order",
    title: "Binary Tree Level Order Traversal",
    difficulty: "Medium",
    topic: "Trees",
    companies: ["microsoft", "oracle", "adobe", "generic"],
    prompt:
      "Given the root of a binary tree, return level order traversal of its nodes' values.",
  },
  {
    id: "longest-substring",
    title: "Longest Substring Without Repeating Characters",
    difficulty: "Medium",
    topic: "Sliding Window",
    companies: ["amazon", "microsoft", "meta", "adobe", "generic"],
    prompt:
      "Given a string, find the length of the longest substring without repeating characters.",
  },
  {
    id: "top-k-frequent",
    title: "Top K Frequent Elements",
    difficulty: "Medium",
    topic: "Heap",
    companies: ["amazon", "google", "netflix", "generic"],
    prompt:
      "Given an integer array and an integer k, return the k most frequent elements.",
  },
  {
    id: "number-of-islands",
    title: "Number of Islands",
    difficulty: "Medium",
    topic: "Graphs",
    companies: ["microsoft", "amazon", "google", "meta", "generic"],
    prompt:
      "Given a 2D grid map of '1's (land) and '0's (water), return the number of islands.",
  },
  {
    id: "kth-smallest-bst",
    title: "Kth Smallest Element in a BST",
    difficulty: "Medium",
    topic: "Trees",
    companies: ["microsoft", "oracle", "adobe", "generic"],
    prompt:
      "Given a BST and an integer k, return the kth smallest value.",
  },
  {
    id: "median-two-sorted-arrays",
    title: "Median of Two Sorted Arrays",
    difficulty: "Hard",
    topic: "Binary Search",
    companies: ["microsoft", "google", "adobe", "generic"],
    prompt:
      "Given two sorted arrays, return the median in O(log(m+n)).",
  },
];

export const getPracticeCompanyProfile = (companyKey: PracticeCompanyKey) =>
  PRACTICE_COMPANY_PROFILES.find((profile) => profile.key === companyKey) ||
  PRACTICE_COMPANY_PROFILES[PRACTICE_COMPANY_PROFILES.length - 1];

export const getPopularDsaQuestionsForCompany = (companyKey: PracticeCompanyKey) =>
  POPULAR_DSA_QUESTIONS.filter((q) => q.companies.includes(companyKey));

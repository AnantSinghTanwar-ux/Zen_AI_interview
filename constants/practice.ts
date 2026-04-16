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
  // --- Additional popular questions ---
  {
    id: "reverse-linked-list",
    title: "Reverse Linked List",
    difficulty: "Easy",
    topic: "Linked List",
    companies: ["microsoft", "amazon", "google", "meta", "oracle", "generic"],
    prompt:
      "Given the head of a singly linked list, reverse the list and return the reversed list.",
  },
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "Easy",
    topic: "Stack",
    companies: ["amazon", "google", "meta", "adobe", "generic"],
    prompt:
      "Given a string containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.",
  },
  {
    id: "best-time-buy-sell-stock",
    title: "Best Time to Buy and Sell Stock",
    difficulty: "Easy",
    topic: "Arrays",
    companies: ["amazon", "microsoft", "meta", "oracle", "generic"],
    prompt:
      "Given an array prices where prices[i] is the price of a stock on day i, maximize profit by choosing a single day to buy and a single day to sell.",
  },
  {
    id: "product-except-self",
    title: "Product of Array Except Self",
    difficulty: "Medium",
    topic: "Arrays",
    companies: ["amazon", "microsoft", "google", "meta", "generic"],
    prompt:
      "Given an integer array nums, return an array where each element is the product of all elements except itself, without using division.",
  },
  {
    id: "coin-change",
    title: "Coin Change",
    difficulty: "Medium",
    topic: "Dynamic Programming",
    companies: ["amazon", "google", "microsoft", "oracle", "generic"],
    prompt:
      "Given coins of different denominations and a target amount, return the fewest number of coins needed to make up that amount.",
  },
  {
    id: "max-subarray",
    title: "Maximum Subarray",
    difficulty: "Medium",
    topic: "Dynamic Programming",
    companies: ["amazon", "microsoft", "google", "adobe", "generic"],
    prompt:
      "Given an integer array nums, find the subarray with the largest sum and return its sum.",
  },
  {
    id: "group-anagrams",
    title: "Group Anagrams",
    difficulty: "Medium",
    topic: "Hashing",
    companies: ["amazon", "microsoft", "meta", "adobe", "generic"],
    prompt:
      "Given an array of strings, group the anagrams together. You can return the answer in any order.",
  },
  {
    id: "binary-search",
    title: "Binary Search",
    difficulty: "Easy",
    topic: "Binary Search",
    companies: ["microsoft", "oracle", "adobe", "generic"],
    prompt:
      "Given a sorted array of integers and a target value, return the index if the target is found. If not, return -1.",
  },
  {
    id: "course-schedule",
    title: "Course Schedule",
    difficulty: "Medium",
    topic: "Graphs",
    companies: ["amazon", "google", "microsoft", "netflix", "generic"],
    prompt:
      "Given numCourses and an array of prerequisites, determine if you can finish all courses (detect cycles in directed graph).",
  },
  {
    id: "word-break",
    title: "Word Break",
    difficulty: "Medium",
    topic: "Dynamic Programming",
    companies: ["amazon", "google", "meta", "adobe", "generic"],
    prompt:
      "Given a string s and a dictionary of strings wordDict, return true if s can be segmented into space-separated dictionary words.",
  },
  {
    id: "three-sum",
    title: "3Sum",
    difficulty: "Medium",
    topic: "Two Pointers",
    companies: ["amazon", "google", "meta", "microsoft", "generic"],
    prompt:
      "Given an integer array nums, return all the triplets that sum to zero with no duplicate triplets.",
  },
  {
    id: "rotate-image",
    title: "Rotate Image",
    difficulty: "Medium",
    topic: "Matrix",
    companies: ["microsoft", "amazon", "google", "adobe", "generic"],
    prompt:
      "Given an n x n 2D matrix, rotate the image by 90 degrees clockwise in-place.",
  },
  {
    id: "trapping-rain-water",
    title: "Trapping Rain Water",
    difficulty: "Hard",
    topic: "Two Pointers",
    companies: ["amazon", "google", "microsoft", "meta", "generic"],
    prompt:
      "Given n non-negative integers representing an elevation map, compute how much water it can trap after raining.",
  },
  {
    id: "longest-palindromic-substring",
    title: "Longest Palindromic Substring",
    difficulty: "Medium",
    topic: "Strings",
    companies: ["amazon", "microsoft", "adobe", "oracle", "generic"],
    prompt:
      "Given a string s, return the longest palindromic substring in s.",
  },
  {
    id: "min-window-substring",
    title: "Minimum Window Substring",
    difficulty: "Hard",
    topic: "Sliding Window",
    companies: ["meta", "google", "amazon", "netflix", "generic"],
    prompt:
      "Given strings s and t, return the minimum window substring of s such that every character in t is included.",
  },
  {
    id: "serialize-deserialize-bt",
    title: "Serialize and Deserialize Binary Tree",
    difficulty: "Hard",
    topic: "Trees",
    companies: ["google", "amazon", "meta", "microsoft", "generic"],
    prompt:
      "Design an algorithm to serialize and deserialize a binary tree. Implement both encode and decode functions.",
  },
  {
    id: "longest-increasing-subsequence",
    title: "Longest Increasing Subsequence",
    difficulty: "Medium",
    topic: "Dynamic Programming",
    companies: ["microsoft", "google", "amazon", "oracle", "generic"],
    prompt:
      "Given an integer array nums, return the length of the longest strictly increasing subsequence.",
  },
  {
    id: "validate-bst",
    title: "Validate Binary Search Tree",
    difficulty: "Medium",
    topic: "Trees",
    companies: ["microsoft", "amazon", "oracle", "adobe", "generic"],
    prompt:
      "Given the root of a binary tree, determine if it is a valid binary search tree.",
  },
  {
    id: "meeting-rooms-ii",
    title: "Meeting Rooms II",
    difficulty: "Medium",
    topic: "Intervals",
    companies: ["google", "amazon", "meta", "netflix", "generic"],
    prompt:
      "Given an array of meeting time intervals, find the minimum number of conference rooms required.",
  },
  {
    id: "design-twitter",
    title: "Design Twitter",
    difficulty: "Medium",
    topic: "Design",
    companies: ["meta", "amazon", "netflix", "generic"],
    prompt:
      "Design a simplified version of Twitter where users can post tweets, follow/unfollow, and see a news feed of the 10 most recent tweets.",
  },
];

export const getPracticeCompanyProfile = (companyKey: PracticeCompanyKey) =>
  PRACTICE_COMPANY_PROFILES.find((profile) => profile.key === companyKey) ||
  PRACTICE_COMPANY_PROFILES[PRACTICE_COMPANY_PROFILES.length - 1];

export const getPopularDsaQuestionsForCompany = (companyKey: PracticeCompanyKey) =>
  POPULAR_DSA_QUESTIONS.filter((q) => q.companies.includes(companyKey));

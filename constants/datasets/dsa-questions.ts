import { DSAQuestion } from "./types";

export const DSA_QUESTIONS: DSAQuestion[] = [
  // ─── Arrays & Hashing ─────────────────────────────────────
  {
    id: "dsa-arr-1", title: "Two Sum", difficulty: "Easy", topic: "Arrays & Hashing",
    companies: ["google", "amazon", "microsoft", "meta", "apple", "bloomberg"],
    prompt: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice.",
    hints: ["Can you do this in one pass?", "Think about using a hash map to store the complements you've seen."],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(n)",
    followUpStyle: "Ask if they can optimize for space if the array was sorted.",
  },
  {
    id: "dsa-arr-2", title: "Best Time to Buy and Sell Stock", difficulty: "Easy", topic: "Arrays & Hashing",
    companies: ["amazon", "microsoft", "google", "goldman-sachs", "jpmorgan"],
    prompt: "You are given an array prices where prices[i] is the price of a given stock on the ith day. You want to maximize your profit by choosing a single day to buy one stock and choosing a different day in the future to sell that stock. Return the maximum profit you can achieve from this transaction. If you cannot achieve any profit, return 0.",
    hints: ["Keep track of the minimum price seen so far.", "Calculate the max profit at each step."],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(1)",
    followUpStyle: "What if you could buy and sell multiple times?",
  },
  {
    id: "dsa-arr-3", title: "Contains Duplicate", difficulty: "Easy", topic: "Arrays & Hashing",
    companies: ["amazon", "microsoft", "apple", "adobe"],
    prompt: "Given an integer array nums, return true if any value appears at least twice in the array, and return false if every element is distinct.",
    hints: ["A hash set is perfect for checking if we've seen an element before."],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(n)",
  },
  {
    id: "dsa-arr-4", title: "Valid Anagram", difficulty: "Easy", topic: "Arrays & Hashing",
    companies: ["google", "amazon", "microsoft", "uber"],
    prompt: "Given two strings s and t, return true if t is an anagram of s, and false otherwise.",
    hints: ["You can count the frequency of each character using a hash map or an array of size 26."],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(1)", // O(1) because alphabet size is fixed to 26
  },
  {
    id: "dsa-arr-5", title: "Group Anagrams", difficulty: "Medium", topic: "Arrays & Hashing",
    companies: ["amazon", "microsoft", "google", "meta"],
    prompt: "Given an array of strings strs, group the anagrams together. You can return the answer in any order.",
    hints: ["What could be a unique key for each anagram group? Either the sorted string or a character count array."],
    optimalTimeComplexity: "O(n * k * log k) or O(n * k)", optimalSpaceComplexity: "O(n * k)",
    followUpStyle: "Discuss the trade-offs between sorting the strings vs counting characters for the map key.",
  },
  {
    id: "dsa-arr-6", title: "Top K Frequent Elements", difficulty: "Medium", topic: "Arrays & Hashing",
    companies: ["amazon", "meta", "google", "microsoft"],
    prompt: "Given an integer array nums and an integer k, return the k most frequent elements. You may return the answer in any order.",
    hints: ["First, count the frequencies.", "You can use a min-heap of size k, or bucket sort where the index is the frequency."],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(n)",
    followUpStyle: "Challenge them to solve it in strictly better than O(n log n) time using Bucket Sort.",
  },
  {
    id: "dsa-arr-7", title: "Product of Array Except Self", difficulty: "Medium", topic: "Arrays & Hashing",
    companies: ["amazon", "meta", "microsoft", "apple"],
    prompt: "Given an integer array nums, return an array answer such that answer[i] is equal to the product of all the elements of nums except nums[i]. The product of any prefix or suffix of nums is guaranteed to fit in a 32-bit integer. You must write an algorithm that runs in O(n) time and without using the division operation.",
    hints: ["Use prefix and postfix products.", "Can you do it with O(1) extra space by computing postfix products directly in the result array?"],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(1)",
  },
  {
    id: "dsa-arr-8", title: "Longest Consecutive Sequence", difficulty: "Medium", topic: "Arrays & Hashing",
    companies: ["google", "amazon", "microsoft", "meta"],
    prompt: "Given an unsorted array of integers nums, return the length of the longest consecutive elements sequence. You must write an algorithm that runs in O(n) time.",
    hints: ["Put everything in a hash set.", "How do you know if a number is the start of a sequence? It doesn't have a left neighbor."],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(n)",
  },

  // ─── Two Pointers ─────────────────────────────────────────
  {
    id: "dsa-tp-1", title: "Valid Palindrome", difficulty: "Easy", topic: "Two Pointers",
    companies: ["meta", "microsoft", "amazon", "apple"],
    prompt: "A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters include letters and numbers. Given a string s, return true if it is a palindrome, or false otherwise.",
    hints: ["Use two pointers, one at the beginning and one at the end, and move them towards the center."],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(1)",
  },
  {
    id: "dsa-tp-2", title: "3Sum", difficulty: "Medium", topic: "Two Pointers",
    companies: ["amazon", "meta", "microsoft", "apple", "bloomberg"],
    prompt: "Given an integer array nums, return all the triplets [nums[i], nums[j], nums[k]] such that i != j, i != k, and j != k, and nums[i] + nums[j] + nums[k] == 0. Notice that the solution set must not contain duplicate triplets.",
    hints: ["Sort the array first.", "Iterate through the array, and for each element, use two pointers to find the other two numbers that sum to the negative of the current element."],
    optimalTimeComplexity: "O(n^2)", optimalSpaceComplexity: "O(1)",
    followUpStyle: "Ask how they handle duplicate triplets efficiently.",
  },
  {
    id: "dsa-tp-3", title: "Container With Most Water", difficulty: "Medium", topic: "Two Pointers",
    companies: ["amazon", "google", "microsoft", "adobe"],
    prompt: "You are given an integer array height of length n. There are n vertical lines drawn such that the two endpoints of the ith line are (i, 0) and (i, height[i]). Find two lines that together with the x-axis form a container, such that the container contains the most water. Return the maximum amount of water a container can store.",
    hints: ["Start with the maximum width using pointers at the ends.", "Which pointer should you move? Move the one pointing to the shorter line to potentially find a taller line."],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(1)",
  },
  {
    id: "dsa-tp-4", title: "Trapping Rain Water", difficulty: "Hard", topic: "Two Pointers",
    companies: ["amazon", "google", "microsoft", "meta"],
    prompt: "Given n non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.",
    hints: ["Water at any point is determined by the minimum of the max heights to its left and right.", "You can use two pointers from the outside in to optimize space to O(1)."],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(1)",
    followUpStyle: "If they solve it with O(n) space using arrays, ask them to optimize to O(1) space using two pointers.",
  },

  // ─── Sliding Window ───────────────────────────────────────
  {
    id: "dsa-sw-1", title: "Longest Substring Without Repeating Characters", difficulty: "Medium", topic: "Sliding Window",
    companies: ["amazon", "microsoft", "meta", "bloomberg"],
    prompt: "Given a string s, find the length of the longest substring without repeating characters.",
    hints: ["Use a sliding window with a hash set to keep track of characters in the current window.", "If you see a duplicate, shrink the window from the left until the duplicate is removed."],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(min(n, m))",
  },
  {
    id: "dsa-sw-2", title: "Longest Repeating Character Replacement", difficulty: "Medium", topic: "Sliding Window",
    companies: ["google", "amazon", "microsoft"],
    prompt: "You are given a string s and an integer k. You can choose any character of the string and change it to any other uppercase English character. You can perform this operation at most k times. Return the length of the longest substring containing the same letter you can get after performing the above operations.",
    hints: ["The validity of a window is (length of window - count of most frequent character) <= k.", "You don't need to decrement the max frequency when shrinking the window."],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(1)",
  },
  {
    id: "dsa-sw-3", title: "Minimum Window Substring", difficulty: "Hard", topic: "Sliding Window",
    companies: ["meta", "amazon", "google", "uber"],
    prompt: "Given two strings s and t of lengths m and n respectively, return the minimum window substring of s such that every character in t (including duplicates) is included in the window. If there is no such substring, return the empty string.",
    hints: ["Use two hash maps or frequency arrays. Expand the right pointer until the window is valid, then shrink the left pointer to find the minimum."],
    optimalTimeComplexity: "O(m + n)", optimalSpaceComplexity: "O(1)",
    followUpStyle: "Focus on how they handle checking if the window is valid efficiently (e.g., using a 'have' and 'need' counter).",
  },

  // ─── Stack ────────────────────────────────────────────────
  {
    id: "dsa-stk-1", title: "Valid Parentheses", difficulty: "Easy", topic: "Stack",
    companies: ["amazon", "microsoft", "google", "meta", "bloomberg"],
    prompt: "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid. Open brackets must be closed by the same type of brackets, and in the correct order.",
    hints: ["Use a stack to keep track of open brackets. When you see a close bracket, check if it matches the top of the stack."],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(n)",
  },
  {
    id: "dsa-stk-2", title: "Min Stack", difficulty: "Medium", topic: "Stack",
    companies: ["amazon", "microsoft", "bloomberg"],
    prompt: "Design a stack that supports push, pop, top, and retrieving the minimum element in constant time.",
    hints: ["Keep a second stack that only tracks the minimum values.", "Or, store pairs of (value, current_minimum) in the main stack."],
    optimalTimeComplexity: "O(1) for all operations", optimalSpaceComplexity: "O(n)",
  },
  {
    id: "dsa-stk-3", title: "Daily Temperatures", difficulty: "Medium", topic: "Stack",
    companies: ["amazon", "meta", "microsoft"],
    prompt: "Given an array of integers temperatures represents the daily temperatures, return an array answer such that answer[i] is the number of days you have to wait after the ith day to get a warmer temperature. If there is no future day for which this is possible, keep answer[i] == 0 instead.",
    hints: ["Use a decreasing monotonic stack.", "Store the indices in the stack. When you find a warmer temperature, pop from the stack and calculate the difference in indices."],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(n)",
  },
  {
    id: "dsa-stk-4", title: "Largest Rectangle in Histogram", difficulty: "Hard", topic: "Stack",
    companies: ["google", "amazon", "microsoft"],
    prompt: "Given an array of integers heights representing the histogram's bar height where the width of each bar is 1, return the area of the largest rectangle in the histogram.",
    hints: ["Use an increasing monotonic stack.", "When you encounter a shorter bar, you know the right boundary for the taller bars in the stack. Pop them and calculate their areas."],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(n)",
  },

  // ─── Binary Search ────────────────────────────────────────
  {
    id: "dsa-bs-1", title: "Binary Search", difficulty: "Easy", topic: "Binary Search",
    companies: ["microsoft", "apple", "amazon"],
    prompt: "Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, then return its index. Otherwise, return -1.",
    hints: ["Use a left and right pointer. Calculate the mid point to halve the search space at each step."],
    optimalTimeComplexity: "O(log n)", optimalSpaceComplexity: "O(1)",
  },
  {
    id: "dsa-bs-2", title: "Search a 2D Matrix", difficulty: "Medium", topic: "Binary Search",
    companies: ["amazon", "microsoft", "meta"],
    prompt: "You are given an m x n integer matrix matrix with the following two properties: Each row is sorted in non-decreasing order. The first integer of each row is greater than the last integer of the previous row. Given an integer target, return true if target is in matrix or false otherwise.",
    hints: ["You can treat the 2D matrix as a flat 1D sorted array and do standard binary search.", "Row = index / cols, Col = index % cols."],
    optimalTimeComplexity: "O(log(m * n))", optimalSpaceComplexity: "O(1)",
  },
  {
    id: "dsa-bs-3", title: "Find Minimum in Rotated Sorted Array", difficulty: "Medium", topic: "Binary Search",
    companies: ["amazon", "microsoft", "bloomberg"],
    prompt: "Suppose an array of length n sorted in ascending order is rotated between 1 and n times. Given the sorted rotated array nums of unique elements, return the minimum element of this array. You must write an algorithm that runs in O(log n) time.",
    hints: ["In binary search, compare mid with the right pointer. If mid > right, the minimum must be in the right half. Otherwise, it's in the left half including mid."],
    optimalTimeComplexity: "O(log n)", optimalSpaceComplexity: "O(1)",
  },
  {
    id: "dsa-bs-4", title: "Search in Rotated Sorted Array", difficulty: "Medium", topic: "Binary Search",
    companies: ["meta", "amazon", "microsoft", "linkedin"],
    prompt: "There is an integer array nums sorted in ascending order (with distinct values). Prior to being passed to your function, nums is possibly rotated at an unknown pivot index k. Given the array nums after the possible rotation and an integer target, return the index of target if it is in nums, or -1 if it is not in nums. You must write an algorithm with O(log n) runtime complexity.",
    hints: ["At least one half of the array will always be perfectly sorted.", "Check which half is sorted, then check if the target falls within the range of that sorted half."],
    optimalTimeComplexity: "O(log n)", optimalSpaceComplexity: "O(1)",
  },

  // ─── Linked List ──────────────────────────────────────────
  {
    id: "dsa-ll-1", title: "Reverse Linked List", difficulty: "Easy", topic: "Linked List",
    companies: ["amazon", "microsoft", "apple", "meta"],
    prompt: "Given the head of a singly linked list, reverse the list, and return the reversed list.",
    hints: ["You need three pointers: prev, curr, and next. Iterate and reverse the links one by one."],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(1)",
    followUpStyle: "Ask them to implement it recursively if they did it iteratively, or vice-versa.",
  },
  {
    id: "dsa-ll-2", title: "Merge Two Sorted Lists", difficulty: "Easy", topic: "Linked List",
    companies: ["amazon", "microsoft", "apple"],
    prompt: "You are given the heads of two sorted linked lists list1 and list2. Merge the two lists into one sorted list. The list should be made by splicing together the nodes of the first two lists. Return the head of the merged linked list.",
    hints: ["Use a dummy node to handle the edge case of an empty list easily.", "Iterate while both lists are not null, appending the smaller value to your new list."],
    optimalTimeComplexity: "O(n + m)", optimalSpaceComplexity: "O(1)",
  },
  {
    id: "dsa-ll-3", title: "Reorder List", difficulty: "Medium", topic: "Linked List",
    companies: ["amazon", "microsoft", "meta"],
    prompt: "You are given the head of a singly linked-list. The list can be represented as: L0 → L1 → … → Ln-1 → Ln. Reorder the list to be on the following form: L0 → Ln → L1 → Ln-1 → L2 → Ln-2 → … You may not modify the values in the list's nodes. Only nodes themselves may be changed.",
    hints: ["Find the middle of the list. Reverse the second half. Merge the two halves alternately."],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(1)",
  },
  {
    id: "dsa-ll-4", title: "Remove Nth Node From End of List", difficulty: "Medium", topic: "Linked List",
    companies: ["amazon", "meta", "apple"],
    prompt: "Given the head of a linked list, remove the nth node from the end of the list and return its head.",
    hints: ["Use two pointers separated by n nodes.", "A dummy node pointing to head helps handle the case where the head itself needs to be removed."],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(1)",
  },
  {
    id: "dsa-ll-5", title: "Linked List Cycle", difficulty: "Easy", topic: "Linked List",
    companies: ["amazon", "microsoft", "bloomberg"],
    prompt: "Given head, the head of a linked list, determine if the linked list has a cycle in it. Return true if there is a cycle in the linked list. Otherwise, return false.",
    hints: ["Use Floyd's Cycle-Finding Algorithm (Tortoise and Hare). One pointer moves one step, the other moves two steps."],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(1)",
  },
  {
    id: "dsa-ll-6", title: "Merge k Sorted Lists", difficulty: "Hard", topic: "Linked List",
    companies: ["amazon", "meta", "microsoft", "google"],
    prompt: "You are given an array of k linked-lists lists, each linked-list is sorted in ascending order. Merge all the linked-lists into one sorted linked-list and return it.",
    hints: ["You can use a Min-Heap (Priority Queue) to always get the smallest element.", "Alternatively, use divide and conquer to merge pairs of lists iteratively."],
    optimalTimeComplexity: "O(N log k)", optimalSpaceComplexity: "O(1) space if divide and conquer, O(k) for heap",
    followUpStyle: "Discuss the trade-offs between the Min-Heap approach and the Divide and Conquer approach.",
  },

  // ─── Trees ────────────────────────────────────────────────
  {
    id: "dsa-tree-1", title: "Invert Binary Tree", difficulty: "Easy", topic: "Trees",
    companies: ["google", "amazon", "apple"],
    prompt: "Given the root of a binary tree, invert the tree, and return its root.",
    hints: ["Recursively swap the left and right children of every node."],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(h)",
  },
  {
    id: "dsa-tree-2", title: "Maximum Depth of Binary Tree", difficulty: "Easy", topic: "Trees",
    companies: ["amazon", "microsoft", "apple"],
    prompt: "Given the root of a binary tree, return its maximum depth. A binary tree's maximum depth is the number of nodes along the longest path from the root node down to the farthest leaf node.",
    hints: ["1 + max(depth of left subtree, depth of right subtree)."],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(h)",
  },
  {
    id: "dsa-tree-3", title: "Lowest Common Ancestor of a Binary Search Tree", difficulty: "Medium", topic: "Trees",
    companies: ["amazon", "microsoft", "meta"],
    prompt: "Given a binary search tree (BST), find the lowest common ancestor (LCA) node of two given nodes in the BST.",
    hints: ["Leverage the BST property. If both p and q are greater than root, LCA is in right subtree. If both are less, it's in the left subtree. Otherwise, the current root is the LCA."],
    optimalTimeComplexity: "O(h)", optimalSpaceComplexity: "O(1) iterative, O(h) recursive",
  },
  {
    id: "dsa-tree-4", title: "Binary Tree Level Order Traversal", difficulty: "Medium", topic: "Trees",
    companies: ["amazon", "microsoft", "meta", "bloomberg"],
    prompt: "Given the root of a binary tree, return the level order traversal of its nodes' values. (i.e., from left to right, level by level).",
    hints: ["Use a Queue for Breadth-First Search (BFS). Keep track of the size of the queue at the start of each level loop."],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(n)",
  },
  {
    id: "dsa-tree-5", title: "Validate Binary Search Tree", difficulty: "Medium", topic: "Trees",
    companies: ["amazon", "meta", "microsoft"],
    prompt: "Given the root of a binary tree, determine if it is a valid binary search tree (BST).",
    hints: ["A node must be greater than all nodes in its left subtree and less than all nodes in its right subtree.", "Pass down a min and max boundary constraint for each recursive call."],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(h)",
  },
  {
    id: "dsa-tree-6", title: "Kth Smallest Element in a BST", difficulty: "Medium", topic: "Trees",
    companies: ["amazon", "microsoft", "uber"],
    prompt: "Given the root of a binary search tree, and an integer k, return the kth smallest value (1-indexed) of all the values of the nodes in the tree.",
    hints: ["An in-order traversal of a BST visits nodes in sorted order. Just keep a counter."],
    optimalTimeComplexity: "O(n) worst case, O(h + k) average", optimalSpaceComplexity: "O(h)",
  },
  {
    id: "dsa-tree-7", title: "Serialize and Deserialize Binary Tree", difficulty: "Hard", topic: "Trees",
    companies: ["meta", "amazon", "microsoft", "google", "uber"],
    prompt: "Design an algorithm to serialize and deserialize a binary tree. There is no restriction on how your serialization/deserialization algorithm should work. You just need to ensure that a binary tree can be serialized to a string and this string can be deserialized to the original tree structure.",
    hints: ["Use Pre-order traversal with a special character (like 'N') for null nodes.", "For deserialization, use an iterator or a queue and recursively rebuild the tree."],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(n)",
    followUpStyle: "Ask if it can be done with BFS instead of DFS.",
  },

  // ─── Tries ────────────────────────────────────────────────
  {
    id: "dsa-trie-1", title: "Implement Trie (Prefix Tree)", difficulty: "Medium", topic: "Tries",
    companies: ["amazon", "google", "microsoft", "twitter"],
    prompt: "A trie (pronounced as 'try') or prefix tree is a tree data structure used to efficiently store and retrieve keys in a dataset of strings. Implement the Trie class: insert(String word), search(String word), startsWith(String prefix).",
    hints: ["Each node should contain a map or array of children nodes, and a boolean flag indicating if it's the end of a word."],
    optimalTimeComplexity: "O(m) where m is word length", optimalSpaceComplexity: "O(m) per word",
  },
  {
    id: "dsa-trie-2", title: "Design Add and Search Words Data Structure", difficulty: "Medium", topic: "Tries",
    companies: ["meta", "amazon", "google"],
    prompt: "Design a data structure that supports adding new words and finding if a string matches any previously added string. Implement the WordDictionary class. The search function can contain the dot character '.' to represent any one letter.",
    hints: ["Use a Trie. For the search with '.', you need to use DFS to recursively check all possible paths for that character."],
    optimalTimeComplexity: "O(26^m) worst case for search with dots, where m is word length", optimalSpaceComplexity: "O(total characters)",
  },

  // ─── Heap / Priority Queue ────────────────────────────────
  {
    id: "dsa-heap-1", title: "Kth Largest Element in an Array", difficulty: "Medium", topic: "Heap",
    companies: ["meta", "amazon", "microsoft", "spotify"],
    prompt: "Given an integer array nums and an integer k, return the kth largest element in the array. Note that it is the kth largest element in the sorted order, not the kth distinct element.",
    hints: ["You can use a Min-Heap of size k. Alternatively, use Quickselect for O(N) average time."],
    optimalTimeComplexity: "O(n log k) with heap, O(n) average with quickselect", optimalSpaceComplexity: "O(k) for heap",
    followUpStyle: "If they solve it with a Heap, ask them about Quickselect and its worst-case complexity.",
  },
  {
    id: "dsa-heap-2", title: "Find Median from Data Stream", difficulty: "Hard", topic: "Heap",
    companies: ["google", "amazon", "meta", "microsoft", "apple"],
    prompt: "The median is the middle value in an ordered integer list. Implement the MedianFinder class to add numbers and find the median from the data stream.",
    hints: ["Maintain two heaps: a max-heap for the lower half of the numbers, and a min-heap for the upper half.", "Keep them balanced so their sizes differ by at most 1."],
    optimalTimeComplexity: "O(log n) for add, O(1) for find", optimalSpaceComplexity: "O(n)",
  },

  // ─── Graphs ───────────────────────────────────────────────
  {
    id: "dsa-graph-1", title: "Number of Islands", difficulty: "Medium", topic: "Graphs",
    companies: ["amazon", "microsoft", "google", "meta", "bloomberg"],
    prompt: "Given an m x n 2D binary grid grid which represents a map of '1's (land) and '0's (water), return the number of islands. An island is surrounded by water and is formed by connecting adjacent lands horizontally or vertically.",
    hints: ["Iterate through the grid. When you see a '1', increment island count and run BFS or DFS to mark all connected '1's as visited (e.g. by changing them to '0')."],
    optimalTimeComplexity: "O(m * n)", optimalSpaceComplexity: "O(m * n) worst case recursion",
  },
  {
    id: "dsa-graph-2", title: "Clone Graph", difficulty: "Medium", topic: "Graphs",
    companies: ["meta", "amazon", "google"],
    prompt: "Given a reference of a node in a connected undirected graph. Return a deep copy (clone) of the graph.",
    hints: ["Use a hash map to keep track of nodes that have already been cloned to avoid infinite loops and duplicate nodes.", "Use DFS or BFS to traverse."],
    optimalTimeComplexity: "O(V + E)", optimalSpaceComplexity: "O(V)",
  },
  {
    id: "dsa-graph-3", title: "Course Schedule", difficulty: "Medium", topic: "Graphs",
    companies: ["amazon", "google", "microsoft", "meta", "uber"],
    prompt: "There are a total of numCourses courses you have to take, labeled from 0 to numCourses - 1. You are given an array prerequisites where prerequisites[i] = [ai, bi] indicates that you must take course bi first if you want to take course ai. Return true if you can finish all courses. Otherwise, return false.",
    hints: ["This is a cycle detection problem in a directed graph.", "You can use Topological Sort (Kahn's Algorithm with indegrees) or DFS with a visited and 'currently visiting' state."],
    optimalTimeComplexity: "O(V + E)", optimalSpaceComplexity: "O(V + E)",
  },
  {
    id: "dsa-graph-4", title: "Word Ladder", difficulty: "Hard", topic: "Graphs",
    companies: ["amazon", "meta", "google", "lyft"],
    prompt: "A transformation sequence from word beginWord to word endWord using a dictionary wordList is a sequence of words beginWord -> s1 -> s2 -> ... -> sk such that every adjacent pair differs by a single letter. Return the number of words in the shortest transformation sequence from beginWord to endWord, or 0 if no such sequence exists.",
    hints: ["Shortest path implies Breadth-First Search (BFS).", "Pre-process the wordList to quickly find neighbors using wildcards (e.g. 'hot' -> '*ot', 'h*t', 'ho*')."],
    optimalTimeComplexity: "O(M^2 * N)", optimalSpaceComplexity: "O(M^2 * N)",
  },

  // ─── Dynamic Programming (1D) ─────────────────────────────
  {
    id: "dsa-dp1-1", title: "Climbing Stairs", difficulty: "Easy", topic: "1D DP",
    companies: ["amazon", "google", "apple"],
    prompt: "You are climbing a staircase. It takes n steps to reach the top. Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?",
    hints: ["This is just the Fibonacci sequence.", "dp[i] = dp[i-1] + dp[i-2]. You can optimize space to O(1) by just keeping the last two values."],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(1)",
  },
  {
    id: "dsa-dp1-2", title: "House Robber", difficulty: "Medium", topic: "1D DP",
    companies: ["amazon", "google", "microsoft"],
    prompt: "You are a professional robber planning to rob houses along a street. Each house has a certain amount of money stashed, the only constraint stopping you from robbing each of them is that adjacent houses have security systems connected and it will automatically contact the police if two adjacent houses were broken into on the same night. Given an integer array nums representing the amount of money of each house, return the maximum amount of money you can rob tonight without alerting the police.",
    hints: ["At each house, you have two choices: rob it (plus money from house-2) or don't rob it (keep money from house-1).", "dp[i] = max(nums[i] + dp[i-2], dp[i-1])"],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(1)",
  },
  {
    id: "dsa-dp1-3", title: "Coin Change", difficulty: "Medium", topic: "1D DP",
    companies: ["amazon", "google", "meta", "microsoft"],
    prompt: "You are given an integer array coins representing coins of different denominations and an integer amount representing a total amount of money. Return the fewest number of coins that you need to make up that amount. If that amount of money cannot be made up by any combination of the coins, return -1.",
    hints: ["Use a DP array of size amount + 1, initialized to infinity.", "For each amount from 1 to target, try every coin and take the minimum."],
    optimalTimeComplexity: "O(amount * number of coins)", optimalSpaceComplexity: "O(amount)",
  },
  {
    id: "dsa-dp1-4", title: "Longest Increasing Subsequence", difficulty: "Medium", topic: "1D DP",
    companies: ["meta", "amazon", "google", "microsoft"],
    prompt: "Given an integer array nums, return the length of the longest strictly increasing subsequence.",
    hints: ["Standard DP is O(N^2): check all previous smaller numbers.", "Can you do it in O(N log N) using an array of sequence tails and binary search?"],
    optimalTimeComplexity: "O(N log N)", optimalSpaceComplexity: "O(N)",
    followUpStyle: "Ask if they can optimize their O(n^2) DP approach to O(n log n).",
  },

  // ─── Advanced DP (2D) ─────────────────────────────────────
  {
    id: "dsa-dp2-1", title: "Longest Common Subsequence", difficulty: "Medium", topic: "2D DP",
    companies: ["amazon", "google", "microsoft"],
    prompt: "Given two strings text1 and text2, return the length of their longest common subsequence. If there is no common subsequence, return 0.",
    hints: ["Use a 2D array grid where dp[i][j] represents the LCS of text1[0:i] and text2[0:j].", "If characters match: dp[i][j] = 1 + dp[i-1][j-1]. If not: max(dp[i-1][j], dp[i][j-1])."],
    optimalTimeComplexity: "O(m * n)", optimalSpaceComplexity: "O(min(m, n))",
  },
  {
    id: "dsa-dp2-2", title: "Edit Distance", difficulty: "Hard", topic: "2D DP",
    companies: ["google", "amazon", "microsoft"],
    prompt: "Given two strings word1 and word2, return the minimum number of operations required to convert word1 to word2. You have the following three operations permitted on a word: Insert a character, Delete a character, Replace a character.",
    hints: ["Use a 2D DP table. Base cases are empty strings (requires lengths number of deletes/inserts).", "dp[i][j] = min(insert, delete, replace) + 1 if characters don't match."],
    optimalTimeComplexity: "O(m * n)", optimalSpaceComplexity: "O(m * n)",
  },

  // ─── Intervals ────────────────────────────────────────────
  {
    id: "dsa-int-1", title: "Merge Intervals", difficulty: "Medium", topic: "Intervals",
    companies: ["amazon", "meta", "google", "bloomberg"],
    prompt: "Given an array of intervals where intervals[i] = [starti, endi], merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.",
    hints: ["Sort the intervals by their start values first.", "Iterate and merge the current interval with the last one in your result if their start <= last.end."],
    optimalTimeComplexity: "O(n log n)", optimalSpaceComplexity: "O(n) or O(log n) for sorting",
  },
  {
    id: "dsa-int-2", title: "Insert Interval", difficulty: "Medium", topic: "Intervals",
    companies: ["google", "meta", "apple"],
    prompt: "You are given an array of non-overlapping intervals intervals where intervals[i] = [starti, endi] represent the start and the end of the ith interval and intervals is sorted in ascending order by starti. You are also given an interval newInterval = [start, end] that represents the start and end of another interval. Insert newInterval into intervals such that intervals is still sorted in ascending order by starti and intervals still does not have any overlapping intervals (merge overlapping intervals if necessary).",
    hints: ["Since it's already sorted, just iterate. Add all intervals before the new interval. Merge overlapping ones. Add all intervals after."],
    optimalTimeComplexity: "O(n)", optimalSpaceComplexity: "O(n)",
  },
  {
    id: "dsa-int-3", title: "Non-overlapping Intervals", difficulty: "Medium", topic: "Intervals",
    companies: ["meta", "amazon", "google"],
    prompt: "Given an array of intervals intervals where intervals[i] = [starti, endi], return the minimum number of intervals you need to remove to make the rest of the intervals non-overlapping.",
    hints: ["Sort intervals by their END times, not start times.", "Greedily pick intervals that end the earliest to leave the most room for future intervals."],
    optimalTimeComplexity: "O(n log n)", optimalSpaceComplexity: "O(1) or O(log n) for sort",
  },
];

/**
 * ZenAI Interview Datasets — Master Index
 * 
 * Modular dataset system with lazy loading support.
 * All datasets are split into domain-specific files for optimal frontend performance.
 * 
 * Usage:
 *   import { ALL_COMPANIES, getCompanyByKey, generateInterviewContext } from "@/constants/datasets";
 */

// ─── Types ───────────────────────────────────────────────
export type { CompanyProfile, DSAQuestion, BehavioralQuestion, SystemDesignQuestion, DomainTopic, InterviewContextConfig, Difficulty, InterviewRound, Domain, InterviewerPersonality } from "./types";

// ─── Company Datasets ────────────────────────────────────
import { FAANG_COMPANIES } from "./companies-faang";
import { TIER1_COMPANIES } from "./companies-tier1";
import { FINANCE_COMPANIES } from "./companies-finance";
import { INDIA_COMPANIES } from "./companies-india";

export { FAANG_COMPANIES } from "./companies-faang";
export { TIER1_COMPANIES } from "./companies-tier1";
export { FINANCE_COMPANIES } from "./companies-finance";
export { INDIA_COMPANIES } from "./companies-india";

/** All companies combined — 32 companies total */
export const ALL_COMPANIES = [
  ...FAANG_COMPANIES,
  ...TIER1_COMPANIES,
  ...FINANCE_COMPANIES,
  ...INDIA_COMPANIES,
];

// ─── Question Datasets ────────────────────────────────────
import { DSA_QUESTIONS } from "./dsa-questions";
import { SYSTEM_DESIGN_QUESTIONS } from "./system-design";
import { DOMAIN_TOPICS } from "./domain-questions";

export { DSA_QUESTIONS } from "./dsa-questions";
export { SYSTEM_DESIGN_QUESTIONS } from "./system-design";
export { DOMAIN_TOPICS } from "./domain-questions";

// ─── Behavioral Dataset ─────────────────────────────────
export { BEHAVIORAL_QUESTIONS, BEHAVIORAL_CATEGORIES, getBehavioralByCategory, getBehavioralForCompany } from "./behavioral";

// ─── Context Generator ──────────────────────────────────
export { generateInterviewContext, generateVapiPromptContext } from "./context-generator";

// ─── Lookup Helpers ─────────────────────────────────────

/** Get a single company by key. Falls back to generic if not found. */
export function getCompanyByKey(key: string) {
  return ALL_COMPANIES.find((c) => c.key === key) || ALL_COMPANIES.find((c) => c.key === "google")!;
}

/** Get companies by tier */
export function getCompaniesByTier(tier: string) {
  return ALL_COMPANIES.filter((c) => c.tier === tier);
}

/** Get all unique company keys */
export function getAllCompanyKeys(): string[] {
  return ALL_COMPANIES.map((c) => c.key);
}

/** Search companies by name (case-insensitive) */
export function searchCompanies(query: string) {
  const q = query.toLowerCase();
  return ALL_COMPANIES.filter(
    (c) => c.name.toLowerCase().includes(q) || c.key.includes(q)
  );
}

/** Company tier labels for UI */
export const COMPANY_TIERS = [
  { key: "FAANG", label: "FAANG / Big Tech", count: FAANG_COMPANIES.length },
  { key: "Tier1", label: "Top Tech Companies", count: TIER1_COMPANIES.length },
  { key: "Finance", label: "Finance & Consulting", count: FINANCE_COMPANIES.length },
  { key: "Product", label: "Indian Product Companies", count: INDIA_COMPANIES.filter(c => c.tier === "Product").length },
  { key: "Startup", label: "Indian Startups", count: INDIA_COMPANIES.filter(c => c.tier === "Startup").length },
  { key: "ServiceBased", label: "Service-Based", count: INDIA_COMPANIES.filter(c => c.tier === "ServiceBased").length },
];

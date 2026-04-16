import { db } from "@/services/firebase/admin";
import {
  ExternalApplication,
  SourcePlatform,
  RoleCategory,
  RECRUITER_EMAIL,
} from "@/types/external-application";

const COLLECTION = "external_applications";

// Normalize enums
function normalizePlatform(raw: string): SourcePlatform {
  const lower = (raw || "").toLowerCase().trim();
  if (lower.includes("linkedin")) return "linkedin";
  if (lower.includes("jobyt")) return "jobyt";
  if (lower.includes("naukri")) return "naukri";
  if (lower.includes("indeed")) return "indeed";
  if (lower.includes("glassdoor")) return "glassdoor";
  return "other";
}

function normalizeRoleCategory(raw: string): RoleCategory {
  const lower = (raw || "").toLowerCase().trim();
  if (lower.includes("backend") || lower.includes("back-end") || lower.includes("server")) return "backend";
  if (lower.includes("frontend") || lower.includes("front-end") || lower.includes("ui")) return "frontend";
  if (lower.includes("fullstack") || lower.includes("full-stack") || lower.includes("full stack")) return "fullstack";
  if (lower.includes("devops") || lower.includes("sre") || lower.includes("infrastructure")) return "devops";
  if (lower.includes("data") || lower.includes("ml") || lower.includes("machine learning") || lower.includes("analytics")) return "data";
  if (lower.includes("mobile") || lower.includes("android") || lower.includes("ios") || lower.includes("flutter")) return "mobile";
  if (lower.includes("design") || lower.includes("ux") || lower.includes("ui/ux")) return "design";
  if (lower.includes("qa") || lower.includes("test") || lower.includes("quality")) return "qa";
  if (lower.includes("manager") || lower.includes("lead") || lower.includes("director")) return "management";
  return "other";
}

export async function importApplications(
  records: Array<{
    candidateName: string;
    candidateEmail: string;
    resumeUrl?: string;
    sourcePlatform?: string;
    companyName: string;
    roleTitle: string;
    roleCategory?: string;
    externalJobId?: string;
    externalJobUrl?: string;
  }>
): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Deduplicate by email within this batch
  const seen = new Set<string>();

  const batch = db.batch();
  let batchCount = 0;

  for (const record of records) {
    if (!record.candidateEmail || !record.candidateName) {
      errors.push(`Missing name/email for row`);
      continue;
    }

    const email = record.candidateEmail.trim().toLowerCase();

    if (seen.has(email)) {
      skipped++;
      continue;
    }
    seen.add(email);

    // Check for existing application with same email + roleTitle + companyName
    const existing = await db
      .collection(COLLECTION)
      .where("candidateEmail", "==", email)
      .where("roleTitle", "==", record.roleTitle?.trim() || "")
      .where("companyName", "==", record.companyName?.trim() || "")
      .limit(1)
      .get();

    if (!existing.empty) {
      skipped++;
      continue;
    }

    const docRef = db.collection(COLLECTION).doc();
    const now = new Date().toISOString();

    batch.set(docRef, {
      candidateName: record.candidateName.trim(),
      candidateEmail: email,
      resumeUrl: record.resumeUrl?.trim() || "",
      sourcePlatform: normalizePlatform(record.sourcePlatform || "other"),
      companyName: record.companyName?.trim() || "Unknown",
      roleTitle: record.roleTitle?.trim() || "Software Engineer",
      roleCategory: record.roleCategory
        ? normalizeRoleCategory(record.roleCategory)
        : normalizeRoleCategory(record.roleTitle || ""),
      externalJobId: record.externalJobId?.trim() || "",
      externalJobUrl: record.externalJobUrl?.trim() || "",
      interviewStatus: "pending",
      scoreStatus: "pending",
      status: "pending",
      recruiterOwnerId: RECRUITER_EMAIL,
      createdAt: now,
      updatedAt: now,
    });

    batchCount++;
    imported++;

    // Firestore batches limited to 500
    if (batchCount >= 490) {
      await batch.commit();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  return { imported, skipped, errors };
}

export async function getApplications(filters?: {
  roleCategory?: string;
  companyName?: string;
  sourcePlatform?: string;
  roleTitle?: string;
  status?: string;
  interviewStatus?: string;
}): Promise<ExternalApplication[]> {
  let query: FirebaseFirestore.Query = db.collection(COLLECTION);

  if (filters?.roleCategory) query = query.where("roleCategory", "==", filters.roleCategory);
  if (filters?.companyName) query = query.where("companyName", "==", filters.companyName);
  if (filters?.sourcePlatform) query = query.where("sourcePlatform", "==", filters.sourcePlatform);
  if (filters?.status) query = query.where("status", "==", filters.status);
  if (filters?.interviewStatus) query = query.where("interviewStatus", "==", filters.interviewStatus);

  const snapshot = await query.get();

  let results = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ExternalApplication[];

  // Filter roleTitle in memory (Firestore doesn't support substring match)
  if (filters?.roleTitle) {
    const lower = filters.roleTitle.toLowerCase();
    results = results.filter((r) => r.roleTitle.toLowerCase().includes(lower));
  }

  return results.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getApplication(id: string): Promise<ExternalApplication | null> {
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as ExternalApplication;
}

export async function updateApplicationStatus(
  applicationId: string,
  updates: Partial<Pick<ExternalApplication, "status" | "interviewStatus" | "scoreStatus" | "interviewId" | "inviteLink" | "scoreId">>
): Promise<void> {
  await db
    .collection(COLLECTION)
    .doc(applicationId)
    .update({ ...updates, updatedAt: new Date().toISOString() });
}

export async function getDistinctValues(): Promise<{
  roleCategories: string[];
  companies: string[];
  sources: string[];
}> {
  const snapshot = await db.collection(COLLECTION).get();
  const roles = new Set<string>();
  const companies = new Set<string>();
  const sources = new Set<string>();

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (data.roleCategory) roles.add(data.roleCategory);
    if (data.companyName) companies.add(data.companyName);
    if (data.sourcePlatform) sources.add(data.sourcePlatform);
  });

  return {
    roleCategories: Array.from(roles).sort(),
    companies: Array.from(companies).sort(),
    sources: Array.from(sources).sort(),
  };
}

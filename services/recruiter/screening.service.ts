import { db } from "@/services/firebase/admin";
import { Screening, ScreeningResult } from "@/types/recruiter";
import { jobService } from "./job.service";
import { applicantService } from "./applicant.service";
import { GoogleGenerativeAI } from "@google/generative-ai";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://zen-ai-zeta.vercel.app";

class ScreeningService {
  private readonly SCREENINGS = "screenings";
  private readonly RESULTS = "screening_results";
  private readonly INTERVIEWS = "interviews";

  private getGenAI(): GoogleGenerativeAI | null {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) return null;
    return new GoogleGenerativeAI(apiKey);
  }

  async assignInterviewsToApplicants(
    jobId: string,
    applicantIds: string[]
  ): Promise<{ assigned: number; failed: number; errors: string[] }> {
    let assigned = 0;
    let failed = 0;
    const errors: string[] = [];

    const job = await jobService.getJob(jobId);
    if (!job) {
      return { assigned: 0, failed: applicantIds.length, errors: ["Job not found"] };
    }

    const genAI = this.getGenAI();

    for (const applicantId of applicantIds) {
      try {
        const applicant = await applicantService.getApplicant(applicantId);
        if (!applicant) {
          failed++;
          errors.push(`Applicant ${applicantId} not found`);
          continue;
        }

        // Skip already-assigned applicants
        if (applicant.interviewId) {
          errors.push(`Applicant ${applicant.name} already has an interview assigned`);
          failed++;
          continue;
        }

        // Generate questions using Gemini
        let questions: string[] = [];
        try {
          questions = await this.generateQuestions(genAI, job);
        } catch (err) {
          console.error("Failed to generate questions via AI, using fallback:", err);
          questions = this.getFallbackQuestions(job.type, job.requiredSkills);
        }

        // Create interview in interviews collection
        const interviewRef = await db.collection(this.INTERVIEWS).add({
          role: job.title,
          level: job.experienceLevel,
          questions,
          techstack: job.requiredSkills,
          createdAt: new Date().toISOString(),
          userId: null, // Filled once candidate takes interview
          type: job.type,
          finalized: true,
          jobId: jobId,
          applicantId: applicantId,
        });

        const inviteLink = `${APP_URL}/interview/${interviewRef.id}?candidate=${applicantId}`;

        // Create screening record
        await db.collection(this.SCREENINGS).add({
          jobId,
          applicantId,
          interviewId: interviewRef.id,
          status: "pending",
          inviteLink,
          createdAt: new Date().toISOString(),
        });

        // Update applicant with interview reference
        await applicantService.updateApplicantStatus(applicantId, "invited", {
          interviewId: interviewRef.id,
        });

        // Log the invite link (email integration deferred post-hackathon)
        console.log(
          `[ZenAI Screening] Invite for ${applicant.name} (${applicant.email}): ${inviteLink}`
        );

        assigned++;
      } catch (err) {
        console.error(`Error assigning interview to ${applicantId}:`, err);
        failed++;
        errors.push(`Failed for applicant ${applicantId}: ${(err as Error).message}`);
      }
    }

    return { assigned, failed, errors };
  }

  private async generateQuestions(
    genAI: GoogleGenerativeAI | null,
    job: { title: string; experienceLevel: string; requiredSkills: string[]; type: string }
  ): Promise<string[]> {
    if (!genAI) throw new Error("AI service not configured");

    const prompt = `Generate 5 interview questions for a ${job.experienceLevel} ${job.title} position.
Required skills: ${job.requiredSkills.join(", ")}.
Interview type: ${job.type}.

Return ONLY a JSON array of strings, each being one interview question. Example:
["Question 1?", "Question 2?", "Question 3?", "Question 4?", "Question 5?"]

Make questions specific, practical, and relevant to the role and skills listed.`;

        function normalizeFeedbackModel(model?: string): string {
          const value = String(model || "").trim();
          if (!value) return "gemini-3-flash";
          if (value.includes("gemini-2.0-flash") || value.includes("gemini-2.5-flash")) {
            return "gemini-3-flash";
          }
          if (value === "gemini-3.0-flash") {
            return "gemini-3-flash";
          }
          return value;
        }

    const modelCandidates = Array.from(
      new Set([
            normalizeFeedbackModel(process.env.GOOGLE_AI_FEEDBACK_MODEL),
        "gemini-3-flash",
        "gemini-1.5-flash",
      ])
    ).filter(Boolean);

    let lastError: unknown = null;

    for (const modelName of modelCandidates) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error("No JSON array in response");
        const questions = JSON.parse(jsonMatch[0]) as string[];
        if (questions.length >= 3) return questions;
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error("All AI models failed to generate questions");
  }

  private getFallbackQuestions(type: string, skills: string[]): string[] {
    const skillStr = skills.slice(0, 3).join(", ");
    if (type === "technical") {
      return [
        `Explain the key concepts of ${skillStr} and how they relate.`,
        `Walk me through how you would design a scalable API using ${skills[0] || "your preferred technology"}.`,
        `Describe a challenging bug you encountered in ${skills[0] || "a production system"} and how you resolved it.`,
        `How do you approach testing and quality assurance in your projects?`,
        `What are some best practices you follow when working with ${skillStr}?`,
      ];
    } else if (type === "behavioral") {
      return [
        "Tell me about a time you had a disagreement with a team member. How did you resolve it?",
        "Describe a project where you had to learn a new technology quickly. What was your approach?",
        "Give me an example of a time you took initiative beyond your job description.",
        "Tell me about a failure and what you learned from it.",
        "How do you prioritize when you have multiple urgent tasks?",
      ];
    }
    return [
      `Tell me about your experience with ${skillStr}.`,
      "Describe a project you're most proud of and why.",
      `How would you approach building a feature using ${skills[0] || "modern technologies"}?`,
      "Tell me about a time you faced a tight deadline. How did you manage?",
      "What's your approach to learning new technologies?",
    ];
  }

  async recordScreeningResult(data: Omit<ScreeningResult, "id" | "createdAt">): Promise<string> {
    const docRef = await db.collection(this.RESULTS).add({
      ...data,
      createdAt: new Date().toISOString(),
    });

    // Update applicant status
    await applicantService.updateApplicantStatus(data.applicantId, "completed", {
      screeningResultId: docRef.id,
    });

    // Update screening status
    const screeningSnapshot = await db
      .collection(this.SCREENINGS)
      .where("applicantId", "==", data.applicantId)
      .where("jobId", "==", data.jobId)
      .limit(1)
      .get();

    if (!screeningSnapshot.empty) {
      await screeningSnapshot.docs[0].ref.update({
        status: "completed",
        completedAt: new Date().toISOString(),
      });
    }

    return docRef.id;
  }

  async getScreeningResults(applicantId: string): Promise<ScreeningResult | null> {
    const snapshot = await db
      .collection(this.RESULTS)
      .where("applicantId", "==", applicantId)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as ScreeningResult;
  }

  async getScreeningsByJob(jobId: string): Promise<Screening[]> {
    const snapshot = await db
      .collection(this.SCREENINGS)
      .where("jobId", "==", jobId)
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Screening[];
  }

  async getResultsByJob(jobId: string): Promise<ScreeningResult[]> {
    const snapshot = await db
      .collection(this.RESULTS)
      .where("jobId", "==", jobId)
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ScreeningResult[];
  }
}

export const screeningService = new ScreeningService();

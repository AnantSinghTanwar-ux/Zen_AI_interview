import { NextRequest, NextResponse } from "next/server";
import { recruiterGuard } from "@/app/api/v2/recruiter/_guard";
import { getApplication, updateApplicationStatus } from "@/services/recruiter/external-application.service";
import { db } from "@/services/firebase/admin";
import { GoogleGenerativeAI } from "@google/generative-ai";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://zen-ai-zeta.vercel.app";

async function generateQuestions(roleTitle: string, roleCategory: string): Promise<string[]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return getDefaultQuestions(roleCategory);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    const prompt = `Generate 5 interview questions for a ${roleTitle} (${roleCategory}) position.
Return ONLY a JSON array of question strings. Make them practical and specific.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON");
    const questions = JSON.parse(match[0]) as string[];
    return questions.length >= 3 ? questions : getDefaultQuestions(roleCategory);
  } catch {
    return getDefaultQuestions(roleCategory);
  }
}

function getDefaultQuestions(category: string): string[] {
  const defaults: Record<string, string[]> = {
    backend: [
      "Explain how you would design a scalable REST API.",
      "What are the key differences between SQL and NoSQL databases?",
      "How do you handle error handling and logging in microservices?",
      "Describe your experience with caching strategies.",
      "Walk through how you would debug a performance issue in production.",
    ],
    frontend: [
      "How do you approach state management in large React applications?",
      "Explain the virtual DOM and its performance implications.",
      "How do you ensure accessibility in your web applications?",
      "Describe your approach to responsive design.",
      "How do you optimize frontend performance?",
    ],
  };
  return defaults[category] || defaults.backend;
}

export async function POST(request: NextRequest) {
  const { error } = await recruiterGuard();
  if (error) return error;

  try {
    const { applicationIds } = await request.json();
    if (!applicationIds?.length) {
      return NextResponse.json({ error: "applicationIds required" }, { status: 400 });
    }

    let assigned = 0;
    let failed = 0;
    const results: { id: string; inviteLink?: string; error?: string }[] = [];

    for (const appId of applicationIds) {
      try {
        const app = await getApplication(appId);
        if (!app) {
          failed++;
          results.push({ id: appId, error: "Not found" });
          continue;
        }

        if (app.interviewId) {
          failed++;
          results.push({ id: appId, error: "Already assigned" });
          continue;
        }

        // Generate questions
        const questions = await generateQuestions(app.roleTitle, app.roleCategory);

        // Create interview in interviews collection
        const interviewRef = await db.collection("interviews").add({
          role: app.roleTitle,
          level: "mid",
          questions,
          techstack: [app.roleCategory],
          createdAt: new Date().toISOString(),
          userId: null,
          type: "mixed",
          finalized: true,
          applicationId: appId,
          externalSource: true,
        });

        const inviteLink = `${APP_URL}/interview/${interviewRef.id}?candidate=${appId}`;

        // Update application
        await updateApplicationStatus(appId, {
          interviewId: interviewRef.id,
          interviewStatus: "invited",
          inviteLink,
          status: "invited",
        });

        assigned++;
        results.push({ id: appId, inviteLink });

        console.log(`[ZenAI] Interview assigned: ${app.candidateName} → ${inviteLink}`);
      } catch (err) {
        failed++;
        results.push({ id: appId, error: (err as Error).message });
      }
    }

    return NextResponse.json({ assigned, failed, results }, { status: 200 });
  } catch (err) {
    console.error("Interview assign error:", err);
    return NextResponse.json({ error: "Failed", details: (err as Error).message }, { status: 500 });
  }
}

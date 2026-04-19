import { NextRequest, NextResponse } from "next/server";
import { recruiterGuard } from "@/app/api/v2/recruiter/_guard";
import { getApplication, updateApplicationStatus } from "@/services/recruiter/external-application.service";
import { db } from "@/services/firebase/admin";
import { checkRateLimit } from "@/lib/services/rate-limit.service";
import {
  generateOpenRouterJson,
  getOpenRouterModelCandidates,
  hasOpenRouterKey,
} from "@/services/ai/openrouter-client";
import {
  acquireIdempotencyLock,
  completeIdempotencyLock,
  failIdempotencyLock,
  IdempotencyToken,
} from "@/lib/services/idempotency.service";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://zen-ai-zeta.vercel.app";

async function generateQuestions(roleTitle: string, roleCategory: string): Promise<string[]> {
  if (!hasOpenRouterKey()) {
    return getDefaultQuestions(roleCategory);
  }

  try {
    const prompt = `Generate 5 interview questions for a ${roleTitle} (${roleCategory}) position.
Return ONLY a JSON array of question strings. Make them practical and specific.`;

    const response = await generateOpenRouterJson<any>({
      prompt: `${prompt}\nJSON format: {"questions": ["Question 1", "Question 2"]}`,
      modelCandidates: getOpenRouterModelCandidates(
        process.env.OPENROUTER_MODEL,
        process.env.GOOGLE_AI_FEEDBACK_MODEL,
        "openrouter/auto"
      ),
      temperature: 0.2,
      maxTokens: 800,
    });

    const questions = Array.isArray(response?.questions)
      ? (response.questions as string[])
      : [];

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
  let idempotencyToken: IdempotencyToken | null = null;

  const { user, error } = await recruiterGuard();
  if (error) return error;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed, response } = await checkRateLimit(request, user.id, "recruiter-write");
  if (!allowed) return response!;

  try {
    const idempotency = await acquireIdempotencyLock({
      request,
      userId: user.id,
      scope: "recruiter:interview:assign",
    });

    if (idempotency.state === "invalid") {
      return NextResponse.json({ error: idempotency.error }, { status: 400 });
    }

    if (idempotency.state === "in-progress") {
      return NextResponse.json(
        {
          error: "Idempotent request is already being processed",
          retryAfter: idempotency.retryAfterSeconds,
        },
        {
          status: 409,
          headers: {
            "Retry-After": String(idempotency.retryAfterSeconds),
          },
        }
      );
    }

    if (idempotency.state === "replay") {
      return NextResponse.json(idempotency.body, { status: idempotency.status });
    }

    if (idempotency.state === "acquired") {
      idempotencyToken = idempotency.token;
    }

    const { applicationIds } = await request.json();
    if (!applicationIds?.length) {
      if (idempotencyToken) {
        await failIdempotencyLock({
          token: idempotencyToken,
          error: "applicationIds required",
        });
      }
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

    const payload = { assigned, failed, results };

    if (idempotencyToken) {
      await completeIdempotencyLock({
        token: idempotencyToken,
        status: 200,
        body: payload,
      });
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("Interview assign error:", err);

    if (idempotencyToken) {
      await failIdempotencyLock({
        token: idempotencyToken,
        error: err,
      });
    }

    return NextResponse.json({ error: "Failed", details: (err as Error).message }, { status: 500 });
  }
}

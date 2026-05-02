import { NextRequest } from "next/server";

import { getRandomInterviewCover } from "@/lib/utils";
import { db } from "@/services/firebase/admin";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { checkRateLimit } from "@/lib/services/rate-limit.service";
import {
  generateOpenRouterJson,
  getOpenRouterModelCandidates,
} from "@/services/ai/openrouter-client";


export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { allowed, response } = await checkRateLimit(request, user.id, "vapi-generate");
  if (!allowed) return response!;

  return Response.json({ success: true, data: "Thank You" }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { allowed, response } = await checkRateLimit(request, user.id, "vapi-generate");
  if (!allowed) return response!;

  const payload = await request.json();
  const { type, role, level, techStack, amount, userId } = payload;

  // Premium check removed — all authenticated users have access

  try {
    const generated = await generateOpenRouterJson<any>({
      prompt: `
        Generate interview questions for the following job description.
        Job Type: ${type}
        Role: ${role}
        Level: ${level}
        Tech Stack: ${techStack}
        Number of Questions: ${amount}

        Return JSON in this format exactly:
        { "questions": ["question1", "question2", "question3"] }
      `,
      modelCandidates: getOpenRouterModelCandidates(
        process.env.OPENROUTER_MODEL,
        process.env.GOOGLE_AI_FEEDBACK_MODEL,
        "openrouter/auto"
      ),
      temperature: 0.2,
      maxTokens: 1_400,
    });

    const questions = Array.isArray(generated?.questions)
      ? (generated.questions as string[]).map((question) => String(question).trim()).filter(Boolean)
      : [];

    if (questions.length === 0) {
      throw new Error("No interview questions generated");
    }

    console.log(questions);

    const interview = {
      role,
      type,
      level,
      techstacl: techStack.split(","),
      questions,
      userId: userId || user.id,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.collection("interviews").add(interview);

    return Response.json(
      { success: true, questions },
      { status: 200 }
    );
  } catch (e) {
    console.error(e);
    return Response.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

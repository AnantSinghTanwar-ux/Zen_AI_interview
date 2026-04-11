import { NextRequest } from "next/server";

import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { getRandomInterviewCover } from "@/lib/utils";
import { db } from "@/services/firebase/admin";

export async function GET() {
  return Response.json({ success: true, data: "Thank You" }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const { type, role, level, techStack, amount, userId } = await request.json();

  try {
    const { text: questions } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt: `
        Generate interview questions for the following job description, and return ONLY the questions in format like this: [question1, question2, question3].
        Job Type: ${type}
        Role: ${role}
        Level: ${level}
        Tech Stack: ${techStack}
        Number of Questions: ${amount}
      `,
    });

    console.log(questions);

    const interview = {
      role,
      type,
      level,
      techstacl: techStack.split(","),
      questions: JSON.parse(questions),
      userId,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.collection("interviews").add(interview);

    return Response.json(
      { success: true, questions: questions },
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

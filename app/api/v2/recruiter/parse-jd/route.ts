import { NextRequest, NextResponse } from "next/server";
import { generateOpenRouterJson } from "@/services/ai/openrouter-client";
import { extractTextFromBuffer } from "@/services/recruiter/resume-extractor.service";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    
    let promptContent: any;

    const SYSTEM_PROMPT = `You are an expert HR and recruitment AI. Extract the job description details into a JSON object matching this schema exactly:
{
  "title": "<string, the job title>",
  "description": "<string, the full job description summary>",
  "requiredSkills": ["<skill1>", "<skill2>"],
  "experienceLevel": "<junior|mid|senior|lead>"
}
Ensure the output is ONLY valid JSON. Infer the closest experienceLevel if not explicitly stated.`;

    if (ext === "pdf" || ext === "txt" || ext === "docx" || ext === "doc") {
      const text = await extractTextFromBuffer(buffer, file.name);
      promptContent = `Extract the details from this job description:\n\n${text}`;
    } else if (["png", "jpg", "jpeg", "webp"].includes(ext)) {
      const base64 = buffer.toString("base64");
      const mimeType = file.type || `image/${ext}`;
      promptContent = [
        { type: "text", text: "Extract the details from this job description image." },
        {
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${base64}` },
        },
      ];
    } else {
      return NextResponse.json(
        { error: `Unsupported file type: .${ext}` },
        { status: 400 }
      );
    }

    const parsed = await generateOpenRouterJson<{
      title: string;
      description: string;
      requiredSkills: string[];
      experienceLevel: string;
    }>({
      prompt: promptContent,
      systemPrompt: SYSTEM_PROMPT,
      modelCandidates: ["openai/gpt-4o-mini", process.env.OPENROUTER_MODEL],
      temperature: 0.1, // Low temperature for extraction
    });

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[ParseJD] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse JD" },
      { status: 500 }
    );
  }
}

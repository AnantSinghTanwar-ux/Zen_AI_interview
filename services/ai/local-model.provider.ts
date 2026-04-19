import type { AIProvider, FeedbackAnalysis, EmotionAnalysis } from "./ai-provider";
import { applyHarshFeedbackGuardrails } from "./analysis-guardrails";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const MODEL_NAME = process.env.LOCAL_MODEL_NAME || "mistral:7b";
const REQUEST_TIMEOUT_MS = 45_000;

async function ollamaGenerate(prompt: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL_NAME,
        prompt,
        stream: false,
        options: { temperature: 0.7 },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { response: string };
    return data.response;
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in local model response");
  return JSON.parse(match[0]);
}

export const localModelProvider: AIProvider = {
  async generateFeedback(transcript: string): Promise<FeedbackAnalysis> {
    const prompt = `You are a strict hiring-panel evaluator.

MANDATORY RULES:
- Score only explicit transcript evidence.
- Resume references are not technical proof.
- Be harsh and realistic (no inflated scores).
- If technical depth is missing, technicalScore MUST be <= 35.
- If no concrete solution walkthrough exists, problemSolvingScore MUST be <= 35.

Analyze this interview transcript and respond with ONLY valid JSON:
{
  "overallScore": <number 0-100>,
  "communicationScore": <number 0-100>,
  "technicalScore": <number 0-100>,
  "problemSolvingScore": <number 0-100>,
  "confidenceScore": <number 0-100>,
  "strengths": ["<strength>"],
  "weaknesses": ["<weakness>"],
  "suggestions": ["<suggestion>"],
  "nextSteps": ["<step>"],
  "aiSummary": "<2-3 sentence summary>",
  "personalizedPlan": ["<goal>"]
}

Transcript:
${transcript.slice(0, 4000)}

Return ONLY the JSON object.`;

    const text = await ollamaGenerate(prompt);
    const parsed = extractJson(text) as FeedbackAnalysis;
    return applyHarshFeedbackGuardrails(parsed, transcript) as FeedbackAnalysis;
  },

  async analyzeEmotion(text: string): Promise<EmotionAnalysis> {
    const prompt = `Analyze the emotional tone of this text and respond with ONLY valid JSON:
{
  "sentiment": "<positive|neutral|negative>",
  "confidence": <number 0-1>,
  "dominantEmotion": "<emotion>",
  "emotions": [{"name": "<emotion>", "score": <0-1>}]
}

Text: ${text.slice(0, 1000)}

Return ONLY the JSON.`;

    const response = await ollamaGenerate(prompt);
    return extractJson(response) as EmotionAnalysis;
  },

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 3_000);
      const resp = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: controller.signal });
      if (!resp.ok) return false;
      const data = (await resp.json()) as { models: Array<{ name: string }> };
      return data.models.some((m) => m.name.includes(MODEL_NAME.split(":")[0]));
    } catch {
      return false;
    }
  },

  getName(): string {
    return `local:${MODEL_NAME}`;
  },
};

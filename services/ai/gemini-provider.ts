import {
  getOpenRouterModelCandidates,
  hasOpenRouterKey,
  openRouterChatCompletion,
} from "./openrouter-client";
import type { AIProvider, FeedbackAnalysis, EmotionAnalysis } from "./ai-provider";
import { applyHarshFeedbackGuardrails } from "./analysis-guardrails";

function normalizeFeedbackModel(model?: string): string {
  const value = String(model || "").trim();
  if (!value) return process.env.OPENROUTER_MODEL || "openrouter/auto";

  if (value.toLowerCase().includes("gemini")) {
    return process.env.OPENROUTER_MODEL || "openrouter/auto";
  }

  return value;
}

const MODEL_CANDIDATES = getOpenRouterModelCandidates(
  process.env.OPENROUTER_HARSH_ANALYSIS_MODEL,
  process.env.OPENROUTER_EVALUATION_MODEL,
  "openai/gpt-4.1-mini",
  normalizeFeedbackModel(process.env.GOOGLE_AI_FEEDBACK_MODEL),
  process.env.OPENROUTER_MODEL,
  "openrouter/auto"
);

async function callOpenRouter(prompt: string): Promise<string> {
  return openRouterChatCompletion({
    messages: [{ role: "user", content: prompt }],
    modelCandidates: MODEL_CANDIDATES,
    temperature: 0.2,
    maxTokens: 2_048,
  });
}

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in OpenRouter response");
  return JSON.parse(match[0]);
}

export const geminiProvider: AIProvider = {
  async generateFeedback(transcript: string): Promise<FeedbackAnalysis> {
    const prompt = `You are a strict hiring-panel evaluator.

MANDATORY RULES:
1) Evidence-only scoring from transcript content.
2) Resume references are not technical proof.
3) Use conservative, harsh real-world standards.
4) If technical depth is absent, technicalScore MUST be <= 35.
5) If no concrete solution walkthrough exists, problemSolvingScore MUST be <= 35.

Analyze this interview transcript and respond with ONLY valid JSON matching this schema exactly:
{
  "overallScore": <number 0-100>,
  "communicationScore": <number 0-100>,
  "technicalScore": <number 0-100>,
  "problemSolvingScore": <number 0-100>,
  "confidenceScore": <number 0-100>,
  "strengths": ["<strength1>", "<strength2>", "<strength3>"],
  "weaknesses": ["<weakness1>", "<weakness2>"],
  "suggestions": ["<suggestion1>", "<suggestion2>", "<suggestion3>"],
  "nextSteps": ["<step1>", "<step2>"],
  "aiSummary": "<2-3 sentence summary>",
  "personalizedPlan": ["<goal1>", "<goal2>", "<goal3>"]
}

Transcript:
${transcript}

Return ONLY the JSON object, no markdown or extra text.`;

    const text = await callOpenRouter(prompt);
    const parsed = extractJson(text) as FeedbackAnalysis;
    return applyHarshFeedbackGuardrails(parsed, transcript) as FeedbackAnalysis;
  },

  async analyzeEmotion(text: string): Promise<EmotionAnalysis> {
    const prompt = `Analyze the emotional tone of this interview text and respond with ONLY valid JSON:
{
  "sentiment": "<positive|neutral|negative>",
  "confidence": <number 0-1>,
  "dominantEmotion": "<emotion name>",
  "emotions": [{"name": "<emotion>", "score": <0-1>}]
}

Text: ${text}

Return ONLY the JSON object.`;

    const response = await callOpenRouter(prompt);
    return extractJson(response) as EmotionAnalysis;
  },

  async isAvailable(): Promise<boolean> {
    return hasOpenRouterKey();
  },

  getName(): string {
    return `openrouter:${MODEL_CANDIDATES[0]}`;
  },
};

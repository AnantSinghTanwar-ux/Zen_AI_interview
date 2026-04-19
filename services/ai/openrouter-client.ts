type OpenRouterRole = "system" | "user" | "assistant";

export interface OpenRouterMessage {
  role: OpenRouterRole;
  content: string;
}

export interface OpenRouterRequestOptions {
  messages: OpenRouterMessage[];
  modelCandidates?: Array<string | undefined | null>;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

const DEFAULT_MODEL_FALLBACK = "openrouter/auto";

function normalizeModel(model?: string | null): string {
  const value = String(model || "").trim();
  if (!value) return DEFAULT_MODEL_FALLBACK;

  const lower = value.toLowerCase();
  if (lower.includes("gemini")) {
    return process.env.OPENROUTER_MODEL || DEFAULT_MODEL_FALLBACK;
  }

  return value;
}

export function getOpenRouterModelCandidates(
  ...candidates: Array<string | undefined | null>
): string[] {
  const values = [
    ...candidates,
    process.env.OPENROUTER_MODEL,
    process.env.GOOGLE_AI_FEEDBACK_MODEL,
    DEFAULT_MODEL_FALLBACK,
  ]
    .map((candidate) => normalizeModel(candidate))
    .filter(Boolean);

  return Array.from(new Set(values));
}

function isTransientFailure(status?: number, message?: string): boolean {
  if (typeof status === "number" && (status === 429 || status >= 500)) {
    return true;
  }

  const lower = String(message || "").toLowerCase();
  return (
    lower.includes("429") ||
    lower.includes("timeout") ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("temporarily unavailable") ||
    lower.includes("service unavailable")
  );
}

function extractAssistantText(payload: any): string {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();

    if (text) return text;
  }

  throw new Error("OpenRouter returned an empty response payload");
}

function parseJsonFromText<T>(text: string): T {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("No JSON object found in OpenRouter response");
  }

  const jsonSlice = text.slice(firstBrace, lastBrace + 1);
  return JSON.parse(jsonSlice) as T;
}

export function hasOpenRouterKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export async function openRouterChatCompletion(
  options: OpenRouterRequestOptions
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const modelCandidates = getOpenRouterModelCandidates(...(options.modelCandidates || []));
  const timeoutMs = options.timeoutMs || 30_000;
  let lastError: unknown = null;

  for (const model of modelCandidates) {
    let retries = 2;
    let delayMs = 1_200;

    while (retries >= 0) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
          method: "POST",
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
            "X-Title": "ZenAI",
          },
          body: JSON.stringify({
            model,
            messages: options.messages,
            temperature: options.temperature ?? 0.2,
            max_tokens: options.maxTokens ?? 2_048,
          }),
        });

        clearTimeout(timer);

        if (!response.ok) {
          const bodyText = await response.text();
          const errorMessage = `OpenRouter ${response.status}: ${bodyText}`;

          if (!isTransientFailure(response.status, errorMessage) || retries === 0) {
            throw new Error(errorMessage);
          }

          await new Promise((resolve) => setTimeout(resolve, delayMs));
          retries -= 1;
          delayMs *= 2;
          continue;
        }

        const payload = await response.json();
        return extractAssistantText(payload);
      } catch (error) {
        clearTimeout(timer);
        lastError = error;

        const message = error instanceof Error ? error.message : String(error);
        if (!isTransientFailure(undefined, message) || retries === 0) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
        retries -= 1;
        delayMs *= 2;
      }
    }
  }

  throw lastError || new Error("All OpenRouter model candidates failed");
}

export async function generateOpenRouterJson<T>(params: {
  prompt: string;
  systemPrompt?: string;
  modelCandidates?: Array<string | undefined | null>;
  temperature?: number;
  maxTokens?: number;
}): Promise<T> {
  const messages: OpenRouterMessage[] = [];

  if (params.systemPrompt?.trim()) {
    messages.push({ role: "system", content: params.systemPrompt.trim() });
  }

  messages.push({ role: "user", content: params.prompt });

  const text = await openRouterChatCompletion({
    messages,
    modelCandidates: params.modelCandidates,
    temperature: params.temperature,
    maxTokens: params.maxTokens,
  });

  return parseJsonFromText<T>(text);
}

/**
 * AI Provider Abstraction Layer
 *
 * Supports a primary provider (OpenRouter or local Ollama) with automatic
 * fallback to a secondary provider when the primary is unavailable.
 *
 * Configured via env vars:
 *   AI_PROVIDER          — "openrouter" | "local" | "gemini"  (default: "openrouter")
 *   AI_PROVIDER_FALLBACK — "openrouter" | "gemini" | "local"  (default: "local")
 */

export interface FeedbackAnalysis {
  overallScore: number;
  communicationScore: number;
  technicalScore: number;
  problemSolvingScore: number;
  confidenceScore: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  nextSteps: string[];
  aiSummary: string;
  personalizedPlan: string[];
}

export interface EmotionAnalysis {
  sentiment: "positive" | "neutral" | "negative";
  confidence: number;
  dominantEmotion: string;
  emotions: Array<{ name: string; score: number }>;
}

export interface AIProvider {
  generateFeedback(transcript: string): Promise<FeedbackAnalysis>;
  analyzeEmotion(text: string): Promise<EmotionAnalysis>;
  isAvailable(): Promise<boolean>;
  getName(): string;
}

// ---------------------------------------------------------------------------
// Lazy-load concrete providers so we don't pull in packages at module scope.
// ---------------------------------------------------------------------------

let _gemini: AIProvider | null = null;
let _local: AIProvider | null = null;

function getGemini(): AIProvider {
  if (!_gemini) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _gemini = require("./gemini-provider").geminiProvider;
  }
  return _gemini!;
}

function getLocal(): AIProvider {
  if (!_local) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _local = require("./local-model.provider").localModelProvider;
  }
  return _local!;
}

function resolveProvider(name: string): AIProvider {
  const normalized = String(name || "").trim().toLowerCase();
  return normalized === "local" ? getLocal() : getGemini();
}

// ---------------------------------------------------------------------------
// Provider Manager — tries primary, falls back to secondary.
// ---------------------------------------------------------------------------

class ProviderManager implements AIProvider {
  private get primary(): AIProvider {
    return resolveProvider(process.env.AI_PROVIDER || "openrouter");
  }

  private get fallback(): AIProvider {
    return resolveProvider(process.env.AI_PROVIDER_FALLBACK || "local");
  }

  async generateFeedback(transcript: string): Promise<FeedbackAnalysis> {
    // Try primary
    try {
      if (await this.primary.isAvailable()) {
        console.log(`[AI] Using primary provider: ${this.primary.getName()}`);
        return await this.primary.generateFeedback(transcript);
      }
    } catch (err) {
      console.error(`[AI] Primary provider (${this.primary.getName()}) failed:`, (err as Error)?.message);
    }

    // Fallback
    console.log(`[AI] Falling back to: ${this.fallback.getName()}`);
    return await this.fallback.generateFeedback(transcript);
  }

  async analyzeEmotion(text: string): Promise<EmotionAnalysis> {
    try {
      if (await this.primary.isAvailable()) {
        return await this.primary.analyzeEmotion(text);
      }
    } catch (err) {
      console.error(`[AI] Primary emotion analysis failed:`, (err as Error)?.message);
    }

    return await this.fallback.analyzeEmotion(text);
  }

  async isAvailable(): Promise<boolean> {
    return (await this.primary.isAvailable()) || (await this.fallback.isAvailable());
  }

  getName(): string {
    return this.primary.getName();
  }
}

export const aiProvider = new ProviderManager();

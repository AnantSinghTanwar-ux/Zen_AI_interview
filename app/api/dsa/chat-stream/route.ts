import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { checkRateLimit } from "@/lib/services/rate-limit.service";
import { getPremiumSession } from "@/lib/services/payment.service";

/**
 * DSA Practice Chat Stream — powered by OpenRouter (cost-optimized)
 * Uses google/gemini-2.0-flash via OpenRouter for ~$0.10/M tokens
 * Message limit: 60 per session (prevents exploitation)
 */

const DSA_SYSTEM_PROMPT = `You are ZenAI's DSA Coach — a world-class Data Structures & Algorithms tutor and interview coach.

## YOUR TEACHING PHILOSOPHY
- You TEACH, not just evaluate. Your goal is to make the student genuinely better.
- Use the Socratic method: ask guiding questions instead of giving direct answers.
- When a student is stuck, give a small hint first. Only give larger hints if they're still stuck after trying.
- Always explain the "WHY" behind every concept — not just the "WHAT".

## WHEN PRESENTING A PROBLEM
1. State the problem clearly with 2-3 examples (input/output).
2. Mention constraints (array size, value ranges, etc.).
3. Ask: "What's the first approach that comes to mind? Don't worry if it's brute force — let's start there."

## WHEN REVIEWING THEIR APPROACH
1. Acknowledge what's correct first (positive reinforcement).
2. If the approach works but is suboptimal, say: "This works! But can we do better? Think about [specific data structure/pattern]."
3. Point out edge cases they might have missed.
4. Always state the time/space complexity and ask if they can identify it themselves.

## WHEN REVIEWING CODE
1. Check correctness first — does it handle all cases?
2. Point out specific bugs with line references.
3. Suggest idiomatic improvements (variable names, structure).
4. Compare their complexity with the optimal solution.
5. If the code is good, praise them and discuss follow-up variations.

## INTERVIEW TIPS (sprinkle naturally)
- "In a real interview, the interviewer wants to see your thought process, so thinking aloud is great."
- "Pro tip: Always ask about constraints before coding."
- "This is a classic [pattern name] pattern — recognizing these patterns will speed you up."

## RESPONSE STYLE
- Keep responses concise (150-300 words max unless reviewing code).
- Use bullet points and code snippets for clarity.
- Use markdown formatting for code blocks.
- Be encouraging but honest — don't inflate performance.
- End each response with a clear next step or question to keep the session moving.

## TOKEN EFFICIENCY
- Don't repeat the entire problem statement in every response.
- Reference previous discussion by summary, not by copying.
- Give focused, actionable feedback rather than long explanations.`;

interface ChatHistory {
  role: "system" | "user" | "assistant";
  content: string;
}

// In-memory chat history store (per-session, cleared on restart)
const chatSessions = new Map<string, ChatHistory[]>();
// Track message count per session
const sessionMessageCounts = new Map<string, number>();

const MAX_MESSAGES_PER_SESSION = 60;

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { allowed, response } = await checkRateLimit(request, user.id, "dsa-chat-stream");
    if (!allowed) return response!;

    const { message, chatId, stage, codeContent, premiumUsageKey } = await request.json();

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return new Response("OpenRouter API key not configured", { status: 500 });
    }

    if (!premiumUsageKey || typeof premiumUsageKey !== "string") {
      return new Response(
        JSON.stringify({
          error: "PREMIUM_REQUIRED",
          message: "Purchase a DSA Practice session to continue.",
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    const premiumSession = await getPremiumSession(premiumUsageKey);
    if (!premiumSession || premiumSession.userId !== user.id || premiumSession.feature !== "dsa-practice") {
      return new Response(
        JSON.stringify({
          error: "INVALID_SESSION",
          message: "Your DSA session is not valid. Please start a new session.",
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    if (Date.now() > premiumSession.expiresAtMs) {
      return new Response(
        JSON.stringify({
          error: "SESSION_EXPIRED",
          message: "Your DSA session has expired. Purchase another session to continue.",
        }),
        { status: 402, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build or retrieve chat history (session scoped)
    const sessionId = premiumUsageKey || chatId || `dsa-${user.id}-${Date.now()}`;

    // Check message limit
    const maxMessages = premiumSession.messageLimit || MAX_MESSAGES_PER_SESSION;
    const currentCount = sessionMessageCounts.get(sessionId) || 0;
    if (currentCount >= maxMessages) {
      return new Response(
        JSON.stringify({
          error: "MESSAGE_LIMIT_REACHED",
          message: `You've used all ${maxMessages} messages for this session. Start a new session to continue practicing.`,
          messagesUsed: currentCount,
          messageLimit: maxMessages,
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    let history = chatSessions.get(sessionId) || [
      { role: "system" as const, content: DSA_SYSTEM_PROMPT },
    ];

    // Build user message — include code if provided
    let userMessage = message;
    if (codeContent && codeContent.trim()) {
      userMessage = `${message}\n\n--- My Code ---\n\`\`\`\n${codeContent}\n\`\`\``;
    }

    history.push({ role: "user", content: userMessage });

    // Keep history manageable (last 20 messages + system prompt)
    if (history.length > 22) {
      history = [history[0], ...history.slice(-20)];
    }

    chatSessions.set(sessionId, history);
    sessionMessageCounts.set(sessionId, currentCount + 1);

    // Call OpenRouter with streaming
    const orResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_BASE_URL || "https://zenai.app",
        "X-Title": "ZenAI DSA Practice",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: history,
        stream: true,
        max_tokens: 1500,
        temperature: 0.65,
      }),
    });

    if (!orResponse.ok) {
      const errText = await orResponse.text();
      console.error("OpenRouter error:", errText);
      throw new Error(`OpenRouter API error: ${orResponse.status}`);
    }

    // Transform OpenRouter SSE stream into our format
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const reader = orResponse.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let fullResponse = "";
        let buffer = "";

        // Send the session ID + message count
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            id: sessionId,
            messagesUsed: currentCount + 1,
            messageLimit: maxMessages,
          })}\n\n`)
        );

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed === "data: [DONE]") continue;
              if (!trimmed.startsWith("data: ")) continue;

              try {
                const data = JSON.parse(trimmed.slice(6));
                const delta = data.choices?.[0]?.delta?.content;
                if (delta) {
                  fullResponse += delta;
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ path: "output", delta })}\n\n`
                    )
                  );
                }
              } catch {
                // Skip malformed chunks
              }
            }
          }

          // Save assistant response to history
          if (fullResponse) {
            history.push({ role: "assistant", content: fullResponse });
            chatSessions.set(sessionId, history);
          }
        } catch (err) {
          console.error("Stream processing error:", err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("DSA chat stream error:", error);
    return new Response("Failed to process DSA chat", { status: 500 });
  }
}

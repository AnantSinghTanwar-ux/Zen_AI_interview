import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { checkRateLimit } from "@/lib/services/rate-limit.service";

/**
 * DSA Practice Chat Stream — powered by OpenRouter (cost-optimized)
 * Uses google/gemini-2.0-flash via OpenRouter for ~$0.10/M tokens
 * instead of Vapi which costs significantly more for text-only chat.
 */

const DSA_SYSTEM_PROMPT = `You are an expert Data Structures & Algorithms interviewer at a top tech company. Your role:

1. Present DSA problems clearly with constraints and examples
2. Ask clarifying questions when the candidate shares their approach
3. Evaluate their solution's correctness, time/space complexity
4. Provide hints if they're stuck (but don't give away the answer)
5. Discuss trade-offs between different approaches
6. Give constructive feedback on code quality and optimization

When reviewing code the candidate pastes:
- Check for correctness, edge cases, and bugs
- Analyze time and space complexity
- Suggest optimizations
- Point out any code style issues

Keep responses concise and focused. Act like a real interviewer — professional but helpful.`;

interface ChatHistory {
  role: "system" | "user" | "assistant";
  content: string;
}

// In-memory chat history store (per-session, cleared on restart)
const chatSessions = new Map<string, ChatHistory[]>();

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { allowed, response } = await checkRateLimit(request, user.id, "dsa-chat-stream");
    if (!allowed) return response!;

    const { message, chatId, stage, codeContent } = await request.json();

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return new Response("OpenRouter API key not configured", { status: 500 });
    }

    // Build or retrieve chat history
    const sessionId = chatId || `dsa-${user.id}-${Date.now()}`;
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
        max_tokens: 2048,
        temperature: 0.7,
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

        // Send the session ID first
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ id: sessionId })}\n\n`)
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

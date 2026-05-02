import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth.actions";
import { checkRateLimit } from "@/lib/services/rate-limit.service";


export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { allowed, response } = await checkRateLimit(request, user.id, "vapi-chat-stream");
    if (!allowed) return response!;

    const { message, previousChatId, stage, premiumUsageKey } = await request.json();

    // Premium check removed — all authenticated users have access

    const apiKey = process.env.VAPI_PRIVATE_API_KEY || "";
    if (!apiKey) {
      return new Response("Vapi API key not configured", { status: 500 });
    }

    // Create the chat request payload with streaming enabled
    const chatPayload: any = {
      assistantId: process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID,
      input: message,
      stream: true, // Enable streaming
      assistantOverrides: {
        variableValues: {
          interviewType: "DSA",
          stage: stage || "greeting",
        },
      },
    };

    if (previousChatId) {
      chatPayload.previousChatId = previousChatId;
    }

    // Send streaming request to Vapi
    const vapiResponse = await fetch("https://api.vapi.ai/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chatPayload),
    });

    if (!vapiResponse.ok) {
      throw new Error(`Vapi API error: ${vapiResponse.status}`);
    }

    // Return streaming response
    return new Response(vapiResponse.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });

  } catch (error) {
    console.error("Streaming chat error:", error);
    return new Response("Failed to process streaming chat", { status: 500 });
  }
}

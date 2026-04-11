import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { message, previousChatId, stage } = await request.json();

    const apiKey = process.env.VAPI_PRIVATE_API_KEY;
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
    const response = await fetch("https://api.vapi.ai/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chatPayload),
    });

    if (!response.ok) {
      throw new Error(`Vapi API error: ${response.status}`);
    }

    // Return streaming response
    return new Response(response.body, {
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

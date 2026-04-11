import { NextRequest, NextResponse } from "next/server";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatApiResponse {
  id: string;
  assistantId: string;
  messages: ChatMessage[];
  output: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

interface DSAQuestion {
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  problem: string;
  constraints?: string[];
  examples?: { input: string; output: string; explanation?: string }[];
}

export async function POST(request: NextRequest) {
  try {
    const { message, context, previousMessages, callId } = await request.json();

    // Get Vapi private API key
    const apiKey = process.env.VAPI_PRIVATE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Vapi API key not configured" },
        { status: 500 }
      );
    }

    // If this is a DSA response during an active call, send it to the assistant
    if (context === "dsa_interview_response" && callId) {
      try {
        // Send the user's DSA solution to the voice assistant
        const messagePayload = {
          type: "add-message",
          message: {
            role: "user",
            content: `[DSA SOLUTION]: ${message}`,
          }
        };

        // Send message to the active call
        const callResponse = await fetch(`https://api.vapi.ai/call/${callId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messagePayload),
        });

        if (callResponse.ok) {
          return NextResponse.json({
            response: "Your solution has been submitted to the interviewer.",
            success: true,
            submitted: true,
          });
        } else {
          // If call message fails, fall back to regular chat
          console.warn("Failed to send to call, using regular chat response");
        }
      } catch (error) {
        console.error("Error sending to call:", error);
        // Continue with regular chat processing
      }
    }

    // Regular chat processing for non-DSA contexts or when call submission fails
    const chatPayload: any = {
      assistantId: process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID,
      input: message,
      assistantOverrides: {
        variableValues: {
          interviewType: context === "dsa_interview_response" ? "DSA" : "general",
          stage: "response_analysis",
        },
      },
    };

    // Send request to Vapi Chat API
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

    const chatResponse: ChatApiResponse = await response.json();

    // Extract the assistant's response
    const assistantResponse = chatResponse.output[0]?.content || "Thank you for your solution.";

    return NextResponse.json({
      chatId: chatResponse.id,
      response: assistantResponse,
      success: true,
    });

  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Failed to process chat message", success: false },
      { status: 500 }
    );
  }
}

function parseQuestionFromResponse(response: string): DSAQuestion | null {
  try {
    // Basic parsing - in a real implementation, you might want more sophisticated parsing
    const lines = response.split('\n');
    let title = "";
    let difficulty: "Easy" | "Medium" | "Hard" = "Medium";
    let problem = "";
    let constraints: string[] = [];
    let examples: { input: string; output: string; explanation?: string }[] = [];

    let currentSection = "";
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.includes("**Problem:**") || trimmedLine.includes("Problem:")) {
        currentSection = "problem";
        title = trimmedLine.replace(/\*\*Problem:\*\*|Problem:/, "").trim();
      } else if (trimmedLine.includes("**Difficulty:**") || trimmedLine.includes("Difficulty:")) {
        const diffMatch = trimmedLine.match(/(Easy|Medium|Hard)/i);
        if (diffMatch) {
          difficulty = diffMatch[1] as "Easy" | "Medium" | "Hard";
        }
      } else if (trimmedLine.includes("**Examples:**") || trimmedLine.includes("Examples:")) {
        currentSection = "examples";
      } else if (trimmedLine.includes("**Constraints:**") || trimmedLine.includes("Constraints:")) {
        currentSection = "constraints";
      } else if (currentSection === "problem" && trimmedLine) {
        problem += trimmedLine + "\n";
      } else if (currentSection === "constraints" && trimmedLine.startsWith("-") || trimmedLine.startsWith("•")) {
        constraints.push(trimmedLine.replace(/^[-•]\s*/, ""));
      } else if (currentSection === "examples" && trimmedLine.includes("Input:")) {
        const inputMatch = trimmedLine.match(/Input:\s*(.+)/);
        if (inputMatch) {
          examples.push({ input: inputMatch[1], output: "" });
        }
      } else if (currentSection === "examples" && trimmedLine.includes("Output:") && examples.length > 0) {
        const outputMatch = trimmedLine.match(/Output:\s*(.+)/);
        if (outputMatch) {
          examples[examples.length - 1].output = outputMatch[1];
        }
      }
    }

    if (title && problem) {
      return {
        title: title || "Coding Problem",
        difficulty,
        problem: problem.trim(),
        constraints: constraints.length > 0 ? constraints : undefined,
        examples: examples.length > 0 ? examples : undefined,
      };
    }

    return null;
  } catch (error) {
    console.error("Error parsing question:", error);
    return null;
  }
}

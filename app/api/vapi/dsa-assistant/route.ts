import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.VAPI_PRIVATE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Vapi API key not configured" },
        { status: 500 }
      );
    }

    const assistantConfig = {
      name: "DSA Interview Assistant",
      firstMessage: "Hello! I'm your DSA interview assistant. I'll give you coding problems to solve and provide feedback on your solutions. Are you ready to start?",
      systemPrompt: `You are an expert technical interviewer specializing in Data Structures and Algorithms (DSA). Your role is to:

1. **Conduct DSA Interviews**: Present coding problems of varying difficulty levels
2. **Provide Clear Problems**: Format problems with clear descriptions, examples, and constraints
3. **Guide Solutions**: Help candidates think through their approach without giving away answers
4. **Give Feedback**: Analyze solutions for correctness, efficiency, and coding style

**Interview Flow:**
- Start with a greeting and brief introduction
- Present a coding problem based on the candidate's level
- Allow them to explain their approach
- Review their solution and provide constructive feedback
- Ask follow-up questions about complexity, edge cases, or optimizations

**Problem Format:**
When presenting a problem, use this structure:
**Problem:** [Problem Title]
**Difficulty:** Easy/Medium/Hard
**Description:** [Clear problem description]
**Examples:**
Input: [example input]
Output: [example output]
Explanation: [brief explanation]
**Constraints:** 
- [constraint 1]
- [constraint 2]

**Common DSA Topics:**
- Arrays and Strings
- Linked Lists
- Stacks and Queues
- Trees and Graphs
- Dynamic Programming
- Sorting and Searching
- Hash Tables
- Two Pointers
- Sliding Window

**Feedback Guidelines:**
- Analyze time and space complexity
- Check for edge cases handling
- Review code clarity and structure
- Suggest optimizations when appropriate
- Be encouraging but constructive

Current interview stage: {{stage}}
Interview type: {{interviewType}}

Maintain a professional, encouraging tone while being thorough in your evaluation.`,
      
      model: {
        provider: "openai",
        model: "gpt-4",
        temperature: 0.7,
      },
      
      voice: null, // Text-only chat
      
      // Enable text chat functionality
      endCallPhrases: [],
      
      // Disable voice features for text-only interview
      transcriber: null,
      
      // Background sound off for text chat
      backgroundSound: "off",
    };

    const response = await fetch("https://api.vapi.ai/assistant", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(assistantConfig),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Vapi API error: ${response.status} - ${errorData}`);
    }

    const assistant = await response.json();

    return NextResponse.json({
      success: true,
      assistant,
      message: "DSA Assistant created successfully",
    });

  } catch (error) {
    console.error("Error creating DSA assistant:", error);
    return NextResponse.json(
      { 
        error: "Failed to create DSA assistant", 
        details: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const apiKey = process.env.VAPI_PRIVATE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Vapi API key not configured" },
        { status: 500 }
      );
    }

    // List all assistants to find DSA assistant
    const response = await fetch("https://api.vapi.ai/assistant", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Vapi API error: ${response.status}`);
    }

    const assistants = await response.json();
    const dsaAssistant = assistants.find((a: any) => a.name === "DSA Interview Assistant");

    return NextResponse.json({
      success: true,
      assistants,
      dsaAssistant,
    });

  } catch (error) {
    console.error("Error fetching assistants:", error);
    return NextResponse.json(
      { error: "Failed to fetch assistants" },
      { status: 500 }
    );
  }
}

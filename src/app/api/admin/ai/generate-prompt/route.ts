import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";
import { getAIClient, getModelName, getAIProvider } from "@/lib/ai/deepseek";

/**
 * POST /api/admin/ai/generate-prompt
 * Generate a system prompt for an AI calling agent based on user description
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const body = await request.json();
    const { description, campaignType, companyName, targetAudience } = body;

    if (!description) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    const provider = getAIProvider();
    const hasAI = provider === "openai"
      ? !!process.env.OPENAI_API_KEY
      : !!process.env.DEEPSEEK_API_KEY;

    if (!hasAI) {
      return NextResponse.json(
        { error: "AI not configured. Please add OPENAI_API_KEY or DEEPSEEK_API_KEY to environment variables." },
        { status: 503 }
      );
    }

    const client = getAIClient();
    const model = getModelName();

    const systemMessage = `You are an expert at creating system prompts for AI phone calling agents.
Your job is to take a user's description of what they want an AI agent to do and create a comprehensive, well-structured system prompt.

The prompt should:
1. Define the agent's role and personality clearly
2. Establish the tone (professional, friendly, empathetic, etc.)
3. Include guidelines for handling common scenarios
4. Set clear objectives and success criteria
5. Include fallback behaviors for unexpected situations
6. Be natural and conversational, not robotic

Return ONLY the system prompt text, nothing else. No explanations, no quotes around it, just the prompt itself.`;

    const userMessage = `Create a system prompt for an AI calling agent with these requirements:

Description: ${description}
${campaignType ? `Campaign Type: ${campaignType}` : ""}
${companyName ? `Company Name: ${companyName}` : ""}
${targetAudience ? `Target Audience: ${targetAudience}` : ""}

Generate a comprehensive system prompt that the AI agent will use during calls.`;

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    const generatedPrompt = response.choices[0].message.content;

    if (!generatedPrompt) {
      return NextResponse.json(
        { error: "Failed to generate prompt" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      prompt: generatedPrompt.trim(),
      model,
      provider,
    });
  } catch (error) {
    console.error("Error generating prompt:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate prompt" },
      { status: 500 }
    );
  }
}

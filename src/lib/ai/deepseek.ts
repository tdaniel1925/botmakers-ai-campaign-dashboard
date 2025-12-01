import OpenAI from "openai";

// AI Provider configuration - supports both OpenAI and DeepSeek
type AIProvider = "openai" | "deepseek";

function getAIProvider(): AIProvider {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.DEEPSEEK_API_KEY) return "deepseek";
  return "openai"; // Default to OpenAI
}

function getAIClient(): OpenAI {
  const provider = getAIProvider();

  if (provider === "openai") {
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "placeholder",
    });
  }

  return new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY || "placeholder",
    baseURL: process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/v1",
  });
}

function getModelName(): string {
  const provider = getAIProvider();
  return provider === "openai" ? "gpt-4o-mini" : "deepseek-chat";
}

export interface SummarizationResult {
  summary: string;
  outcome: string;
  sentiment: "positive" | "negative" | "neutral";
  keyPoints: string[];
  callerIntent: string;
  resolution: string;
}

export async function summarizeCall(
  transcript: string,
  outcomeTags: string[]
): Promise<SummarizationResult> {
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;

  if (!hasOpenAI && !hasDeepSeek) {
    // Return placeholder result if no API key configured
    return {
      summary: "AI summarization not configured. Please add OPENAI_API_KEY or DEEPSEEK_API_KEY to environment variables.",
      outcome: outcomeTags[0] || "Unknown",
      sentiment: "neutral",
      keyPoints: ["AI summarization pending configuration"],
      callerIntent: "Unknown",
      resolution: "unclear",
    };
  }

  const client = getAIClient();
  const model = getModelName();

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `You analyze call transcripts and return structured JSON analysis. Available outcome tags: ${outcomeTags.join(", ")}. Return only valid JSON.`,
      },
      {
        role: "user",
        content: `Analyze this call transcript and provide:

1. SUMMARY: A concise 2-3 sentence summary of the call
2. OUTCOME: Based on the conversation, classify the outcome. Choose from: ${outcomeTags.join(", ")}
3. SENTIMENT: Overall sentiment (positive, negative, or neutral)
4. KEY_POINTS: List 3-5 key points or topics discussed
5. CALLER_INTENT: What was the caller trying to accomplish?
6. RESOLUTION: Was the caller's need resolved? (yes, no, partial, or unclear)

Transcript:
${transcript}

Respond ONLY with a JSON object:
{
  "summary": "...",
  "outcome": "...",
  "sentiment": "positive|negative|neutral",
  "keyPoints": ["...", "..."],
  "callerIntent": "...",
  "resolution": "yes|no|partial|unclear"
}`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 1000,
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  const result = JSON.parse(content);

  return {
    summary: result.summary || "Unable to generate summary",
    outcome: result.outcome || outcomeTags[0] || "Unknown",
    sentiment: (result.sentiment as "positive" | "negative" | "neutral") || "neutral",
    keyPoints: result.keyPoints || result.key_points || [],
    callerIntent: result.callerIntent || result.caller_intent || "Unknown",
    resolution: result.resolution || "unclear",
  };
}

// Export functions for external use
export { getAIClient, getAIProvider, getModelName };

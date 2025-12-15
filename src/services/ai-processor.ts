import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ExtractedData {
  callerName?: string;
  phoneNumber?: string;
  email?: string;
  primaryIntent?: string;
  outcome?: string;
  summary?: string;
  customFields?: Record<string, unknown>;
}

export interface PayloadAnalysis {
  sourceType: 'phone' | 'sms' | 'web_form' | 'chatbot';
  sourcePlatform: string;
  extractedData: ExtractedData;
  transcript?: string;
  transcriptFormatted?: Array<{ role: string; content: string }>;
  recordingUrl?: string;
  callStatus?: 'completed' | 'no_answer' | 'failed' | 'busy' | 'canceled';
  durationSeconds?: number;
}

export async function analyzePayload(
  payload: Record<string, unknown>,
  extractionHints?: Record<string, string>
): Promise<PayloadAnalysis> {
  const payloadString = JSON.stringify(payload, null, 2);

  const hintsPrompt = extractionHints && Object.keys(extractionHints).length > 0
    ? `\n\nAdditional extraction hints from campaign configuration:\n${JSON.stringify(extractionHints, null, 2)}`
    : '';

  const systemPrompt = `You are an AI assistant that analyzes webhook payloads from various communication sources (VAPI, Autocalls.ai, Twilio, web forms, chatbots). Your job is to:

1. Identify the source type and platform
2. Extract standardized fields from the payload
3. Detect the primary intent and outcome
4. Generate a concise summary

Common payload structures:
- VAPI: Contains "message.type": "end-of-call-report", with call details, transcript in "artifact", and analysis
- Autocalls.ai: Contains "call_id", "phone_number", "transcript", "call_outcome"
- Twilio: Contains "From", "To", "Body" for SMS, or call details
- Web forms: Usually key-value pairs with form fields
- Chatbots: Contains conversation history or messages array

Return a JSON object with this structure:
{
  "sourceType": "phone" | "sms" | "web_form" | "chatbot",
  "sourcePlatform": "vapi" | "autocalls" | "twilio" | "custom" | etc,
  "extractedData": {
    "callerName": "name if detected",
    "phoneNumber": "phone in E.164 format if found",
    "email": "email if found",
    "primaryIntent": "main reason for contact",
    "outcome": "result of interaction (appointment_set, callback_requested, info_provided, etc)",
    "summary": "1-2 sentence summary of the interaction",
    "customFields": { any additional relevant data }
  },
  "transcript": "full transcript text if available",
  "transcriptFormatted": [{ "role": "assistant" | "user", "content": "..." }] if available,
  "recordingUrl": "URL if available",
  "callStatus": "completed" | "no_answer" | "failed" | "busy" | "canceled" if applicable,
  "durationSeconds": number if available
}${hintsPrompt}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Analyze this webhook payload:\n\n${payloadString}` },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI');
  }

  const result = JSON.parse(content) as PayloadAnalysis;

  // Ensure required fields have defaults
  return {
    sourceType: result.sourceType || 'phone',
    sourcePlatform: result.sourcePlatform || 'unknown',
    extractedData: result.extractedData || {},
    transcript: result.transcript,
    transcriptFormatted: result.transcriptFormatted,
    recordingUrl: result.recordingUrl,
    callStatus: result.callStatus,
    durationSeconds: result.durationSeconds,
  };
}

export async function evaluateTriggers(
  transcript: string | undefined,
  summary: string | undefined,
  triggers: Array<{ id: string; intentDescription: string; priority: number }>
): Promise<string[]> {
  if (!transcript && !summary) {
    return [];
  }

  const content = transcript || summary || '';

  // Sort triggers by priority (lower = higher priority)
  const sortedTriggers = [...triggers].sort((a, b) => a.priority - b.priority);

  const triggerDescriptions = sortedTriggers.map((t, i) =>
    `${i + 1}. ID: ${t.id} - Intent: "${t.intentDescription}"`
  ).join('\n');

  const systemPrompt = `You are an AI assistant that evaluates whether a conversation matches specific intent triggers.

Given a conversation transcript or summary, determine which triggers (if any) should fire. A trigger fires if the caller's intent clearly matches the trigger's intent description.

Be conservative - only return triggers where there's a clear match. Multiple triggers can match if appropriate.

Return a JSON object with this structure:
{
  "matchedTriggerIds": ["id1", "id2"]
}

If no triggers match, return:
{
  "matchedTriggerIds": []
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Conversation content:\n${content}\n\nAvailable triggers:\n${triggerDescriptions}\n\nWhich triggers should fire?`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 500,
  });

  const responseContent = response.choices[0]?.message?.content;
  if (!responseContent) {
    return [];
  }

  const result = JSON.parse(responseContent) as { matchedTriggerIds: string[] };
  return result.matchedTriggerIds || [];
}

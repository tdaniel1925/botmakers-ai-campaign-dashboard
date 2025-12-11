/**
 * Vapi Assistant Management
 * Create, update, and delete Vapi AI assistants for outbound campaigns
 */

import { getApiKeys } from "@/lib/api-keys";

const VAPI_API_URL = "https://api.vapi.ai";
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Fetch with timeout support
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

interface VapiAssistantConfig {
  name: string;
  systemPrompt: string;
  firstMessage?: string;
  voiceId?: string;
  voiceProvider?: "vapi" | "11labs" | "elevenlabs" | "playht" | "deepgram";
  endCallConditions?: string[];
  structuredDataSchema?: Array<{
    name: string;
    type: string;
    description: string;
    required?: boolean;
  }>;
  maxDurationSeconds?: number;
  silenceTimeoutSeconds?: number;
  interruptionsEnabled?: boolean;
}

/**
 * Map internal provider names to Vapi API provider names
 */
function mapVoiceProvider(provider: string): string {
  switch (provider) {
    case "11labs":
    case "elevenlabs":
      return "11labs";
    case "vapi":
      return "vapi";
    case "playht":
      return "playht";
    case "deepgram":
      return "deepgram";
    default:
      return "vapi";
  }
}

interface VapiAssistant {
  id: string;
  name: string;
  model?: {
    provider: string;
    model: string;
    systemPrompt: string;
  };
  voice?: {
    provider: string;
    voiceId: string;
  };
  firstMessage?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get Vapi API key from database or environment
 */
async function getVapiApiKey(): Promise<string> {
  const keys = await getApiKeys("vapi");

  if (keys?.apiKey) {
    return keys.apiKey;
  }

  const envKey = process.env.VAPI_API_KEY;
  if (!envKey) {
    throw new Error("Vapi API key not configured");
  }

  return envKey;
}

/**
 * Create a Vapi assistant for an outbound campaign
 */
export async function createVapiAssistant(
  config: VapiAssistantConfig
): Promise<VapiAssistant> {
  const apiKey = await getVapiApiKey();

  // Build the assistant payload
  const assistantPayload: Record<string, unknown> = {
    name: config.name,
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: config.systemPrompt,
        },
      ],
    },
    firstMessage: config.firstMessage || "Hello, this is an AI assistant calling. How can I help you today?",
    endCallPhrases: config.endCallConditions || [
      "goodbye",
      "bye",
      "have a nice day",
      "thank you for your time",
    ],
    maxDurationSeconds: config.maxDurationSeconds || 300, // 5 min default
    silenceTimeoutSeconds: config.silenceTimeoutSeconds || 30,
    backgroundSound: "off",
    recordingEnabled: true,
    serverMessages: [
      "end-of-call-report",
      "status-update",
      "transcript",
    ],
  };

  // Configure voice
  if (config.voiceId) {
    const voiceProvider = mapVoiceProvider(config.voiceProvider || "vapi");
    assistantPayload.voice = {
      provider: voiceProvider,
      voiceId: config.voiceId,
    };
  } else {
    // Default to Vapi's built-in Hana voice (American Female, optimized for AI)
    assistantPayload.voice = {
      provider: "vapi",
      voiceId: "Hana",
    };
  }

  // Configure structured data extraction if schema provided
  if (config.structuredDataSchema && config.structuredDataSchema.length > 0) {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const field of config.structuredDataSchema) {
      properties[field.name] = {
        type: field.type === "boolean" ? "boolean" :
              field.type === "number" ? "number" : "string",
        description: field.description,
      };
      if (field.required) {
        required.push(field.name);
      }
    }

    assistantPayload.analysisPlan = {
      structuredDataSchema: {
        type: "object",
        properties,
        required,
      },
    };
  }

  const response = await fetchWithTimeout(`${VAPI_API_URL}/assistant`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(assistantPayload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Vapi create assistant error:", errorData);
    throw new Error(
      `Failed to create Vapi assistant: ${response.status} ${response.statusText}`
    );
  }

  const assistant = await response.json();
  return assistant as VapiAssistant;
}

/**
 * Update a Vapi assistant
 */
export async function updateVapiAssistant(
  assistantId: string,
  config: Partial<VapiAssistantConfig>
): Promise<VapiAssistant> {
  const apiKey = await getVapiApiKey();

  const updatePayload: Record<string, unknown> = {};

  if (config.name) {
    updatePayload.name = config.name;
  }

  if (config.systemPrompt) {
    updatePayload.model = {
      provider: "openai",
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: config.systemPrompt,
        },
      ],
    };
  }

  if (config.firstMessage) {
    updatePayload.firstMessage = config.firstMessage;
  }

  if (config.voiceId) {
    updatePayload.voice = {
      provider: mapVoiceProvider(config.voiceProvider || "vapi"),
      voiceId: config.voiceId,
    };
  }

  if (config.endCallConditions) {
    updatePayload.endCallPhrases = config.endCallConditions;
  }

  const response = await fetchWithTimeout(`${VAPI_API_URL}/assistant/${assistantId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updatePayload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Vapi update assistant error:", errorData);
    throw new Error(
      `Failed to update Vapi assistant: ${response.status} ${response.statusText}`
    );
  }

  const assistant = await response.json();
  return assistant as VapiAssistant;
}

/**
 * Delete a Vapi assistant
 */
export async function deleteVapiAssistant(assistantId: string): Promise<void> {
  const apiKey = await getVapiApiKey();

  const response = await fetchWithTimeout(`${VAPI_API_URL}/assistant/${assistantId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Vapi delete assistant error:", errorData);
    throw new Error(
      `Failed to delete Vapi assistant: ${response.status} ${response.statusText}`
    );
  }
}

/**
 * Get a Vapi assistant by ID
 */
export async function getVapiAssistant(
  assistantId: string
): Promise<VapiAssistant | null> {
  const apiKey = await getVapiApiKey();

  const response = await fetchWithTimeout(`${VAPI_API_URL}/assistant/${assistantId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Vapi get assistant error:", errorData);
    throw new Error(
      `Failed to get Vapi assistant: ${response.status} ${response.statusText}`
    );
  }

  const assistant = await response.json();
  return assistant as VapiAssistant;
}

/**
 * List available voices for Vapi assistants
 * Includes both Vapi native voices and ElevenLabs preset voices
 */
export async function listVapiVoices(): Promise<
  Array<{ voiceId: string; name: string; description: string; provider: string }>
> {
  return [
    // Vapi native voices (optimized for conversational AI)
    { voiceId: "Hana", name: "Hana", description: "American Female, 22", provider: "vapi" },
    { voiceId: "Harry", name: "Harry", description: "American Male, 24", provider: "vapi" },
    { voiceId: "Paige", name: "Paige", description: "American Female, 26", provider: "vapi" },
    { voiceId: "Cole", name: "Cole", description: "American Male, 22", provider: "vapi" },
    { voiceId: "Savannah", name: "Savannah", description: "Southern American Female, 25", provider: "vapi" },
    { voiceId: "Spencer", name: "Spencer", description: "American Female, 26", provider: "vapi" },
    { voiceId: "Lily", name: "Lily", description: "Asian American Female, 25", provider: "vapi" },
    { voiceId: "Elliot", name: "Elliot", description: "Canadian Male, 25", provider: "vapi" },
    { voiceId: "Rohan", name: "Rohan", description: "Indian American Male, 24", provider: "vapi" },
    { voiceId: "Neha", name: "Neha", description: "Indian American Female, 30", provider: "vapi" },
    // ElevenLabs preset voices (high quality, natural sounding)
    { voiceId: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", description: "Professional Female", provider: "11labs" },
    { voiceId: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", description: "Professional Male", provider: "11labs" },
    { voiceId: "pNInz6obpgDQGcFmaJgB", name: "Adam", description: "Deep Male", provider: "11labs" },
    { voiceId: "LcfcDJNUP1GQjkzn1xUU", name: "Emily", description: "Friendly Female", provider: "11labs" },
    { voiceId: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", description: "Conversational Male", provider: "11labs" },
    { voiceId: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", description: "Soft Female", provider: "11labs" },
    { voiceId: "GBv7mTt0atIp3Br8iCZE", name: "Thomas", description: "Calm Male", provider: "11labs" },
  ];
}

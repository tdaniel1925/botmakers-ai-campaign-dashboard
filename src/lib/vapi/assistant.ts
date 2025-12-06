/**
 * Vapi Assistant Management
 * Create, update, and delete Vapi AI assistants for outbound campaigns
 */

import { getApiKeys } from "@/lib/api-keys";

const VAPI_API_URL = "https://api.vapi.ai";

interface VapiAssistantConfig {
  name: string;
  systemPrompt: string;
  firstMessage?: string;
  voiceId?: string;
  voiceProvider?: "vapi" | "elevenlabs" | "playht" | "deepgram";
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
    const voiceProvider = config.voiceProvider || "vapi";
    assistantPayload.voice = {
      provider: voiceProvider,
      voiceId: config.voiceId,
    };
  } else {
    // Default to Vapi's built-in voice
    assistantPayload.voice = {
      provider: "vapi",
      voiceId: "jennifer", // Professional female voice
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

  const response = await fetch(`${VAPI_API_URL}/assistant`, {
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
      provider: config.voiceProvider || "vapi",
      voiceId: config.voiceId,
    };
  }

  if (config.endCallConditions) {
    updatePayload.endCallPhrases = config.endCallConditions;
  }

  const response = await fetch(`${VAPI_API_URL}/assistant/${assistantId}`, {
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

  const response = await fetch(`${VAPI_API_URL}/assistant/${assistantId}`, {
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

  const response = await fetch(`${VAPI_API_URL}/assistant/${assistantId}`, {
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
 * List available Vapi voices
 */
export async function listVapiVoices(): Promise<
  Array<{ voiceId: string; name: string; provider: string }>
> {
  // Return common Vapi voices - in production, you might fetch this from Vapi API
  return [
    { voiceId: "jennifer", name: "Jennifer (Professional Female)", provider: "vapi" },
    { voiceId: "mark", name: "Mark (Professional Male)", provider: "vapi" },
    { voiceId: "sarah", name: "Sarah (Friendly Female)", provider: "vapi" },
    { voiceId: "john", name: "John (Friendly Male)", provider: "vapi" },
    { voiceId: "emily", name: "Emily (Conversational Female)", provider: "vapi" },
    { voiceId: "michael", name: "Michael (Conversational Male)", provider: "vapi" },
  ];
}

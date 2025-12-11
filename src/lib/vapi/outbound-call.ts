/**
 * Vapi Outbound Call Service
 * Initiate and manage outbound calls via Vapi
 */

import { getApiKeys } from "@/lib/api-keys";

const VAPI_API_URL = "https://api.vapi.ai";
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Fetch with timeout support
 * Prevents hanging requests from blocking the call processing pipeline
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

interface OutboundCallConfig {
  assistantId: string;
  phoneNumberId: string;
  customerNumber: string;
  metadata?: Record<string, unknown>;
  assistantOverrides?: {
    firstMessage?: string;
    variableValues?: Record<string, string>;
    model?: {
      messages?: Array<{
        role: string;
        content: string;
      }>;
    };
  };
}

interface VapiCall {
  id: string;
  status: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  phoneNumberId: string;
  customer: {
    number: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Get Vapi API key
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
 * Initiate an outbound call via Vapi
 */
export async function initiateOutboundCall(
  config: OutboundCallConfig
): Promise<VapiCall> {
  const apiKey = await getVapiApiKey();

  const payload: Record<string, unknown> = {
    assistantId: config.assistantId,
    phoneNumberId: config.phoneNumberId,
    customer: {
      number: config.customerNumber,
    },
  };

  if (config.metadata) {
    payload.metadata = config.metadata;
  }

  if (config.assistantOverrides) {
    payload.assistantOverrides = config.assistantOverrides;
  }

  const response = await fetchWithTimeout(`${VAPI_API_URL}/call`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Vapi call initiation error:", errorData);
    throw new Error(
      `Failed to initiate call: ${response.status} ${response.statusText}`
    );
  }

  const call = await response.json();
  return call as VapiCall;
}

/**
 * Get call status from Vapi
 */
export async function getCallStatus(callId: string): Promise<VapiCall> {
  const apiKey = await getVapiApiKey();

  const response = await fetchWithTimeout(`${VAPI_API_URL}/call/${callId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get call status: ${response.status}`);
  }

  const call = await response.json();
  return call as VapiCall;
}

/**
 * End an active call
 */
export async function endCall(callId: string): Promise<void> {
  const apiKey = await getVapiApiKey();

  const response = await fetchWithTimeout(`${VAPI_API_URL}/call/${callId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to end call: ${response.status}`);
  }
}

/**
 * List active calls for a phone number
 */
export async function listActiveCalls(
  phoneNumberId?: string
): Promise<VapiCall[]> {
  const apiKey = await getVapiApiKey();

  const params = new URLSearchParams();
  if (phoneNumberId) {
    params.set("phoneNumberId", phoneNumberId);
  }
  params.set("status", "in-progress");

  const response = await fetchWithTimeout(`${VAPI_API_URL}/call?${params}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list calls: ${response.status}`);
  }

  const data = await response.json();
  return data as VapiCall[];
}

/**
 * Get the Vapi phone number ID for a campaign phone number
 */
export async function getVapiPhoneNumberId(
  phoneNumber: string
): Promise<string | null> {
  const apiKey = await getVapiApiKey();

  const response = await fetchWithTimeout(`${VAPI_API_URL}/phone-number`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list phone numbers: ${response.status}`);
  }

  const phoneNumbers = await response.json();
  const found = phoneNumbers.find(
    (p: { number: string; id: string }) => p.number === phoneNumber
  );

  return found?.id || null;
}

/**
 * Import a phone number to Vapi (for Twilio numbers)
 */
export async function importPhoneNumberToVapi(
  phoneNumber: string,
  twilioAccountSid: string,
  twilioAuthToken: string
): Promise<string> {
  const apiKey = await getVapiApiKey();

  const response = await fetchWithTimeout(`${VAPI_API_URL}/phone-number`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider: "twilio",
      number: phoneNumber,
      twilioAccountSid,
      twilioAuthToken,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Vapi phone import error:", errorData);
    throw new Error(
      `Failed to import phone number: ${response.status} ${response.statusText}`
    );
  }

  const data = await response.json();
  return data.id;
}

/**
 * Vapi Phone Number Management
 * Provision, import, and manage phone numbers for outbound campaigns
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

interface VapiPhoneNumber {
  id: string;
  orgId: string;
  number: string;
  name?: string;
  assistantId?: string;
  serverUrl?: string;
  provider: "twilio" | "vonage" | "vapi";
  credentialId?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProvisionPhoneConfig {
  areaCode?: string;
  name?: string;
  assistantId?: string;
  serverUrl?: string;
}

interface ImportTwilioPhoneConfig {
  twilioAccountSid: string;
  twilioAuthToken: string;
  /** The phone number in E.164 format (e.g., +15551234567) */
  twilioPhoneNumber: string;
  name?: string;
  assistantId?: string;
  serverUrl?: string;
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
 * List all phone numbers in Vapi account
 */
export async function listVapiPhoneNumbers(): Promise<VapiPhoneNumber[]> {
  const apiKey = await getVapiApiKey();

  const response = await fetchWithTimeout(`${VAPI_API_URL}/phone-number`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Vapi list phone numbers error:", errorData);
    throw new Error(
      `Failed to list Vapi phone numbers: ${response.status} ${response.statusText}`
    );
  }

  const phoneNumbers = await response.json();
  return phoneNumbers as VapiPhoneNumber[];
}

/**
 * Get a specific phone number from Vapi
 */
export async function getVapiPhoneNumber(
  phoneNumberId: string
): Promise<VapiPhoneNumber | null> {
  const apiKey = await getVapiApiKey();

  const response = await fetchWithTimeout(`${VAPI_API_URL}/phone-number/${phoneNumberId}`, {
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
    console.error("Vapi get phone number error:", errorData);
    throw new Error(
      `Failed to get Vapi phone number: ${response.status} ${response.statusText}`
    );
  }

  const phoneNumber = await response.json();
  return phoneNumber as VapiPhoneNumber;
}

/**
 * Provision a new phone number through Vapi
 * Vapi will provision a Twilio number for you
 */
export async function provisionVapiPhoneNumber(
  config: ProvisionPhoneConfig
): Promise<VapiPhoneNumber> {
  const apiKey = await getVapiApiKey();

  // Build the payload
  const payload: Record<string, unknown> = {
    provider: "vapi", // Let Vapi provision through their Twilio sub-account
    numberDesiredAreaCode: config.areaCode || "415", // Default to San Francisco area code
  };

  if (config.name) {
    payload.name = config.name;
  }

  if (config.assistantId) {
    payload.assistantId = config.assistantId;
  }

  if (config.serverUrl) {
    payload.serverUrl = config.serverUrl;
  }

  const response = await fetchWithTimeout(`${VAPI_API_URL}/phone-number`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Vapi provision phone number error:", errorData);
    throw new Error(
      `Failed to provision Vapi phone number: ${response.status} ${response.statusText}`
    );
  }

  const phoneNumber = await response.json();
  return phoneNumber as VapiPhoneNumber;
}

/**
 * Import an existing Twilio phone number to Vapi
 *
 * Uses the dedicated Twilio import endpoint: POST /phone-number/import/twilio
 *
 * @see https://docs.vapi.ai/api-reference/phone-numbers/import-twilio-number
 */
export async function importTwilioPhoneNumber(
  config: ImportTwilioPhoneConfig
): Promise<VapiPhoneNumber> {
  const apiKey = await getVapiApiKey();

  // Build payload according to Vapi's import Twilio endpoint spec
  const payload: Record<string, unknown> = {
    twilioPhoneNumber: config.twilioPhoneNumber, // E.164 format: +15551234567
    twilioAccountSid: config.twilioAccountSid,
    twilioAuthToken: config.twilioAuthToken,
  };

  if (config.name) {
    payload.name = config.name;
  }

  if (config.assistantId) {
    payload.assistantId = config.assistantId;
  }

  if (config.serverUrl) {
    payload.serverUrl = config.serverUrl;
  }

  // Use the dedicated Twilio import endpoint
  const response = await fetchWithTimeout(`${VAPI_API_URL}/phone-number/import/twilio`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Vapi import Twilio phone number error:", errorData);
    throw new Error(
      `Failed to import Twilio phone number to Vapi: ${errorData.message || response.status}`
    );
  }

  const phoneNumber = await response.json();
  return phoneNumber as VapiPhoneNumber;
}

/**
 * Update a phone number's configuration (assign/remove assistant, update name)
 */
export async function updateVapiPhoneNumber(
  phoneNumberId: string,
  updates: {
    name?: string;
    assistantId?: string | null;
    serverUrl?: string | null;
  }
): Promise<VapiPhoneNumber> {
  const apiKey = await getVapiApiKey();

  const payload: Record<string, unknown> = {};

  if (updates.name !== undefined) {
    payload.name = updates.name;
  }

  if (updates.assistantId !== undefined) {
    payload.assistantId = updates.assistantId;
  }

  if (updates.serverUrl !== undefined) {
    payload.serverUrl = updates.serverUrl;
  }

  const response = await fetchWithTimeout(`${VAPI_API_URL}/phone-number/${phoneNumberId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Vapi update phone number error:", errorData);
    throw new Error(
      `Failed to update Vapi phone number: ${response.status} ${response.statusText}`
    );
  }

  const phoneNumber = await response.json();
  return phoneNumber as VapiPhoneNumber;
}

/**
 * Delete/release a phone number from Vapi
 */
export async function deleteVapiPhoneNumber(phoneNumberId: string): Promise<void> {
  const apiKey = await getVapiApiKey();

  const response = await fetchWithTimeout(`${VAPI_API_URL}/phone-number/${phoneNumberId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok && response.status !== 404) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Vapi delete phone number error:", errorData);
    throw new Error(
      `Failed to delete Vapi phone number: ${response.status} ${response.statusText}`
    );
  }
}

/**
 * Assign an assistant to a phone number
 * This ties the phone number to the AI agent
 */
export async function assignAssistantToPhoneNumber(
  phoneNumberId: string,
  assistantId: string,
  webhookUrl?: string
): Promise<VapiPhoneNumber> {
  return updateVapiPhoneNumber(phoneNumberId, {
    assistantId,
    serverUrl: webhookUrl,
  });
}

/**
 * Remove assistant from a phone number
 */
export async function removeAssistantFromPhoneNumber(
  phoneNumberId: string
): Promise<VapiPhoneNumber> {
  return updateVapiPhoneNumber(phoneNumberId, {
    assistantId: null,
  });
}

/**
 * Search available phone numbers by area code
 * Note: This uses Twilio API directly since Vapi doesn't have a search endpoint
 */
export async function searchAvailablePhoneNumbers(
  twilioAccountSid: string,
  twilioAuthToken: string,
  areaCode: string,
  limit: number = 10
): Promise<Array<{ phoneNumber: string; friendlyName: string; locality: string; region: string }>> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/AvailablePhoneNumbers/US/Local.json?AreaCode=${areaCode}&VoiceEnabled=true&Limit=${limit}`;

  const response = await fetchWithTimeout(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64")}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to search Twilio phone numbers: ${response.status}`);
  }

  const data = await response.json();

  return (data.available_phone_numbers || []).map((num: { phone_number: string; friendly_name: string; locality: string; region: string }) => ({
    phoneNumber: num.phone_number,
    friendlyName: num.friendly_name,
    locality: num.locality,
    region: num.region,
  }));
}

/**
 * Purchase a phone number from Twilio
 */
export async function purchaseTwilioPhoneNumber(
  twilioAccountSid: string,
  twilioAuthToken: string,
  phoneNumber: string,
  friendlyName?: string
): Promise<{ sid: string; phoneNumber: string; friendlyName: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/IncomingPhoneNumbers.json`;

  const formData = new URLSearchParams();
  formData.append("PhoneNumber", phoneNumber);
  if (friendlyName) {
    formData.append("FriendlyName", friendlyName);
  }

  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Failed to purchase Twilio phone number: ${error.message || response.status}`);
  }

  const data = await response.json();

  return {
    sid: data.sid,
    phoneNumber: data.phone_number,
    friendlyName: data.friendly_name,
  };
}

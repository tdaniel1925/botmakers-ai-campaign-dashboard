/**
 * Call Providers - Unified interface for outbound call services
 *
 * Supported providers:
 * - AutoCalls.ai: https://docs.autocalls.ai
 * - Synthflow: https://docs.synthflow.ai
 * - Vapi: https://docs.vapi.ai (existing integration)
 */

export * from "./types";
export { autocallsProvider } from "./autocalls";
export { synthflowProvider } from "./synthflow";

import {
  CallProvider,
  CallProviderService,
  ContactData,
  CallResult,
  ProviderConfig,
} from "./types";
import { autocallsProvider } from "./autocalls";
import { synthflowProvider } from "./synthflow";

/**
 * Get the appropriate provider service based on provider type
 */
export function getCallProvider(provider: CallProvider): CallProviderService | null {
  switch (provider) {
    case "autocalls":
      return autocallsProvider;
    case "synthflow":
      return synthflowProvider;
    case "vapi":
      // Vapi uses a different integration pattern (direct API calls)
      // Return null and handle separately
      return null;
    default:
      return null;
  }
}

/**
 * Make an outbound call using the specified provider
 */
export async function makeOutboundCall(
  contact: ContactData,
  config: ProviderConfig
): Promise<CallResult> {
  const provider = getCallProvider(config.provider);

  if (!provider) {
    // Handle Vapi separately since it has existing integration
    if (config.provider === "vapi") {
      return makeVapiCall(contact, config);
    }

    return {
      success: false,
      provider: config.provider,
      error: `Unknown provider: ${config.provider}`,
    };
  }

  return provider.makeCall(contact, config);
}

/**
 * Make a call using Vapi (existing integration)
 */
async function makeVapiCall(
  contact: ContactData,
  config: ProviderConfig
): Promise<CallResult> {
  if (config.provider !== "vapi") {
    return {
      success: false,
      provider: "vapi",
      error: "Invalid provider configuration",
    };
  }

  try {
    // Vapi API endpoint for outbound calls
    const VAPI_API_URL = "https://api.vapi.ai/call/phone";

    // Build the request body for Vapi
    const body: Record<string, unknown> = {
      assistantId: config.assistant_id,
      customer: {
        number: contact.phone_number,
        name: contact.name,
      },
    };

    // Add phone number ID if provided
    if (config.phone_number_id) {
      body.phoneNumberId = config.phone_number_id;
    }

    // Add variables as assistant overrides metadata
    if (contact.variables && Object.keys(contact.variables).length > 0) {
      body.assistantOverrides = {
        metadata: contact.variables,
      };
    }

    const response = await fetch(VAPI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.api_key}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        provider: "vapi",
        error: data.message || data.error || `HTTP ${response.status}`,
        raw_response: data,
      };
    }

    return {
      success: true,
      provider: "vapi",
      call_id: data.id,
      raw_response: data,
    };
  } catch (error) {
    return {
      success: false,
      provider: "vapi",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Validate provider configuration
 */
export async function validateProviderConfig(
  config: ProviderConfig
): Promise<{ valid: boolean; error?: string }> {
  const provider = getCallProvider(config.provider);

  if (!provider) {
    if (config.provider === "vapi") {
      // Basic validation for Vapi
      if (!config.api_key && config.provider === "vapi") {
        return { valid: false, error: "API key is required for client keys" };
      }
      if (!config.assistant_id) {
        return { valid: false, error: "Assistant ID is required" };
      }
      return { valid: true };
    }
    return { valid: false, error: `Unknown provider: ${config.provider}` };
  }

  return provider.validateConfig(config);
}

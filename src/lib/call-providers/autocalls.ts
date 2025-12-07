/**
 * AutoCalls.ai Provider Service
 * API Documentation: https://docs.autocalls.ai/api-reference/calls/make-phone-call
 *
 * Endpoint: POST https://app.autocalls.ai/api/user/make_call
 *
 * Request Body:
 * - phone_number: string (E.164 format, e.g., +1234567890)
 * - assistant_id: number (ID of the assistant)
 * - variables: object (key-value pairs for dynamic data)
 * - customer_name: string (optional)
 * - email: string (optional)
 */

import {
  CallProviderService,
  ContactData,
  CallResult,
  ProviderConfig,
  AutoCallsConfig,
} from "./types";

const AUTOCALLS_API_URL = "https://app.autocalls.ai/api/user/make_call";

export class AutoCallsProvider implements CallProviderService {
  provider = "autocalls" as const;

  async makeCall(contact: ContactData, config: ProviderConfig): Promise<CallResult> {
    if (config.provider !== "autocalls") {
      return {
        success: false,
        provider: "autocalls",
        error: "Invalid provider configuration",
      };
    }

    const autocallsConfig = config as AutoCallsConfig;

    try {
      // Build the request body
      const body: Record<string, unknown> = {
        phone_number: contact.phone_number,
        assistant_id: autocallsConfig.assistant_id,
      };

      // Add customer name if provided
      if (contact.name) {
        body.customer_name = contact.name;
      }

      // Add email if provided
      if (contact.email) {
        body.email = contact.email;
      }

      // Add variables - AutoCalls expects an object with key-value pairs
      if (contact.variables && Object.keys(contact.variables).length > 0) {
        body.variables = {
          ...contact.variables,
          // Also include name and email in variables for prompt access
          ...(contact.name && { customer_name: contact.name }),
          ...(contact.email && { email: contact.email }),
        };
      }

      const response = await fetch(AUTOCALLS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${autocallsConfig.api_key}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          provider: "autocalls",
          error: data.message || data.error || `HTTP ${response.status}`,
          raw_response: data,
        };
      }

      return {
        success: true,
        provider: "autocalls",
        call_id: data.data?.call_id || data.data?.id,
        raw_response: data,
      };
    } catch (error) {
      return {
        success: false,
        provider: "autocalls",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async validateConfig(config: ProviderConfig): Promise<{ valid: boolean; error?: string }> {
    if (config.provider !== "autocalls") {
      return { valid: false, error: "Invalid provider type" };
    }

    const autocallsConfig = config as AutoCallsConfig;

    if (!autocallsConfig.api_key) {
      return { valid: false, error: "API key is required" };
    }

    if (!autocallsConfig.assistant_id) {
      return { valid: false, error: "Assistant ID is required" };
    }

    // Optionally validate by making a test API call to list assistants
    // For now, just validate the format
    return { valid: true };
  }
}

export const autocallsProvider = new AutoCallsProvider();

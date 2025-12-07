/**
 * Synthflow AI Provider Service
 * API Documentation: https://docs.synthflow.ai/api-reference/api-reference/calls/voice-call
 *
 * Endpoint: POST https://api.synthflow.ai/v2/calls
 *
 * Request Body:
 * - model_id: string (Agent ID from Synthflow dashboard)
 * - phone: string (recipient phone number)
 * - name: string (recipient name)
 * - custom_variables: array of {key, value} objects
 * - lead_email: string (optional)
 * - lead_timezone: string (optional)
 * - prompt: string (optional, override agent prompt)
 * - greeting: string (optional, override greeting)
 */

import {
  CallProviderService,
  ContactData,
  CallResult,
  ProviderConfig,
  SynthflowConfig,
} from "./types";

const SYNTHFLOW_API_URL = "https://api.synthflow.ai/v2/calls";

export class SynthflowProvider implements CallProviderService {
  provider = "synthflow" as const;

  async makeCall(contact: ContactData, config: ProviderConfig): Promise<CallResult> {
    if (config.provider !== "synthflow") {
      return {
        success: false,
        provider: "synthflow",
        error: "Invalid provider configuration",
      };
    }

    const synthflowConfig = config as SynthflowConfig;

    try {
      // Build custom_variables array from contact variables
      const customVariables: Array<{ key: string; value: string }> = [];

      if (contact.variables) {
        for (const [key, value] of Object.entries(contact.variables)) {
          customVariables.push({
            key,
            value: String(value),
          });
        }
      }

      // Build the request body
      const body: Record<string, unknown> = {
        model_id: synthflowConfig.model_id,
        phone: contact.phone_number,
        name: contact.name || "Customer",
      };

      // Add custom variables if any
      if (customVariables.length > 0) {
        body.custom_variables = customVariables;
      }

      // Add email if provided
      if (contact.email) {
        body.lead_email = contact.email;
      }

      // Add optional overrides
      if (synthflowConfig.prompt) {
        body.prompt = synthflowConfig.prompt;
      }

      if (synthflowConfig.greeting) {
        body.greeting = synthflowConfig.greeting;
      }

      const response = await fetch(SYNTHFLOW_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${synthflowConfig.api_key}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          provider: "synthflow",
          error: data.message || data.error || `HTTP ${response.status}`,
          raw_response: data,
        };
      }

      return {
        success: true,
        provider: "synthflow",
        call_id: data.call_id || data.id,
        raw_response: data,
      };
    } catch (error) {
      return {
        success: false,
        provider: "synthflow",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async validateConfig(config: ProviderConfig): Promise<{ valid: boolean; error?: string }> {
    if (config.provider !== "synthflow") {
      return { valid: false, error: "Invalid provider type" };
    }

    const synthflowConfig = config as SynthflowConfig;

    if (!synthflowConfig.api_key) {
      return { valid: false, error: "API key is required" };
    }

    if (!synthflowConfig.model_id) {
      return { valid: false, error: "Agent ID (model_id) is required" };
    }

    // Optionally validate by checking the agent exists
    // For now, just validate the format
    return { valid: true };
  }
}

export const synthflowProvider = new SynthflowProvider();

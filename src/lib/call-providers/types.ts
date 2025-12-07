/**
 * Call Provider Types
 * Defines interfaces for outbound call providers (AutoCalls.ai, Synthflow, Vapi)
 */

export type CallProvider = "autocalls" | "synthflow" | "vapi";

/**
 * Contact data with variable fields for outbound calls
 */
export interface ContactData {
  phone_number: string;
  name?: string;
  email?: string;
  // Dynamic variables from campaign contacts
  variables?: Record<string, string | number | boolean>;
}

/**
 * Provider-specific configuration stored per campaign
 */
export interface AutoCallsConfig {
  provider: "autocalls";
  api_key: string; // Encrypted
  assistant_id: number;
}

export interface SynthflowConfig {
  provider: "synthflow";
  api_key: string; // Encrypted
  model_id: string; // Agent ID in Synthflow
  // Optional overrides
  prompt?: string;
  greeting?: string;
}

export interface VapiConfig {
  provider: "vapi";
  api_key: string; // Encrypted (or null if using system keys)
  assistant_id: string;
  phone_number_id?: string;
}

export type ProviderConfig = AutoCallsConfig | SynthflowConfig | VapiConfig;

/**
 * Result of making an outbound call
 */
export interface CallResult {
  success: boolean;
  call_id?: string;
  provider: CallProvider;
  error?: string;
  raw_response?: unknown;
}

/**
 * Interface that all call providers must implement
 */
export interface CallProviderService {
  provider: CallProvider;

  /**
   * Make an outbound call to a contact
   */
  makeCall(contact: ContactData, config: ProviderConfig): Promise<CallResult>;

  /**
   * Validate the provider configuration
   */
  validateConfig(config: ProviderConfig): Promise<{ valid: boolean; error?: string }>;
}

/**
 * Map contact variables to provider-specific format
 */
export interface VariableMapping {
  // Key is the variable name in our system, value is the provider-specific key
  [key: string]: string;
}

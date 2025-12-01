import { createClient } from "@supabase/supabase-js";
import { decryptObject, isEncrypted } from "@/lib/encryption";

// Service types
export type ApiService =
  | "openai"
  | "vapi"
  | "resend"
  | "twilio"
  | "cal_com"
  | "google_calendar"
  | "outlook_calendar"
  | "stripe"
  | "square"
  | "paypal";

// Key data structures for each service
export interface OpenAIKeys {
  apiKey: string;
  organizationId?: string;
}

export interface VapiKeys {
  apiKey: string;
  publicKey?: string;
}

export interface ResendKeys {
  apiKey: string;
}

export interface TwilioKeys {
  accountSid: string;
  authToken: string;
  phoneNumber?: string;
}

export interface CalComKeys {
  apiKey: string;
}

export interface GoogleCalendarKeys {
  clientId: string;
  clientSecret: string;
  refreshToken?: string;
}

export interface OutlookCalendarKeys {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  refreshToken?: string;
}

export interface StripeKeys {
  secretKey: string;
  publishableKey?: string;
  webhookSecret?: string;
}

export interface SquareKeys {
  accessToken: string;
  applicationId?: string;
  locationId?: string;
}

export interface PayPalKeys {
  clientId: string;
  clientSecret: string;
  mode: "sandbox" | "live";
}

export type ServiceKeyData = {
  openai: OpenAIKeys;
  vapi: VapiKeys;
  resend: ResendKeys;
  twilio: TwilioKeys;
  cal_com: CalComKeys;
  google_calendar: GoogleCalendarKeys;
  outlook_calendar: OutlookCalendarKeys;
  stripe: StripeKeys;
  square: SquareKeys;
  paypal: PayPalKeys;
};

// Service configuration metadata
export const serviceConfig: Record<
  ApiService,
  {
    name: string;
    description: string;
    fields: {
      key: string;
      label: string;
      required: boolean;
      type: "text" | "password" | "select";
      placeholder?: string;
      options?: { value: string; label: string }[];
    }[];
    envKeys: Record<string, string>;
  }
> = {
  openai: {
    name: "OpenAI",
    description: "Powers AI call analysis and summarization",
    fields: [
      { key: "apiKey", label: "API Key", required: true, type: "password", placeholder: "sk-..." },
      { key: "organizationId", label: "Organization ID", required: false, type: "text", placeholder: "org-..." },
    ],
    envKeys: { apiKey: "OPENAI_API_KEY", organizationId: "OPENAI_ORG_ID" },
  },
  vapi: {
    name: "Vapi",
    description: "Voice AI platform integration",
    fields: [
      { key: "apiKey", label: "API Key", required: true, type: "password", placeholder: "vapi_..." },
      { key: "publicKey", label: "Public Key", required: false, type: "text", placeholder: "pk_..." },
    ],
    envKeys: { apiKey: "VAPI_API_KEY", publicKey: "VAPI_PUBLIC_KEY" },
  },
  resend: {
    name: "Resend",
    description: "Transactional email delivery service",
    fields: [
      { key: "apiKey", label: "API Key", required: true, type: "password", placeholder: "re_..." },
    ],
    envKeys: { apiKey: "RESEND_API_KEY" },
  },
  twilio: {
    name: "Twilio",
    description: "SMS and voice communications",
    fields: [
      { key: "accountSid", label: "Account SID", required: true, type: "text", placeholder: "AC..." },
      { key: "authToken", label: "Auth Token", required: true, type: "password", placeholder: "Your auth token" },
      { key: "phoneNumber", label: "Phone Number", required: false, type: "text", placeholder: "+1234567890" },
    ],
    envKeys: { accountSid: "TWILIO_ACCOUNT_SID", authToken: "TWILIO_AUTH_TOKEN", phoneNumber: "TWILIO_PHONE_NUMBER" },
  },
  cal_com: {
    name: "Cal.com",
    description: "Scheduling and calendar management",
    fields: [
      { key: "apiKey", label: "API Key", required: true, type: "password", placeholder: "cal_..." },
    ],
    envKeys: { apiKey: "CAL_COM_API_KEY" },
  },
  google_calendar: {
    name: "Google Calendar",
    description: "Google Calendar integration",
    fields: [
      { key: "clientId", label: "Client ID", required: true, type: "text", placeholder: "...apps.googleusercontent.com" },
      { key: "clientSecret", label: "Client Secret", required: true, type: "password", placeholder: "GOCSPX-..." },
      { key: "refreshToken", label: "Refresh Token", required: false, type: "password", placeholder: "1//..." },
    ],
    envKeys: { clientId: "GOOGLE_CLIENT_ID", clientSecret: "GOOGLE_CLIENT_SECRET", refreshToken: "GOOGLE_REFRESH_TOKEN" },
  },
  outlook_calendar: {
    name: "Outlook Calendar",
    description: "Microsoft Outlook Calendar integration",
    fields: [
      { key: "clientId", label: "Application (Client) ID", required: true, type: "text", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
      { key: "clientSecret", label: "Client Secret", required: true, type: "password", placeholder: "Your client secret" },
      { key: "tenantId", label: "Directory (Tenant) ID", required: true, type: "text", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
      { key: "refreshToken", label: "Refresh Token", required: false, type: "password", placeholder: "OAuth refresh token" },
    ],
    envKeys: { clientId: "AZURE_CLIENT_ID", clientSecret: "AZURE_CLIENT_SECRET", tenantId: "AZURE_TENANT_ID", refreshToken: "AZURE_REFRESH_TOKEN" },
  },
  stripe: {
    name: "Stripe",
    description: "Payment processing",
    fields: [
      { key: "secretKey", label: "Secret Key", required: true, type: "password", placeholder: "sk_live_... or sk_test_..." },
      { key: "publishableKey", label: "Publishable Key", required: false, type: "text", placeholder: "pk_live_... or pk_test_..." },
      { key: "webhookSecret", label: "Webhook Secret", required: false, type: "password", placeholder: "whsec_..." },
    ],
    envKeys: { secretKey: "STRIPE_SECRET_KEY", publishableKey: "STRIPE_PUBLISHABLE_KEY", webhookSecret: "STRIPE_WEBHOOK_SECRET" },
  },
  square: {
    name: "Square",
    description: "Payment processing and point of sale",
    fields: [
      { key: "accessToken", label: "Access Token", required: true, type: "password", placeholder: "EAAAl..." },
      { key: "applicationId", label: "Application ID", required: false, type: "text", placeholder: "sq0idp-..." },
      { key: "locationId", label: "Location ID", required: false, type: "text", placeholder: "L..." },
    ],
    envKeys: { accessToken: "SQUARE_ACCESS_TOKEN", applicationId: "SQUARE_APPLICATION_ID", locationId: "SQUARE_LOCATION_ID" },
  },
  paypal: {
    name: "PayPal",
    description: "PayPal payment processing",
    fields: [
      { key: "clientId", label: "Client ID", required: true, type: "text", placeholder: "Your PayPal client ID" },
      { key: "clientSecret", label: "Client Secret", required: true, type: "password", placeholder: "Your PayPal client secret" },
      {
        key: "mode",
        label: "Mode",
        required: true,
        type: "select",
        options: [
          { value: "sandbox", label: "Sandbox (Testing)" },
          { value: "live", label: "Live (Production)" },
        ],
      },
    ],
    envKeys: { clientId: "PAYPAL_CLIENT_ID", clientSecret: "PAYPAL_CLIENT_SECRET", mode: "PAYPAL_MODE" },
  },
};

// Get Supabase client
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Get API keys for a service with .env fallback
 */
export async function getApiKeys<T extends ApiService>(
  service: T
): Promise<ServiceKeyData[T] | null> {
  try {
    const supabase = getSupabaseClient();

    // First try to get from database
    const { data } = await supabase
      .from("api_keys")
      .select("key_data, is_active")
      .eq("service", service)
      .eq("is_active", true)
      .single();

    if (data?.key_data) {
      // Handle encrypted data (string) or legacy plain object
      if (typeof data.key_data === "string" && isEncrypted(data.key_data)) {
        try {
          return decryptObject<ServiceKeyData[T]>(data.key_data);
        } catch (error) {
          console.error(`Failed to decrypt API keys for ${service}:`, error);
          // Fall through to .env fallback
        }
      } else if (typeof data.key_data === "object") {
        // Legacy: plain object (not encrypted)
        return data.key_data as ServiceKeyData[T];
      }
    }

    // Fall back to .env variables
    const config = serviceConfig[service];
    const envKeys: Record<string, string> = {};
    let hasAnyKey = false;

    for (const field of config.fields) {
      const envKey = config.envKeys[field.key];
      const value = process.env[envKey];
      if (value) {
        envKeys[field.key] = value;
        hasAnyKey = true;
      }
    }

    if (hasAnyKey) {
      return envKeys as unknown as ServiceKeyData[T];
    }

    return null;
  } catch (error) {
    console.error(`Error getting API keys for ${service}:`, error);
    return null;
  }
}

/**
 * Validate API keys for a service
 */
export async function validateApiKeys(
  service: ApiService,
  keyData: Record<string, string>
): Promise<{ valid: boolean; error?: string }> {
  try {
    switch (service) {
      case "openai":
        return await validateOpenAI(keyData as unknown as OpenAIKeys);
      case "vapi":
        return await validateVapi(keyData as unknown as VapiKeys);
      case "resend":
        return await validateResend(keyData as unknown as ResendKeys);
      case "twilio":
        return await validateTwilio(keyData as unknown as TwilioKeys);
      case "cal_com":
        return await validateCalCom(keyData as unknown as CalComKeys);
      case "google_calendar":
        return await validateGoogleCalendar(keyData as unknown as GoogleCalendarKeys);
      case "outlook_calendar":
        return await validateOutlookCalendar(keyData as unknown as OutlookCalendarKeys);
      case "stripe":
        return await validateStripe(keyData as unknown as StripeKeys);
      case "square":
        return await validateSquare(keyData as unknown as SquareKeys);
      case "paypal":
        return await validatePayPal(keyData as unknown as PayPalKeys);
      default:
        return { valid: false, error: "Unknown service" };
    }
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : "Validation failed" };
  }
}

// Validation functions for each service
async function validateOpenAI(keys: OpenAIKeys): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${keys.apiKey}`,
        ...(keys.organizationId && { "OpenAI-Organization": keys.organizationId }),
      },
    });
    if (response.ok) return { valid: true };
    const error = await response.json();
    return { valid: false, error: error.error?.message || "Invalid API key" };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : "Connection failed" };
  }
}

async function validateVapi(keys: VapiKeys): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch("https://api.vapi.ai/assistant", {
      headers: {
        Authorization: `Bearer ${keys.apiKey}`,
      },
    });
    if (response.ok || response.status === 200) return { valid: true };
    return { valid: false, error: "Invalid API key" };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : "Connection failed" };
  }
}

async function validateResend(keys: ResendKeys): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch("https://api.resend.com/domains", {
      headers: {
        Authorization: `Bearer ${keys.apiKey}`,
      },
    });
    if (response.ok) return { valid: true };
    const error = await response.json();
    return { valid: false, error: error.message || "Invalid API key" };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : "Connection failed" };
  }
}

async function validateTwilio(keys: TwilioKeys): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${keys.accountSid}.json`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${keys.accountSid}:${keys.authToken}`).toString("base64")}`,
        },
      }
    );
    if (response.ok) return { valid: true };
    return { valid: false, error: "Invalid Account SID or Auth Token" };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : "Connection failed" };
  }
}

async function validateCalCom(keys: CalComKeys): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch("https://api.cal.com/v1/me", {
      headers: {
        Authorization: `Bearer ${keys.apiKey}`,
      },
    });
    if (response.ok) return { valid: true };
    return { valid: false, error: "Invalid API key" };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : "Connection failed" };
  }
}

async function validateGoogleCalendar(keys: GoogleCalendarKeys): Promise<{ valid: boolean; error?: string }> {
  // For Google, we just validate the format since we can't test without OAuth flow
  if (!keys.clientId.includes("googleusercontent.com")) {
    return { valid: false, error: "Invalid Client ID format" };
  }
  if (!keys.clientSecret || keys.clientSecret.length < 10) {
    return { valid: false, error: "Invalid Client Secret" };
  }
  return { valid: true };
}

async function validateOutlookCalendar(keys: OutlookCalendarKeys): Promise<{ valid: boolean; error?: string }> {
  // Validate UUID format for Azure IDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(keys.clientId)) {
    return { valid: false, error: "Invalid Client ID format (should be UUID)" };
  }
  if (!uuidRegex.test(keys.tenantId)) {
    return { valid: false, error: "Invalid Tenant ID format (should be UUID)" };
  }
  if (!keys.clientSecret || keys.clientSecret.length < 10) {
    return { valid: false, error: "Invalid Client Secret" };
  }
  return { valid: true };
}

async function validateStripe(keys: StripeKeys): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch("https://api.stripe.com/v1/balance", {
      headers: {
        Authorization: `Bearer ${keys.secretKey}`,
      },
    });
    if (response.ok) return { valid: true };
    const error = await response.json();
    return { valid: false, error: error.error?.message || "Invalid API key" };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : "Connection failed" };
  }
}

async function validateSquare(keys: SquareKeys): Promise<{ valid: boolean; error?: string }> {
  try {
    const response = await fetch("https://connect.squareup.com/v2/merchants/me", {
      headers: {
        Authorization: `Bearer ${keys.accessToken}`,
        "Square-Version": "2024-01-18",
      },
    });
    if (response.ok) return { valid: true };
    const error = await response.json();
    return { valid: false, error: error.errors?.[0]?.detail || "Invalid access token" };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : "Connection failed" };
  }
}

async function validatePayPal(keys: PayPalKeys): Promise<{ valid: boolean; error?: string }> {
  try {
    const baseUrl = keys.mode === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keys.clientId}:${keys.clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (response.ok) return { valid: true };
    return { valid: false, error: "Invalid Client ID or Client Secret" };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : "Connection failed" };
  }
}

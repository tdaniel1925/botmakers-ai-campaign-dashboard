import { createServiceClient } from "@/lib/supabase/server";

interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

interface SendSmsParams {
  to: string;
  body: string;
  statusCallbackUrl?: string;
  /**
   * If true, automatically uses the default status callback URL from environment.
   * This should be enabled for production SMS to track delivery status.
   */
  enableStatusCallback?: boolean;
}

// Get the base URL for callbacks
function getStatusCallbackUrl(): string | null {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
  if (!baseUrl) return null;
  const protocol = baseUrl.includes("localhost") ? "http" : "https";
  const url = baseUrl.startsWith("http") ? baseUrl : `${protocol}://${baseUrl}`;
  return `${url}/api/webhooks/sms-status`;
}

// Mandatory opt-out message - cannot be disabled or modified by users
const OPT_OUT_MESSAGE = "\n\nReply STOP to unsubscribe.";

// Append opt-out message to SMS body
function appendOptOutMessage(body: string): string {
  // Check if message already contains opt-out language (case insensitive)
  const hasOptOut = /\b(stop|unsubscribe|opt.?out)\b/i.test(body);
  if (hasOptOut) {
    return body; // Don't duplicate if already present
  }
  return body + OPT_OUT_MESSAGE;
}

interface SendSmsResult {
  success: boolean;
  messageSid?: string;
  status?: string;
  error?: string;
  errorCode?: string;
  segmentCount?: number;
}

// Get Twilio credentials from database or env
async function getTwilioCredentials(): Promise<TwilioCredentials | null> {
  // First try to get from database (api_keys table)
  try {
    const supabase = await createServiceClient();
    const { data: apiKey } = await supabase
      .from("api_keys")
      .select("key_data")
      .eq("service", "twilio")
      .eq("is_active", true)
      .single();

    if (apiKey?.key_data) {
      const keyData = apiKey.key_data as {
        account_sid?: string;
        auth_token?: string;
        from_number?: string;
      };
      if (keyData.account_sid && keyData.auth_token && keyData.from_number) {
        return {
          accountSid: keyData.account_sid,
          authToken: keyData.auth_token,
          fromNumber: keyData.from_number,
        };
      }
    }
  } catch (error) {
    console.log("No Twilio credentials in database, checking env vars");
  }

  // Fall back to environment variables
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  // Support both TWILIO_FROM_NUMBER and TWILIO_PHONE_NUMBER for compatibility
  const fromNumber = process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER;

  console.log(`[Twilio] Checking env vars: accountSid=${accountSid ? "set" : "missing"}, authToken=${authToken ? "set" : "missing"}, fromNumber=${fromNumber || "missing"}`);

  if (accountSid && authToken && fromNumber) {
    return { accountSid, authToken, fromNumber };
  }

  console.log("[Twilio] Missing credentials - accountSid:", !!accountSid, "authToken:", !!authToken, "fromNumber:", !!fromNumber);
  return null;
}

// Format phone number to E.164 format
function formatPhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, "");

  // If it's a 10-digit US number, add +1
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // If it already has country code
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+${cleaned}`;
  }

  // If it already starts with +, return as is
  if (phone.startsWith("+")) {
    return phone;
  }

  // Default: add + prefix
  return `+${cleaned}`;
}

// Check if a phone number is on the global SMS blacklist
async function isBlacklisted(phoneNumber: string): Promise<boolean> {
  try {
    const supabase = await createServiceClient();
    const formattedPhone = formatPhoneNumber(phoneNumber);

    const { data } = await supabase
      .from("sms_blacklist")
      .select("id")
      .eq("phone_number", formattedPhone)
      .eq("is_active", true)
      .maybeSingle();

    return !!data;
  } catch (error) {
    // If table doesn't exist or error, allow sending (fail open for now)
    console.warn("Could not check SMS blacklist:", error);
    return false;
  }
}

// Send SMS using Twilio REST API
export async function sendSms(params: SendSmsParams): Promise<SendSmsResult> {
  const credentials = await getTwilioCredentials();

  if (!credentials) {
    return {
      success: false,
      error: "Twilio credentials not configured",
    };
  }

  const formattedTo = formatPhoneNumber(params.to);

  // Validate phone number
  if (formattedTo.length < 10) {
    return {
      success: false,
      error: "Invalid phone number",
    };
  }

  // Check global SMS blacklist
  const blacklisted = await isBlacklisted(formattedTo);
  if (blacklisted) {
    return {
      success: false,
      error: "Phone number has opted out of SMS",
      errorCode: "BLACKLISTED",
    };
  }

  try {
    // Use Twilio REST API directly (no SDK needed)
    const url = `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Messages.json`;

    // Append mandatory opt-out message
    const messageBody = appendOptOutMessage(params.body);

    const formData = new URLSearchParams();
    formData.append("To", formattedTo);
    formData.append("From", credentials.fromNumber);
    formData.append("Body", messageBody);

    // Add status callback URL for delivery tracking
    // Uses explicit URL if provided, otherwise auto-generates if enableStatusCallback is true (default)
    const callbackUrl = params.statusCallbackUrl ||
      (params.enableStatusCallback !== false ? getStatusCallbackUrl() : null);
    if (callbackUrl) {
      formData.append("StatusCallback", callbackUrl);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || "Failed to send SMS",
        errorCode: data.code?.toString(),
      };
    }

    // Calculate segment count (160 chars for GSM-7, 70 for Unicode)
    // Use the actual message body sent (with opt-out appended)
    const isUnicode = /[^\x00-\x7F]/.test(messageBody);
    const charsPerSegment = isUnicode ? 70 : 160;
    const segmentCount = Math.ceil(messageBody.length / charsPerSegment);

    return {
      success: true,
      messageSid: data.sid,
      status: data.status,
      segmentCount,
    };
  } catch (error) {
    console.error("Twilio SMS error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Get message status from Twilio
export async function getSmsStatus(messageSid: string): Promise<{
  status: string;
  errorCode?: string;
  errorMessage?: string;
} | null> {
  const credentials = await getTwilioCredentials();

  if (!credentials) {
    return null;
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Messages/${messageSid}.json`;

    const response = await fetch(url, {
      headers: {
        "Authorization": `Basic ${Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString("base64")}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return {
      status: data.status,
      errorCode: data.error_code?.toString(),
      errorMessage: data.error_message,
    };
  } catch (error) {
    console.error("Error fetching SMS status:", error);
    return null;
  }
}

// Check if Twilio is configured
export async function isTwilioConfigured(): Promise<boolean> {
  const credentials = await getTwilioCredentials();
  return credentials !== null;
}

// Verify Twilio connection by fetching account info
export async function verifyTwilioConnection(): Promise<{
  success: boolean;
  accountSid?: string;
  accountName?: string;
  phoneNumber?: string;
  phoneNumberFormatted?: string;
  balance?: string;
  error?: string;
}> {
  const credentials = await getTwilioCredentials();

  if (!credentials) {
    return {
      success: false,
      error: "Twilio credentials not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER in environment or database.",
    };
  }

  try {
    // Fetch account info to verify credentials
    const accountUrl = `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}.json`;
    const authHeader = `Basic ${Buffer.from(`${credentials.accountSid}:${credentials.authToken}`).toString("base64")}`;

    const accountResponse = await fetch(accountUrl, {
      headers: { Authorization: authHeader },
    });

    if (!accountResponse.ok) {
      const errorData = await accountResponse.json();
      return {
        success: false,
        error: errorData.message || `Authentication failed (${accountResponse.status})`,
      };
    }

    const accountData = await accountResponse.json();

    // Verify the phone number exists and is SMS-capable
    const phoneUrl = `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(credentials.fromNumber)}`;

    const phoneResponse = await fetch(phoneUrl, {
      headers: { Authorization: authHeader },
    });

    let phoneNumberFormatted = credentials.fromNumber;
    let phoneNumberValid = false;

    if (phoneResponse.ok) {
      const phoneData = await phoneResponse.json();
      if (phoneData.incoming_phone_numbers && phoneData.incoming_phone_numbers.length > 0) {
        const phone = phoneData.incoming_phone_numbers[0];
        phoneNumberFormatted = phone.friendly_name || phone.phone_number;
        phoneNumberValid = true;
      }
    }

    // Get account balance
    const balanceUrl = `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Balance.json`;
    const balanceResponse = await fetch(balanceUrl, {
      headers: { Authorization: authHeader },
    });

    let balance: string | undefined;
    if (balanceResponse.ok) {
      const balanceData = await balanceResponse.json();
      balance = `${balanceData.currency} ${parseFloat(balanceData.balance).toFixed(2)}`;
    }

    return {
      success: true,
      accountSid: credentials.accountSid.slice(0, 8) + "..." + credentials.accountSid.slice(-4),
      accountName: accountData.friendly_name,
      phoneNumber: credentials.fromNumber,
      phoneNumberFormatted: phoneNumberValid ? phoneNumberFormatted : `${credentials.fromNumber} (not found in account)`,
      balance,
    };
  } catch (error) {
    console.error("Twilio verification error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error verifying Twilio connection",
    };
  }
}

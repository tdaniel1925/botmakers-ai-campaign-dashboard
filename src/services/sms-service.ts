import twilio from 'twilio';
import { db } from '@/db';
import { smsLogs, contacts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

interface SendSmsParams {
  toNumber: string;
  fromNumber: string;
  message: string;
  interactionId?: string;
  triggerId: string;
  contactId: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
}

interface SendSmsResult {
  success: boolean;
  twilioSid?: string;
  error?: string;
}

function getTwilioClient(accountSid?: string, authToken?: string) {
  const sid = accountSid || process.env.TWILIO_ACCOUNT_SID;
  const token = authToken || process.env.TWILIO_AUTH_TOKEN;

  if (!sid || !token) {
    throw new Error('Twilio credentials not configured');
  }

  return twilio(sid, token);
}

const OPT_OUT_MESSAGE = '\nReply STOP to opt out';

export async function sendSms(params: SendSmsParams): Promise<SendSmsResult> {
  const {
    toNumber,
    fromNumber,
    message,
    interactionId,
    triggerId,
    contactId,
    twilioAccountSid,
    twilioAuthToken,
  } = params;

  // Add opt-out message
  const fullMessage = message + OPT_OUT_MESSAGE;

  // Create initial log entry
  const [logEntry] = await db
    .insert(smsLogs)
    .values({
      interactionId,
      triggerId,
      contactId,
      toNumber,
      fromNumber,
      message: fullMessage,
      status: 'pending',
    })
    .returning();

  try {
    const client = getTwilioClient(twilioAccountSid, twilioAuthToken);

    const result = await client.messages.create({
      body: fullMessage,
      to: toNumber,
      from: fromNumber,
    });

    // Update log with success
    await db
      .update(smsLogs)
      .set({
        status: 'sent',
        twilioSid: result.sid,
      })
      .where(eq(smsLogs.id, logEntry.id));

    // Update contact's triggered list
    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .limit(1);

    if (contact) {
      const currentTriggers = (contact.smsTriggersfred as string[]) || [];
      if (!currentTriggers.includes(triggerId)) {
        await db
          .update(contacts)
          .set({
            smsTriggersfred: [...currentTriggers, triggerId],
          })
          .where(eq(contacts.id, contactId));
      }
    }

    return {
      success: true,
      twilioSid: result.sid,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update log with failure
    await db
      .update(smsLogs)
      .set({
        status: 'failed',
        errorMessage,
      })
      .where(eq(smsLogs.id, logEntry.id));

    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function verifyTwilioCredentials(
  accountSid: string,
  authToken: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const client = twilio(accountSid, authToken);
    await client.api.accounts(accountSid).fetch();
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid credentials',
    };
  }
}

export function validatePhoneNumber(phone: string): boolean {
  // Basic E.164 validation
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // If no + at start, assume US number
  if (!cleaned.startsWith('+')) {
    // Remove any leading 1 and re-add with +
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      cleaned = '+' + cleaned;
    } else if (cleaned.length === 10) {
      cleaned = '+1' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }

  return cleaned;
}

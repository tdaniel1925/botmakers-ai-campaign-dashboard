/**
 * Upstash QStash Scheduler Service
 * Handles scheduling outbound calls based on campaign schedules and contact timezones
 */

import { Client } from "@upstash/qstash";

// Initialize QStash client
const getQStashClient = () => {
  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    throw new Error("QSTASH_TOKEN environment variable not set");
  }
  return new Client({ token });
};

export interface ScheduledCall {
  campaignId: string;
  contactId: string;
  phoneNumber: string;
  scheduledFor: Date;
  attemptNumber: number;
}

export interface CampaignScheduleConfig {
  campaignId: string;
  daysOfWeek: number[];
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  timezone: string;
  maxConcurrentCalls: number;
}

/**
 * Schedule a batch of calls for processing
 */
export async function scheduleCallBatch(
  calls: ScheduledCall[],
  baseUrl: string
): Promise<{ scheduled: number; failed: number }> {
  const qstash = getQStashClient();
  let scheduled = 0;
  let failed = 0;

  for (const call of calls) {
    try {
      const delay = Math.max(0, call.scheduledFor.getTime() - Date.now());

      await qstash.publishJSON({
        url: `${baseUrl}/api/scheduler/process-call`,
        body: {
          campaignId: call.campaignId,
          contactId: call.contactId,
          phoneNumber: call.phoneNumber,
          attemptNumber: call.attemptNumber,
        },
        delay: Math.floor(delay / 1000), // Convert to seconds
        retries: 3,
      });

      scheduled++;
    } catch (error) {
      console.error("Failed to schedule call:", error);
      failed++;
    }
  }

  return { scheduled, failed };
}

/**
 * Schedule campaign processing job
 * This job runs periodically to queue up calls for active campaigns
 */
export async function scheduleCampaignProcessor(
  campaignId: string,
  baseUrl: string,
  intervalMinutes: number = 5
): Promise<string> {
  const qstash = getQStashClient();

  const result = await qstash.publishJSON({
    url: `${baseUrl}/api/scheduler/process-campaign`,
    body: { campaignId },
    delay: intervalMinutes * 60, // Convert to seconds
    retries: 3,
  });

  return result.messageId;
}

/**
 * Schedule SMS follow-up
 */
export async function scheduleSmsFollowup(
  campaignId: string,
  contactId: string,
  templateId: string,
  phoneNumber: string,
  delayMinutes: number,
  baseUrl: string
): Promise<string> {
  const qstash = getQStashClient();

  const result = await qstash.publishJSON({
    url: `${baseUrl}/api/scheduler/send-sms`,
    body: {
      campaignId,
      contactId,
      templateId,
      phoneNumber,
    },
    delay: delayMinutes * 60, // Convert to seconds
    retries: 3,
  });

  return result.messageId;
}

/**
 * Schedule retry call
 */
export async function scheduleRetryCall(
  campaignId: string,
  contactId: string,
  phoneNumber: string,
  attemptNumber: number,
  delayMinutes: number,
  baseUrl: string
): Promise<string> {
  const qstash = getQStashClient();

  const result = await qstash.publishJSON({
    url: `${baseUrl}/api/scheduler/process-call`,
    body: {
      campaignId,
      contactId,
      phoneNumber,
      attemptNumber,
    },
    delay: delayMinutes * 60,
    retries: 3,
  });

  return result.messageId;
}

/**
 * Cancel all scheduled jobs for a campaign
 */
export async function cancelCampaignJobs(campaignId: string): Promise<void> {
  // Note: QStash doesn't support canceling by metadata
  // We'll handle this by checking campaign status in the job handler
  console.log(`Campaign ${campaignId} jobs will be skipped on execution`);
}

/**
 * Calculate next available call time based on schedule and contact timezone
 */
export function calculateNextCallTime(
  schedule: CampaignScheduleConfig,
  contactTimezone: string
): Date | null {
  const now = new Date();

  // Get current time in contact's timezone
  const contactNow = new Date(
    now.toLocaleString("en-US", { timeZone: contactTimezone })
  );

  // Parse schedule times
  const [startHour, startMinute] = schedule.startTime.split(":").map(Number);
  const [endHour, endMinute] = schedule.endTime.split(":").map(Number);

  // Check if today is a valid day
  const currentDay = contactNow.getDay();

  // Find the next valid time slot
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const checkDay = (currentDay + dayOffset) % 7;

    if (!schedule.daysOfWeek.includes(checkDay)) {
      continue;
    }

    // Calculate the target time
    const targetDate = new Date(contactNow);
    targetDate.setDate(targetDate.getDate() + dayOffset);

    if (dayOffset === 0) {
      // Today - check if we're within the window
      const currentMinutes = contactNow.getHours() * 60 + contactNow.getMinutes();
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;

      if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        // Within window - can call now
        return now;
      } else if (currentMinutes < startMinutes) {
        // Before window - schedule for start time
        targetDate.setHours(startHour, startMinute, 0, 0);
        // Convert back to UTC
        return convertToUTC(targetDate, contactTimezone);
      }
      // Past window - try next day
      continue;
    } else {
      // Future day - schedule for start time
      targetDate.setHours(startHour, startMinute, 0, 0);
      return convertToUTC(targetDate, contactTimezone);
    }
  }

  return null; // No valid time found
}

/**
 * Convert a date in a specific timezone to UTC
 */
function convertToUTC(date: Date, timezone: string): Date {
  const utcDate = new Date(
    date.toLocaleString("en-US", { timeZone: "UTC" })
  );
  const tzDate = new Date(
    date.toLocaleString("en-US", { timeZone: timezone })
  );
  const offset = tzDate.getTime() - utcDate.getTime();
  return new Date(date.getTime() - offset);
}

/**
 * Check if current time is within calling window for a contact
 */
export function isWithinCallingWindow(
  schedule: CampaignScheduleConfig,
  contactTimezone: string
): boolean {
  const now = new Date();

  // Get current time in contact's timezone
  const contactNow = new Date(
    now.toLocaleString("en-US", { timeZone: contactTimezone })
  );

  // Check if today is a valid day
  const currentDay = contactNow.getDay();
  if (!schedule.daysOfWeek.includes(currentDay)) {
    return false;
  }

  // Parse schedule times
  const [startHour, startMinute] = schedule.startTime.split(":").map(Number);
  const [endHour, endMinute] = schedule.endTime.split(":").map(Number);

  const currentMinutes = contactNow.getHours() * 60 + contactNow.getMinutes();
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

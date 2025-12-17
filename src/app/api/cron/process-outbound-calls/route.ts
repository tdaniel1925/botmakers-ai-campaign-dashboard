import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { outboundCampaigns, outboundContacts, outboundSchedules, outboundCallLogs } from '@/db/schema';
import { eq, and, lt, lte, or, isNull, sql, inArray } from 'drizzle-orm';
import { createOutboundCall, getVapiCall, mapVapiStatusToResult, calculateCallDuration, formatVapiTranscript } from '@/services/vapi-service';
import { isWithinCallingHours } from '@/services/contact-upload-service';

// Verify cron secret for security
const CRON_SECRET = process.env.CRON_SECRET;

// GET - Process outbound call queue (called by Vercel Cron)
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = {
      campaignsProcessed: 0,
      callsInitiated: 0,
      errors: [] as string[],
    };

    // Find all running campaigns
    const runningCampaigns = await db
      .select()
      .from(outboundCampaigns)
      .where(eq(outboundCampaigns.status, 'running'));

    for (const campaign of runningCampaigns) {
      try {
        // Check if campaign has VAPI config
        if (!campaign.vapiAssistantId || !campaign.vapiPhoneNumberId) {
          results.errors.push(`Campaign ${campaign.id}: Missing VAPI configuration`);
          continue;
        }

        // Get campaign schedules
        const schedules = await db
          .select()
          .from(outboundSchedules)
          .where(
            and(
              eq(outboundSchedules.campaignId, campaign.id),
              eq(outboundSchedules.isActive, true)
            )
          );

        // Count currently active calls for this campaign
        const [{ count: activeCalls }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(outboundContacts)
          .where(
            and(
              eq(outboundContacts.campaignId, campaign.id),
              eq(outboundContacts.status, 'calling')
            )
          );

        const availableSlots = campaign.maxConcurrentCalls - activeCalls;
        if (availableSlots <= 0) {
          continue; // Campaign at capacity
        }

        // Find contacts ready to call
        const now = new Date();
        const contactsToCall = await db
          .select()
          .from(outboundContacts)
          .where(
            and(
              eq(outboundContacts.campaignId, campaign.id),
              or(
                eq(outboundContacts.status, 'pending'),
                and(
                  eq(outboundContacts.status, 'queued'),
                  or(
                    isNull(outboundContacts.nextAttemptAt),
                    lte(outboundContacts.nextAttemptAt, now)
                  )
                )
              ),
              lt(outboundContacts.attemptCount, campaign.maxRetries + 1)
            )
          )
          .limit(availableSlots);

        // Filter by timezone and schedule
        const eligibleContacts = contactsToCall.filter((contact) => {
          if (!contact.timezone) return true; // No timezone = assume OK

          const currentDay = new Date().getDay();
          const applicableSchedule = schedules.find(
            (s) => s.dayOfWeek === currentDay
          );

          if (!applicableSchedule) return false;

          const [startHour] = applicableSchedule.startTime.split(':').map(Number);
          const [endHour] = applicableSchedule.endTime.split(':').map(Number);

          return isWithinCallingHours(contact.timezone, startHour, endHour);
        });

        // Process eligible contacts
        for (const contact of eligibleContacts) {
          try {
            // Mark contact as calling
            await db
              .update(outboundContacts)
              .set({
                status: 'calling',
                lastAttemptAt: now,
                attemptCount: contact.attemptCount + 1,
                updatedAt: now,
              })
              .where(eq(outboundContacts.id, contact.id));

            // Note: In production, you would need to securely retrieve the VAPI API key
            // This could be from an encrypted storage or session-based approach
            // For now, we'll use an environment variable as a fallback
            const vapiApiKey = process.env.VAPI_PRIVATE_KEY;

            if (!vapiApiKey) {
              results.errors.push(`Campaign ${campaign.id}: No VAPI API key available`);

              // Reset contact status
              await db
                .update(outboundContacts)
                .set({ status: 'pending', updatedAt: now })
                .where(eq(outboundContacts.id, contact.id));
              continue;
            }

            // Initiate call via VAPI
            const call = await createOutboundCall(vapiApiKey, {
              assistantId: campaign.vapiAssistantId!,
              phoneNumberId: campaign.vapiPhoneNumberId!,
              customerNumber: contact.phoneNumber,
              customerName: `${contact.firstName} ${contact.lastName || ''}`.trim(),
              assistantOverrides: {
                variableValues: {
                  firstName: contact.firstName,
                  lastName: contact.lastName || '',
                  ...(contact.customFields as Record<string, string> || {}),
                },
              },
            });

            // Create call log entry
            await db.insert(outboundCallLogs).values({
              campaignId: campaign.id,
              contactId: contact.id,
              vapiCallId: call.id,
              attemptNumber: contact.attemptCount + 1,
              startedAt: now,
            });

            results.callsInitiated++;
          } catch (callError) {
            results.errors.push(
              `Contact ${contact.id}: ${callError instanceof Error ? callError.message : 'Call failed'}`
            );

            // Mark contact for retry
            const retryAt = new Date(now.getTime() + campaign.retryDelayHours * 60 * 60 * 1000);
            await db
              .update(outboundContacts)
              .set({
                status: contact.attemptCount + 1 >= campaign.maxRetries + 1 ? 'failed' : 'queued',
                callResult: 'failed',
                nextAttemptAt: retryAt,
                updatedAt: now,
              })
              .where(eq(outboundContacts.id, contact.id));
          }
        }

        results.campaignsProcessed++;
      } catch (campaignError) {
        results.errors.push(
          `Campaign ${campaign.id}: ${campaignError instanceof Error ? campaignError.message : 'Processing failed'}`
        );
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Cron job failed' },
      { status: 500 }
    );
  }
}

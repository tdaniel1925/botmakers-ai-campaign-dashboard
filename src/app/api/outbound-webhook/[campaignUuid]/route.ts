import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { outboundCampaigns, outboundContacts, outboundCallLogs, smsTriggers } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { mapVapiStatusToResult, calculateCallDuration, formatVapiTranscript, VapiCall } from '@/services/vapi-service';
import { analyzePayload, evaluateTriggers } from '@/services/ai-processor';
import { sendSms, normalizePhoneNumber } from '@/services/sms-service';

type RouteParams = {
  params: Promise<{ campaignUuid: string }>;
};

interface VapiWebhookPayload {
  type: string;
  call?: VapiCall;
  message?: {
    type: string;
    role?: string;
    transcript?: string;
    endedReason?: string;
    call?: VapiCall;
  };
}

// POST - Handle VAPI webhook events
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { campaignUuid } = await params;

  try {
    const payload: VapiWebhookPayload = await req.json();

    // Find campaign by webhook UUID
    const [campaign] = await db
      .select()
      .from(outboundCampaigns)
      .where(eq(outboundCampaigns.webhookUuid, campaignUuid))
      .limit(1);

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Handle different webhook event types
    const eventType = payload.type || payload.message?.type;
    const callData = payload.call || payload.message?.call;

    if (!callData || !callData.id) {
      return NextResponse.json({ received: true, skipped: 'No call data' });
    }

    // Find the call log by VAPI call ID
    const [callLog] = await db
      .select()
      .from(outboundCallLogs)
      .where(eq(outboundCallLogs.vapiCallId, callData.id))
      .limit(1);

    if (!callLog) {
      // Might be a call we didn't initiate
      return NextResponse.json({ received: true, skipped: 'Call not found' });
    }

    // Handle call ended event
    if (eventType === 'end-of-call-report' || eventType === 'call-ended' || callData.status === 'ended') {
      const callResult = mapVapiStatusToResult(callData);
      const durationSeconds = calculateCallDuration(callData);
      const transcript = callData.transcript || formatVapiTranscript(callData.messages);

      // Get AI summary and analysis
      let aiSummary = callData.analysis?.summary || callData.summary;
      let aiExtractedData = callData.analysis?.structuredData;

      // If no AI analysis from VAPI, run our own
      if (!aiSummary && transcript) {
        try {
          const analysis = await analyzePayload(
            { transcript, callResult, customerNumber: callData.customer?.number },
            campaign.aiExtractionHints as Record<string, string> | undefined
          );
          aiSummary = analysis.extractedData.summary;
          aiExtractedData = analysis.extractedData as Record<string, unknown>;
        } catch {
          // Ignore analysis errors
        }
      }

      // Update call log
      // Transform messages to expected format
      const formattedMessages = callData.messages?.map(m => ({
        role: m.role,
        content: m.message || '',
      })) || null;

      await db
        .update(outboundCallLogs)
        .set({
          callResult,
          durationSeconds,
          transcript,
          transcriptFormatted: formattedMessages,
          recordingUrl: callData.recordingUrl || callData.artifact?.recordingUrl,
          aiSummary,
          aiExtractedData,
          rawPayload: callData as unknown as Record<string, unknown>,
          endedAt: callData.endedAt ? new Date(callData.endedAt) : new Date(),
        })
        .where(eq(outboundCallLogs.id, callLog.id));

      // Update contact status
      const [contact] = await db
        .select()
        .from(outboundContacts)
        .where(eq(outboundContacts.id, callLog.contactId))
        .limit(1);

      if (contact) {
        let newStatus: typeof contact.status = 'completed';
        let nextAttemptAt: Date | null = null;

        // Determine if we should retry
        if (callResult !== 'answered' && contact.attemptCount < campaign.maxRetries + 1) {
          newStatus = 'queued';
          nextAttemptAt = new Date(Date.now() + campaign.retryDelayHours * 60 * 60 * 1000);

          // Map VAPI result to contact status
          if (callResult === 'no_answer') newStatus = 'no_answer' as typeof newStatus;
          else if (callResult === 'busy') newStatus = 'busy' as typeof newStatus;
          else if (callResult === 'voicemail') newStatus = 'voicemail' as typeof newStatus;
          else if (callResult === 'failed') newStatus = 'failed' as typeof newStatus;
        }

        await db
          .update(outboundContacts)
          .set({
            status: newStatus,
            callResult,
            callDurationSeconds: durationSeconds,
            nextAttemptAt,
            updatedAt: new Date(),
          })
          .where(eq(outboundContacts.id, contact.id));

        // Update campaign stats
        const isAnswered = callResult === 'answered';
        const isFailed = (newStatus as string) === 'failed' || (callResult !== 'answered' && contact.attemptCount >= campaign.maxRetries);

        await db
          .update(outboundCampaigns)
          .set({
            contactsCalled: sql`${outboundCampaigns.contactsCalled} + 1`,
            contactsAnswered: isAnswered
              ? sql`${outboundCampaigns.contactsAnswered} + 1`
              : outboundCampaigns.contactsAnswered,
            contactsFailed: isFailed
              ? sql`${outboundCampaigns.contactsFailed} + 1`
              : outboundCampaigns.contactsFailed,
            updatedAt: new Date(),
          })
          .where(eq(outboundCampaigns.id, campaign.id));

        // Handle SMS triggers for answered calls
        if (callResult === 'answered' && transcript && campaign.twilioPhoneNumber) {
          try {
            // Get active triggers for this campaign
            const activeTriggers = await db
              .select()
              .from(smsTriggers)
              .where(
                and(
                  eq(smsTriggers.campaignId, campaign.id),
                  eq(smsTriggers.isActive, true)
                )
              );

            if (activeTriggers.length > 0) {
              const firedTriggers = (contact.smsTriggersfred as string[]) || [];
              const eligibleTriggers = activeTriggers.filter(
                (t) => !firedTriggers.includes(t.id)
              );

              if (eligibleTriggers.length > 0) {
                const matchedTriggerIds = await evaluateTriggers(
                  transcript,
                  aiSummary || '',
                  eligibleTriggers.map((t) => ({
                    id: t.id,
                    intentDescription: t.intentDescription,
                    priority: t.priority,
                  }))
                );

                for (const triggerId of matchedTriggerIds) {
                  const trigger = eligibleTriggers.find((t) => t.id === triggerId);
                  if (!trigger) continue;

                  await sendSms({
                    toNumber: normalizePhoneNumber(contact.phoneNumber),
                    fromNumber: campaign.twilioPhoneNumber!,
                    message: trigger.smsMessage,
                    interactionId: callLog.id, // Using call log ID as interaction
                    triggerId: trigger.id,
                    contactId: contact.id,
                  });

                  // Update call log with SMS info
                  await db
                    .update(outboundCallLogs)
                    .set({
                      smsSent: true,
                      smsTriggerId: trigger.id,
                    })
                    .where(eq(outboundCallLogs.id, callLog.id));
                }
              }
            }
          } catch {
            // Ignore SMS errors
          }
        }

        // Check if campaign is complete
        const [{ pending }] = await db
          .select({ pending: sql<number>`count(*)::int` })
          .from(outboundContacts)
          .where(
            and(
              eq(outboundContacts.campaignId, campaign.id),
              sql`${outboundContacts.status} NOT IN ('completed', 'failed', 'dnc', 'skipped')`
            )
          );

        if (pending === 0) {
          await db
            .update(outboundCampaigns)
            .set({
              status: 'completed',
              completedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(outboundCampaigns.id, campaign.id));
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Outbound webhook error:', error);
    return NextResponse.json({ received: true, error: 'Processing failed' });
  }
}

// GET - Verify webhook endpoint
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { campaignUuid } = await params;

  const [campaign] = await db
    .select({ id: outboundCampaigns.id, name: outboundCampaigns.name })
    .from(outboundCampaigns)
    .where(eq(outboundCampaigns.webhookUuid, campaignUuid))
    .limit(1);

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  return NextResponse.json({
    valid: true,
    campaignName: campaign.name,
    type: 'outbound',
  });
}

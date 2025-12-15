import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { campaigns, interactions, contacts, smsTriggers, webhookErrorLogs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { analyzePayload, evaluateTriggers } from '@/services/ai-processor';
import { sendSms, normalizePhoneNumber, validatePhoneNumber } from '@/services/sms-service';
import { generateHash } from '@/lib/utils';

type RouteParams = {
  params: Promise<{ campaignUuid: string }>;
};

// POST - Receive webhook payload
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { campaignUuid } = await params;
  let rawBody = '';

  try {
    // Get raw body for parsing
    rawBody = await req.text();

    // Validate JSON
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      // Log error and return 400
      await db.insert(webhookErrorLogs).values({
        campaignId: null, // We don't know the campaign yet
        rawBody: rawBody.substring(0, 10000), // Limit size
        errorType: 'invalid_json',
        errorMessage: 'Failed to parse JSON payload',
      });

      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Find campaign by webhook UUID
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.webhookUuid, campaignUuid))
      .limit(1);

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      );
    }

    if (!campaign.isActive) {
      return NextResponse.json(
        { error: 'Campaign is not active' },
        { status: 400 }
      );
    }

    // Generate payload hash for deduplication
    const payloadHash = generateHash(rawBody);

    // Check for duplicate (within last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingInteraction = await db.query.interactions.findFirst({
      where: and(
        eq(interactions.campaignId, campaign.id),
        eq(interactions.payloadHash, payloadHash)
      ),
    });

    if (existingInteraction && existingInteraction.createdAt > fiveMinutesAgo) {
      // Duplicate payload, skip processing
      return NextResponse.json({
        received: true,
        duplicate: true,
        interactionId: existingInteraction.id,
      });
    }

    // Process payload asynchronously
    // For now, we'll process synchronously but acknowledge quickly
    // In production, you'd want to use a queue (Supabase Edge Functions, Inngest, etc.)

    try {
      // Analyze payload with AI
      const analysis = await analyzePayload(
        payload,
        campaign.aiExtractionHints as Record<string, string> | undefined
      );

      // Get or create contact
      let contactId: string | null = null;
      const phoneNumber = analysis.extractedData.phoneNumber;

      if (phoneNumber && validatePhoneNumber(normalizePhoneNumber(phoneNumber))) {
        const normalizedPhone = normalizePhoneNumber(phoneNumber);

        const [existingContact] = await db
          .select()
          .from(contacts)
          .where(
            and(
              eq(contacts.campaignId, campaign.id),
              eq(contacts.phoneNumber, normalizedPhone)
            )
          )
          .limit(1);

        if (existingContact) {
          contactId = existingContact.id;
        } else {
          const [newContact] = await db
            .insert(contacts)
            .values({
              campaignId: campaign.id,
              phoneNumber: normalizedPhone,
            })
            .returning();
          contactId = newContact.id;
        }
      }

      // Create interaction record
      const [interaction] = await db
        .insert(interactions)
        .values({
          campaignId: campaign.id,
          contactId,
          sourceType: analysis.sourceType,
          sourcePlatform: analysis.sourcePlatform,
          phoneNumber: phoneNumber ? normalizePhoneNumber(phoneNumber) : null,
          callStatus: analysis.callStatus,
          durationSeconds: analysis.durationSeconds,
          transcript: analysis.transcript,
          transcriptFormatted: analysis.transcriptFormatted,
          recordingUrl: analysis.recordingUrl,
          aiSummary: analysis.extractedData.summary,
          aiExtractedData: analysis.extractedData as Record<string, unknown>,
          rawPayload: payload,
          payloadHash,
        })
        .returning();

      // Evaluate SMS triggers if we have a transcript or summary and a contact
      if (contactId && (analysis.transcript || analysis.extractedData.summary)) {
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
          // Get contact's already-fired triggers
          const [contact] = await db
            .select()
            .from(contacts)
            .where(eq(contacts.id, contactId))
            .limit(1);

          const firedTriggers = (contact?.smsTriggersfred as string[]) || [];

          // Filter out already-fired triggers
          const eligibleTriggers = activeTriggers.filter(
            (t) => !firedTriggers.includes(t.id)
          );

          if (eligibleTriggers.length > 0 && campaign.twilioPhoneNumber) {
            // Evaluate which triggers match
            const matchedTriggerIds = await evaluateTriggers(
              analysis.transcript,
              analysis.extractedData.summary,
              eligibleTriggers.map((t) => ({
                id: t.id,
                intentDescription: t.intentDescription,
                priority: t.priority,
              }))
            );

            // Send SMS for each matched trigger
            for (const triggerId of matchedTriggerIds) {
              const trigger = eligibleTriggers.find((t) => t.id === triggerId);
              if (!trigger) continue;

              const normalizedPhone = normalizePhoneNumber(phoneNumber!);

              await sendSms({
                toNumber: normalizedPhone,
                fromNumber: campaign.twilioPhoneNumber,
                message: trigger.smsMessage,
                interactionId: interaction.id,
                triggerId: trigger.id,
                contactId,
                twilioAccountSid: campaign.twilioOverride
                  ? campaign.twilioAccountSid || undefined
                  : undefined,
                twilioAuthToken: campaign.twilioOverride
                  ? campaign.twilioAuthToken || undefined
                  : undefined,
              });
            }
          }
        }
      }

      return NextResponse.json({
        received: true,
        interactionId: interaction.id,
        sourceType: analysis.sourceType,
        sourcePlatform: analysis.sourcePlatform,
      });
    } catch (processingError) {
      // Log processing error but still return success (we received the webhook)
      console.error('Webhook processing error:', processingError);

      await db.insert(webhookErrorLogs).values({
        campaignId: campaign.id,
        rawBody: rawBody.substring(0, 10000),
        errorType: 'processing_error',
        errorMessage:
          processingError instanceof Error
            ? processingError.message
            : 'Unknown processing error',
      });

      // Still create a basic interaction record
      const [interaction] = await db
        .insert(interactions)
        .values({
          campaignId: campaign.id,
          sourceType: 'phone',
          rawPayload: payload,
          payloadHash,
        })
        .returning();

      return NextResponse.json({
        received: true,
        interactionId: interaction.id,
        processingError: true,
      });
    }
  } catch (error) {
    console.error('Webhook error:', error);

    // Try to log the error
    try {
      await db.insert(webhookErrorLogs).values({
        rawBody: rawBody.substring(0, 10000),
        errorType: 'server_error',
        errorMessage:
          error instanceof Error ? error.message : 'Unknown server error',
      });
    } catch {
      // Ignore logging errors
    }

    // Return 200 to prevent retries for unrecoverable errors
    return NextResponse.json({
      received: true,
      error: 'Processing failed',
    });
  }
}

// GET - Verify webhook endpoint exists
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { campaignUuid } = await params;

  const [campaign] = await db
    .select({ id: campaigns.id, name: campaigns.name, isActive: campaigns.isActive })
    .from(campaigns)
    .where(eq(campaigns.webhookUuid, campaignUuid))
    .limit(1);

  if (!campaign) {
    return NextResponse.json(
      { error: 'Campaign not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    valid: true,
    campaignName: campaign.name,
    active: campaign.isActive,
  });
}

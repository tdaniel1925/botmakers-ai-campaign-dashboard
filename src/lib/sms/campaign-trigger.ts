/**
 * Intent-Based SMS Trigger for All Campaigns
 * Works for both inbound and outbound campaigns
 *
 * This module uses AI to evaluate call transcripts against natural language
 * conditions to determine if an SMS should be sent.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { sendSms } from "./twilio";
import OpenAI from "openai";

// ============================================
// Types
// ============================================

interface CallData {
  id: string;
  campaignId: string;
  campaignType: "inbound" | "outbound";
  phoneNumber: string;
  firstName?: string | null;
  transcript: string | null;
  summary?: string | null;
  outcome?: string | null;
  structuredData?: Record<string, unknown> | null;
}

interface SmsRule {
  id: string;
  name: string;
  triggerCondition: string;
  messageTemplate: string;
  priority: number;
}

interface EvaluationResult {
  shouldTrigger: boolean;
  ruleId: string | null;
  ruleName: string | null;
  confidence: number;
  reason: string;
}

interface ProcessSmsResult {
  processed: boolean;
  sent: boolean;
  smsId?: string;
  ruleId?: string;
  ruleName?: string;
  reason: string;
  error?: string;
}

// ============================================
// AI Client
// ============================================

async function getAIClient(): Promise<OpenAI | null> {
  // Try database first
  try {
    const supabase = await createServiceClient();
    const { data: apiKey } = await supabase
      .from("api_keys")
      .select("key_data, service")
      .in("service", ["openai", "deepseek"])
      .eq("is_active", true)
      .limit(1)
      .single();

    if (apiKey?.key_data) {
      const keyData = apiKey.key_data as { api_key?: string };
      if (keyData.api_key) {
        const baseURL = apiKey.service === "deepseek"
          ? "https://api.deepseek.com"
          : undefined;
        return new OpenAI({ apiKey: keyData.api_key, baseURL });
      }
    }
  } catch {
    // Fall back to env vars
  }

  // Fall back to environment
  if (process.env.OPENAI_API_KEY) {
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  if (process.env.DEEPSEEK_API_KEY) {
    return new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    });
  }

  return null;
}

// ============================================
// AI Evaluation
// ============================================

async function evaluateSmsRules(
  call: CallData,
  rules: SmsRule[]
): Promise<EvaluationResult> {
  if (rules.length === 0) {
    return {
      shouldTrigger: false,
      ruleId: null,
      ruleName: null,
      confidence: 0,
      reason: "No active SMS rules configured",
    };
  }

  if (!call.transcript || call.transcript.trim().length === 0) {
    return {
      shouldTrigger: false,
      ruleId: null,
      ruleName: null,
      confidence: 0,
      reason: "No transcript available to evaluate",
    };
  }

  const ai = await getAIClient();
  if (!ai) {
    console.error("[SMS Trigger] No AI client configured");
    return {
      shouldTrigger: false,
      ruleId: null,
      ruleName: null,
      confidence: 0,
      reason: "AI client not configured",
    };
  }

  // Build context about the call
  const callContext = `
Call Summary: ${call.summary || "Not available"}
Call Outcome: ${call.outcome || "Not determined"}
${call.structuredData ? `Collected Data: ${JSON.stringify(call.structuredData)}` : ""}

Transcript (last 3000 chars):
${call.transcript.slice(-3000)}
`.trim();

  // Build rules list
  const rulesText = rules
    .map((r, i) => `Rule ${i + 1} (ID: ${r.id}, Name: "${r.name}"): "${r.triggerCondition}"`)
    .join("\n");

  const prompt = `You are an SMS trigger evaluator. Based on the phone call data below, determine if ANY of the SMS rules should be triggered to send a follow-up message.

IMPORTANT: Analyze the INTENT and MEANING of the conversation, not just keywords. Look for:
- What the customer wanted or expressed interest in
- Any commitments or agreements made
- Requests for information or follow-up
- The overall tone and outcome of the conversation

CALL DATA:
${callContext}

SMS RULES TO EVALUATE (in priority order):
${rulesText}

Analyze each rule's trigger condition against the call transcript and outcome. A rule should trigger if the conversation's INTENT matches the condition described, even if the exact words aren't used.

Respond in JSON format:
{
  "shouldTrigger": boolean,
  "ruleId": "the ID of the rule that should trigger (or null if none)",
  "ruleName": "the name of the triggered rule (or null if none)",
  "confidence": number between 0 and 1 (how confident you are in this decision),
  "reason": "brief explanation (1-2 sentences) of why this rule was triggered or why no rule matched"
}

Only trigger ONE rule (the first matching rule by priority). If no rules match the conversation intent, set shouldTrigger to false.`;

  try {
    const response = await ai.chat.completions.create({
      model: process.env.DEEPSEEK_API_KEY ? "deepseek-chat" : "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2, // Lower temperature for more consistent evaluation
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {
        shouldTrigger: false,
        ruleId: null,
        ruleName: null,
        confidence: 0,
        reason: "AI returned empty response",
      };
    }

    const result = JSON.parse(content) as EvaluationResult;

    // Validate that the ruleId exists
    if (result.shouldTrigger && result.ruleId) {
      const matchedRule = rules.find((r) => r.id === result.ruleId);
      if (!matchedRule) {
        // AI returned invalid rule ID, try to find by name
        const byName = rules.find((r) =>
          r.name.toLowerCase() === result.ruleName?.toLowerCase()
        );
        if (byName) {
          result.ruleId = byName.id;
          result.ruleName = byName.name;
        } else {
          console.warn("[SMS Trigger] AI returned invalid rule ID:", result.ruleId);
          result.shouldTrigger = false;
          result.reason = "AI returned invalid rule reference";
        }
      }
    }

    return result;
  } catch (error) {
    console.error("[SMS Trigger] Error evaluating SMS rules:", error);
    return {
      shouldTrigger: false,
      ruleId: null,
      ruleName: null,
      confidence: 0,
      reason: `AI evaluation error: ${error instanceof Error ? error.message : "Unknown"}`,
    };
  }
}

// ============================================
// Template Processing
// ============================================

function processMessageTemplate(
  template: string,
  call: CallData
): string {
  let message = template;

  // Replace common variables
  const variables: Record<string, string> = {
    "{{first_name}}": call.firstName || "there",
    "{{firstName}}": call.firstName || "there",
    "{{name}}": call.firstName || "there",
    "{{phone}}": call.phoneNumber,
    "{{phone_number}}": call.phoneNumber,
  };

  // Add structured data variables if available
  if (call.structuredData) {
    for (const [key, value] of Object.entries(call.structuredData)) {
      if (value !== null && value !== undefined) {
        variables[`{{${key}}}`] = String(value);
        variables[`{{structured.${key}}}`] = String(value);
      }
    }
  }

  // Replace all variables
  for (const [placeholder, value] of Object.entries(variables)) {
    message = message.replace(new RegExp(placeholder.replace(/[{}]/g, "\\$&"), "gi"), value);
  }

  return message;
}

// ============================================
// Main Processing Functions
// ============================================

/**
 * Process an outbound campaign call for SMS
 */
export async function processOutboundCallForSms(
  callId: string,
  campaignId: string
): Promise<ProcessSmsResult> {
  const supabase = await createServiceClient();

  console.log(`[SMS Trigger] Processing outbound call ${callId} for campaign ${campaignId}`);

  // Get call data
  const { data: call, error: callError } = await supabase
    .from("campaign_calls")
    .select(`
      id,
      phone_number,
      first_name,
      transcript,
      summary,
      outcome,
      structured_data,
      contact_id
    `)
    .eq("id", callId)
    .single();

  if (callError || !call) {
    return {
      processed: false,
      sent: false,
      reason: "Call not found",
      error: callError?.message,
    };
  }

  if (!call.phone_number) {
    return {
      processed: false,
      sent: false,
      reason: "No phone number on call record",
    };
  }

  // Get active SMS rules for this campaign
  const { data: rules, error: rulesError } = await supabase
    .from("outbound_campaign_sms_rules")
    .select("id, name, trigger_condition, message_template, priority")
    .eq("campaign_id", campaignId)
    .eq("is_active", true)
    .order("priority", { ascending: false });

  if (rulesError) {
    return {
      processed: false,
      sent: false,
      reason: "Error fetching SMS rules",
      error: rulesError.message,
    };
  }

  if (!rules || rules.length === 0) {
    return {
      processed: true,
      sent: false,
      reason: "No active SMS rules for this campaign",
    };
  }

  // Map to interface
  const mappedRules: SmsRule[] = rules.map((r) => ({
    id: r.id,
    name: r.name,
    triggerCondition: r.trigger_condition,
    messageTemplate: r.message_template,
    priority: r.priority,
  }));

  // Evaluate rules using AI
  const evaluation = await evaluateSmsRules(
    {
      id: call.id,
      campaignId,
      campaignType: "outbound",
      phoneNumber: call.phone_number,
      firstName: call.first_name,
      transcript: call.transcript,
      summary: call.summary,
      outcome: call.outcome,
      structuredData: call.structured_data as Record<string, unknown> | null,
    },
    mappedRules
  );

  console.log(`[SMS Trigger] Evaluation result:`, evaluation);

  if (!evaluation.shouldTrigger || !evaluation.ruleId) {
    // Log that we evaluated but didn't trigger
    return {
      processed: true,
      sent: false,
      reason: evaluation.reason,
    };
  }

  // Find the matched rule
  const matchedRule = mappedRules.find((r) => r.id === evaluation.ruleId);
  if (!matchedRule) {
    return {
      processed: true,
      sent: false,
      reason: "Matched rule not found",
    };
  }

  // Process message template
  const messageBody = processMessageTemplate(matchedRule.messageTemplate, {
    id: call.id,
    campaignId,
    campaignType: "outbound",
    phoneNumber: call.phone_number,
    firstName: call.first_name,
    transcript: call.transcript,
    summary: call.summary,
    outcome: call.outcome,
    structuredData: call.structured_data as Record<string, unknown> | null,
  });

  // Create SMS record (pending)
  const { data: smsRecord, error: smsError } = await supabase
    .from("campaign_sms")
    .insert({
      campaign_id: campaignId,
      call_id: callId,
      contact_id: call.contact_id,
      rule_id: matchedRule.id,
      message_body: messageBody,
      phone_number: call.phone_number,
      recipient_name: call.first_name,
      status: "pending",
      ai_evaluation_reason: evaluation.reason,
      ai_confidence: evaluation.confidence,
    })
    .select("id")
    .single();

  if (smsError || !smsRecord) {
    console.error("[SMS Trigger] Error creating SMS record:", smsError);
    return {
      processed: true,
      sent: false,
      ruleId: matchedRule.id,
      ruleName: matchedRule.name,
      reason: "Failed to create SMS record",
      error: smsError?.message,
    };
  }

  // Send the SMS
  const smsResult = await sendSms({
    to: call.phone_number,
    body: messageBody,
  });

  // Update SMS record with result
  const updateData: Record<string, unknown> = {
    status: smsResult.success ? "sent" : "failed",
  };

  if (smsResult.success) {
    updateData.twilio_sid = smsResult.messageSid;
    updateData.twilio_status = smsResult.status;
    updateData.sent_at = new Date().toISOString();
    updateData.segment_count = smsResult.segmentCount || 1;
  } else {
    updateData.twilio_error_code = smsResult.errorCode;
    updateData.twilio_error_message = smsResult.error;
  }

  await supabase.from("campaign_sms").update(updateData).eq("id", smsRecord.id);

  console.log(`[SMS Trigger] SMS ${smsResult.success ? "sent" : "failed"} for call ${callId}`);

  return {
    processed: true,
    sent: smsResult.success,
    smsId: smsRecord.id,
    ruleId: matchedRule.id,
    ruleName: matchedRule.name,
    reason: smsResult.success
      ? `SMS sent via rule "${matchedRule.name}": ${evaluation.reason}`
      : `SMS failed: ${smsResult.error}`,
    error: smsResult.error,
  };
}

/**
 * Process an inbound campaign call for SMS
 * Uses the existing sms_rules/sms_logs tables
 */
export async function processInboundCallForSms(
  callId: string,
  campaignId: string
): Promise<ProcessSmsResult> {
  const supabase = await createServiceClient();

  console.log(`[SMS Trigger] Processing inbound call ${callId} for campaign ${campaignId}`);

  // Get call data from inbound_campaign_calls
  const { data: call, error: callError } = await supabase
    .from("inbound_campaign_calls")
    .select(`
      id,
      caller_phone,
      transcript,
      ai_summary,
      ai_caller_intent,
      ai_resolution
    `)
    .eq("id", callId)
    .single();

  if (callError || !call) {
    return {
      processed: false,
      sent: false,
      reason: "Call not found",
      error: callError?.message,
    };
  }

  if (!call.caller_phone) {
    return {
      processed: false,
      sent: false,
      reason: "No phone number on call record",
    };
  }

  // Get campaign to find client_id
  const { data: campaign, error: campaignError } = await supabase
    .from("inbound_campaigns")
    .select("client_id")
    .eq("id", campaignId)
    .single();

  if (campaignError || !campaign) {
    return {
      processed: false,
      sent: false,
      reason: "Campaign not found",
      error: campaignError?.message,
    };
  }

  // Get active SMS rules for this inbound campaign
  const { data: rules, error: rulesError } = await supabase
    .from("inbound_campaign_sms_rules")
    .select("id, name, trigger_condition, message_template, priority")
    .eq("campaign_id", campaignId)
    .eq("is_active", true)
    .order("priority", { ascending: false });

  if (rulesError) {
    return {
      processed: false,
      sent: false,
      reason: "Error fetching SMS rules",
      error: rulesError.message,
    };
  }

  if (!rules || rules.length === 0) {
    return {
      processed: true,
      sent: false,
      reason: "No active SMS rules for this campaign",
    };
  }

  // Map to interface
  const mappedRules: SmsRule[] = rules.map((r) => ({
    id: r.id,
    name: r.name,
    triggerCondition: r.trigger_condition,
    messageTemplate: r.message_template,
    priority: r.priority,
  }));

  // Build summary from available AI analysis
  const summary = [
    call.ai_summary,
    call.ai_caller_intent ? `Intent: ${call.ai_caller_intent}` : null,
    call.ai_resolution ? `Resolution: ${call.ai_resolution}` : null,
  ].filter(Boolean).join("\n");

  // Evaluate rules using AI
  const evaluation = await evaluateSmsRules(
    {
      id: call.id,
      campaignId,
      campaignType: "inbound",
      phoneNumber: call.caller_phone,
      firstName: null,
      transcript: call.transcript,
      summary: summary || null,
    },
    mappedRules
  );

  console.log(`[SMS Trigger] Evaluation result:`, evaluation);

  if (!evaluation.shouldTrigger || !evaluation.ruleId) {
    return {
      processed: true,
      sent: false,
      reason: evaluation.reason,
    };
  }

  // Find the matched rule
  const matchedRule = mappedRules.find((r) => r.id === evaluation.ruleId);
  if (!matchedRule) {
    return {
      processed: true,
      sent: false,
      reason: "Matched rule not found",
    };
  }

  // Process message template
  const messageBody = processMessageTemplate(matchedRule.messageTemplate, {
    id: call.id,
    campaignId,
    campaignType: "inbound",
    phoneNumber: call.caller_phone,
    firstName: null,
    transcript: call.transcript,
    summary: summary || null,
  });

  // Create SMS log entry (using sms_logs table for inbound)
  const { data: smsLog, error: logError } = await supabase
    .from("sms_logs")
    .insert({
      campaign_id: campaignId,
      call_id: callId,
      rule_id: matchedRule.id,
      client_id: campaign.client_id,
      recipient_phone: call.caller_phone,
      message_body: messageBody,
      status: "pending",
      ai_evaluation_reason: evaluation.reason,
      ai_confidence: evaluation.confidence,
    })
    .select("id")
    .single();

  if (logError || !smsLog) {
    console.error("[SMS Trigger] Error creating SMS log:", logError);
    return {
      processed: true,
      sent: false,
      ruleId: matchedRule.id,
      ruleName: matchedRule.name,
      reason: "Failed to create SMS log",
      error: logError?.message,
    };
  }

  // Send the SMS
  const smsResult = await sendSms({
    to: call.caller_phone,
    body: messageBody,
  });

  // Update SMS log with result
  const updateData: Record<string, unknown> = {
    status: smsResult.success ? "sent" : "failed",
    updated_at: new Date().toISOString(),
  };

  if (smsResult.success) {
    updateData.twilio_message_sid = smsResult.messageSid;
    updateData.twilio_status = smsResult.status;
    updateData.sent_at = new Date().toISOString();
    updateData.segment_count = smsResult.segmentCount || 1;
  } else {
    updateData.twilio_error_code = smsResult.errorCode;
    updateData.twilio_error_message = smsResult.error;
  }

  await supabase.from("sms_logs").update(updateData).eq("id", smsLog.id);

  // Update rule trigger stats
  const { data: currentRule } = await supabase
    .from("inbound_campaign_sms_rules")
    .select("trigger_count")
    .eq("id", matchedRule.id)
    .single();

  await supabase
    .from("inbound_campaign_sms_rules")
    .update({
      trigger_count: (currentRule?.trigger_count || 0) + 1,
      last_triggered_at: new Date().toISOString(),
    })
    .eq("id", matchedRule.id);

  console.log(`[SMS Trigger] SMS ${smsResult.success ? "sent" : "failed"} for inbound call ${callId}`);

  return {
    processed: true,
    sent: smsResult.success,
    smsId: smsLog.id,
    ruleId: matchedRule.id,
    ruleName: matchedRule.name,
    reason: smsResult.success
      ? `SMS sent via rule "${matchedRule.name}": ${evaluation.reason}`
      : `SMS failed: ${smsResult.error}`,
    error: smsResult.error,
  };
}

/**
 * Get SMS logs for a specific call
 */
export async function getSmsLogsForCall(
  callId: string,
  campaignType: "inbound" | "outbound"
): Promise<Array<{
  id: string;
  status: string;
  messageBody: string;
  ruleName?: string;
  ruleCondition?: string;
  aiReason?: string;
  aiConfidence?: number;
  twilioSid?: string;
  twilioStatus?: string;
  error?: string;
  sentAt?: string;
  createdAt: string;
}>> {
  const supabase = await createServiceClient();

  if (campaignType === "outbound") {
    const { data, error } = await supabase
      .from("campaign_sms")
      .select(`
        id,
        status,
        message_body,
        ai_evaluation_reason,
        ai_confidence,
        twilio_sid,
        twilio_status,
        twilio_error_message,
        sent_at,
        created_at,
        rule:outbound_campaign_sms_rules(name, trigger_condition)
      `)
      .eq("call_id", callId)
      .order("created_at", { ascending: false });

    if (error || !data) {
      console.error("[SMS Trigger] Error fetching outbound SMS logs:", error);
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.map((sms: any) => {
      const rule = sms.rule as { name?: string; trigger_condition?: string } | null;
      return {
        id: sms.id,
        status: sms.status,
        messageBody: sms.message_body,
        ruleName: rule?.name,
        ruleCondition: rule?.trigger_condition,
        aiReason: sms.ai_evaluation_reason || undefined,
        aiConfidence: sms.ai_confidence ? parseFloat(sms.ai_confidence) : undefined,
        twilioSid: sms.twilio_sid || undefined,
        twilioStatus: sms.twilio_status || undefined,
        error: sms.twilio_error_message || undefined,
        sentAt: sms.sent_at || undefined,
        createdAt: sms.created_at,
      };
    });
  } else {
    // Inbound uses sms_logs table
    const { data, error } = await supabase
      .from("sms_logs")
      .select(`
        id,
        status,
        message_body,
        ai_evaluation_reason,
        ai_confidence,
        twilio_message_sid,
        twilio_status,
        twilio_error_message,
        sent_at,
        created_at,
        rule:inbound_campaign_sms_rules(name, trigger_condition)
      `)
      .eq("call_id", callId)
      .order("created_at", { ascending: false });

    if (error || !data) {
      console.error("[SMS Trigger] Error fetching inbound SMS logs:", error);
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.map((sms: any) => {
      const rule = sms.rule as { name?: string; trigger_condition?: string } | null;
      return {
        id: sms.id,
        status: sms.status,
        messageBody: sms.message_body,
        ruleName: rule?.name,
        ruleCondition: rule?.trigger_condition,
        aiReason: sms.ai_evaluation_reason || undefined,
        aiConfidence: sms.ai_confidence ? parseFloat(sms.ai_confidence) : undefined,
        twilioSid: sms.twilio_message_sid || undefined,
        twilioStatus: sms.twilio_status || undefined,
        error: sms.twilio_error_message || undefined,
        sentAt: sms.sent_at || undefined,
        createdAt: sms.created_at,
      };
    });
  }
}

import { createClient } from "@/lib/supabase/server";
import { sendSms } from "./twilio";
import OpenAI from "openai";

interface CallData {
  id: string;
  campaignId: string;
  clientId: string;
  callerPhone: string | null;
  transcript: string;
  aiSummary: string | null;
  aiSentiment: string | null;
  aiCallerIntent: string | null;
  aiResolution: string | null;
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
  ruleId: string;
  ruleName: string;
  confidence: number;
  reason: string;
}

// Get AI client (OpenAI or DeepSeek)
async function getAIClient(): Promise<OpenAI | null> {
  // Try database first
  try {
    const supabase = await createClient();
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

// Evaluate SMS rules against call data using AI
async function evaluateSmsRules(
  call: CallData,
  rules: SmsRule[]
): Promise<EvaluationResult | null> {
  if (rules.length === 0) return null;

  const ai = await getAIClient();
  if (!ai) {
    console.error("No AI client configured for SMS rule evaluation");
    return null;
  }

  // Build context about the call
  const callContext = `
Call Summary: ${call.aiSummary || "Not available"}
Caller Intent: ${call.aiCallerIntent || "Not available"}
Sentiment: ${call.aiSentiment || "Not available"}
Resolution: ${call.aiResolution || "Not available"}

Transcript excerpt (last 2000 chars):
${call.transcript.slice(-2000)}
`.trim();

  // Build rules list
  const rulesText = rules
    .map((r, i) => `Rule ${i + 1} (ID: ${r.id}): "${r.triggerCondition}"`)
    .join("\n");

  const prompt = `You are an SMS trigger evaluator. Based on the call data below, determine if ANY of the following SMS rules should be triggered.

CALL DATA:
${callContext}

SMS RULES TO EVALUATE:
${rulesText}

Analyze each rule's trigger condition against the call data. A rule should trigger if the caller's behavior, intent, or conversation content matches the condition described.

Respond in JSON format:
{
  "shouldTrigger": boolean,
  "ruleId": "the ID of the rule that should trigger (if any)",
  "ruleName": "the name of the triggered rule",
  "confidence": number between 0 and 1,
  "reason": "brief explanation of why this rule was triggered or why no rule matched"
}

If no rules should trigger, set shouldTrigger to false and leave ruleId and ruleName empty.
Only trigger ONE rule (the highest priority match if multiple apply).`;

  try {
    const response = await ai.chat.completions.create({
      model: process.env.DEEPSEEK_API_KEY ? "deepseek-chat" : "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const result = JSON.parse(content) as EvaluationResult;

    // Validate that the ruleId exists
    if (result.shouldTrigger && result.ruleId) {
      const matchedRule = rules.find((r) => r.id === result.ruleId);
      if (!matchedRule) {
        // AI returned invalid rule ID, find by name
        const byName = rules.find((r) =>
          r.name.toLowerCase() === result.ruleName?.toLowerCase()
        );
        if (byName) {
          result.ruleId = byName.id;
        } else {
          return null;
        }
      }
    }

    return result;
  } catch (error) {
    console.error("Error evaluating SMS rules:", error);
    return null;
  }
}

// Main function: Process call and send SMS if rules match
export async function processCallForSms(callId: string): Promise<{
  sent: boolean;
  smsLogId?: string;
  error?: string;
}> {
  const supabase = await createClient();

  // Get call data with campaign
  const { data: call, error: callError } = await supabase
    .from("calls")
    .select(`
      id,
      campaign_id,
      caller_phone,
      transcript,
      ai_summary,
      ai_sentiment,
      ai_caller_intent,
      ai_resolution,
      campaigns!inner (
        id,
        client_id
      )
    `)
    .eq("id", callId)
    .single();

  if (callError || !call) {
    return { sent: false, error: "Call not found" };
  }

  if (!call.caller_phone) {
    return { sent: false, error: "No caller phone number" };
  }

  // Supabase returns campaigns as array even with !inner, take first element
  const campaigns = call.campaigns as unknown as { id: string; client_id: string }[] | { id: string; client_id: string };
  const campaign = Array.isArray(campaigns) ? campaigns[0] : campaigns;

  // Get active SMS rules for this campaign
  const { data: rules, error: rulesError } = await supabase
    .from("sms_rules")
    .select("id, name, trigger_condition, message_template, priority")
    .eq("campaign_id", call.campaign_id)
    .eq("is_active", true)
    .order("priority", { ascending: false });

  if (rulesError || !rules || rules.length === 0) {
    return { sent: false, error: "No active SMS rules" };
  }

  // Map to camelCase
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
      campaignId: call.campaign_id,
      clientId: campaign.client_id,
      callerPhone: call.caller_phone,
      transcript: call.transcript,
      aiSummary: call.ai_summary,
      aiSentiment: call.ai_sentiment,
      aiCallerIntent: call.ai_caller_intent,
      aiResolution: call.ai_resolution,
    },
    mappedRules
  );

  if (!evaluation?.shouldTrigger || !evaluation.ruleId) {
    return { sent: false, error: "No rules triggered" };
  }

  // Find the matched rule
  const matchedRule = mappedRules.find((r) => r.id === evaluation.ruleId);
  if (!matchedRule) {
    return { sent: false, error: "Matched rule not found" };
  }

  // Create SMS log entry (pending)
  const { data: smsLog, error: logError } = await supabase
    .from("sms_logs")
    .insert({
      campaign_id: call.campaign_id,
      call_id: call.id,
      rule_id: matchedRule.id,
      client_id: campaign.client_id,
      recipient_phone: call.caller_phone,
      message_body: matchedRule.messageTemplate,
      status: "pending",
    })
    .select("id")
    .single();

  if (logError || !smsLog) {
    return { sent: false, error: "Failed to create SMS log" };
  }

  // Send the SMS
  const smsResult = await sendSms({
    to: call.caller_phone,
    body: matchedRule.messageTemplate,
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
    updateData.twilio_error_message = smsResult.error;
    updateData.twilio_error_code = smsResult.errorCode;
  }

  await supabase.from("sms_logs").update(updateData).eq("id", smsLog.id);

  // Update rule trigger stats - fetch current count first
  const { data: currentRule } = await supabase
    .from("sms_rules")
    .select("trigger_count")
    .eq("id", matchedRule.id)
    .single();

  await supabase
    .from("sms_rules")
    .update({
      trigger_count: (currentRule?.trigger_count || 0) + 1,
      last_triggered_at: new Date().toISOString(),
    })
    .eq("id", matchedRule.id);

  // Track billing usage if SMS was sent
  if (smsResult.success) {
    await trackSmsUsage(
      campaign.client_id,
      smsLog.id,
      smsResult.segmentCount || 1
    );
  }

  return {
    sent: smsResult.success,
    smsLogId: smsLog.id,
    error: smsResult.error,
  };
}

// Track SMS usage for billing
async function trackSmsUsage(
  clientId: string,
  smsLogId: string,
  segmentCount: number
): Promise<void> {
  const supabase = await createClient();

  // Get SMS rate from billing_rates
  const { data: rate } = await supabase
    .from("billing_rates")
    .select("unit_price")
    .eq("rate_type", "sms_sent")
    .eq("is_active", true)
    .single();

  const unitPrice = rate?.unit_price ? parseFloat(rate.unit_price) : 0.01; // Default $0.01 per segment
  const totalAmount = unitPrice * segmentCount;

  // Get current billing period
  const now = new Date();
  const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Create usage record
  await supabase.from("usage_records").insert({
    client_id: clientId,
    rate_type: "sms_sent",
    quantity: segmentCount,
    unit_price: unitPrice,
    total_amount: totalAmount,
    reference_type: "sms",
    reference_id: smsLogId,
    description: `SMS sent (${segmentCount} segment${segmentCount > 1 ? "s" : ""})`,
    billing_period: billingPeriod,
  });

  // Update client billing account balance
  const { data: account } = await supabase
    .from("client_billing_accounts")
    .select("current_balance")
    .eq("client_id", clientId)
    .single();

  if (account) {
    const newBalance = parseFloat(account.current_balance || "0") + totalAmount;
    await supabase
      .from("client_billing_accounts")
      .update({ current_balance: newBalance.toFixed(2) })
      .eq("client_id", clientId);
  }
}

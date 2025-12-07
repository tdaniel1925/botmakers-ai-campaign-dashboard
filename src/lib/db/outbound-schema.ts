import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  decimal,
  time,
  date,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { clients } from "./schema";

// ============================================
// Outbound Campaigns Schema
// AI-Powered Outbound Calling Campaign Feature
// ============================================

// Campaign Status Type
export type OutboundCampaignStatus = "draft" | "active" | "paused" | "stopped" | "completed";

// Contact Status Type
export type ContactStatus = "pending" | "in_progress" | "completed" | "failed" | "do_not_call";

// Call Status Type
export type OutboundCallStatus = "initiated" | "ringing" | "in_progress" | "answered" | "no_answer" | "busy" | "failed" | "voicemail";

// Call Outcome Type
export type CallOutcome = "positive" | "negative" | null;

// ============================================
// Outbound Campaigns Table
// ============================================
export const outboundCampaigns = pgTable("outbound_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description"),

  // Status
  status: text("status").notNull().default("draft"), // draft, active, paused, stopped, completed

  // Vapi Integration
  vapiAssistantId: text("vapi_assistant_id"),

  // Phone Number (FK to campaign_phone_numbers)
  phoneNumberId: uuid("phone_number_id"),

  // Billing Configuration
  ratePerMinute: decimal("rate_per_minute", { precision: 10, scale: 4 }).notNull().default("0.05"),
  billingThreshold: decimal("billing_threshold", { precision: 10, scale: 2 }).notNull().default("50.00"),
  runningCost: decimal("running_cost", { precision: 10, scale: 2 }).default("0"),

  // Call Limits
  maxConcurrentCalls: integer("max_concurrent_calls").default(50),

  // Retry Settings
  retryEnabled: boolean("retry_enabled").default(true),
  retryAttempts: integer("retry_attempts").default(2),
  retryDelayMinutes: integer("retry_delay_minutes").default(60),

  // Test Mode
  isTestMode: boolean("is_test_mode").default(false),
  testCallLimit: integer("test_call_limit").default(10),
  testCallsMade: integer("test_calls_made").default(0),

  // Compliance Certification
  certificationAccepted: boolean("certification_accepted").default(false),
  certificationInitials: text("certification_initials"),
  certificationTimestamp: timestamp("certification_timestamp"),
  certificationIpAddress: text("certification_ip_address"),

  // AI Agent Configuration
  agentConfig: jsonb("agent_config").default({}),

  // Structured Data Schema
  structuredDataSchema: jsonb("structured_data_schema").default([]),

  // Stats
  totalContacts: integer("total_contacts").default(0),
  contactsCalled: integer("contacts_called").default(0),
  contactsCompleted: integer("contacts_completed").default(0),
  totalMinutes: decimal("total_minutes", { precision: 12, scale: 2 }).default("0"),
  totalCost: decimal("total_cost", { precision: 12, scale: 2 }).default("0"),
  positiveOutcomes: integer("positive_outcomes").default(0),
  negativeOutcomes: integer("negative_outcomes").default(0),

  // Unique webhook token for receiving call data
  webhookToken: text("webhook_token").unique().notNull(),

  // Timestamps
  launchedAt: timestamp("launched_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// Campaign Schedules Table
// ============================================
export const campaignSchedules = pgTable("campaign_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").references(() => outboundCampaigns.id, { onDelete: "cascade" }).notNull(),

  // Days of week (0=Sunday, 6=Saturday)
  daysOfWeek: integer("days_of_week").array().default([1, 2, 3, 4, 5]), // Mon-Fri

  // Daily calling window
  startTime: time("start_time").notNull().default("09:00:00"),
  endTime: time("end_time").notNull().default("17:00:00"),

  // Timezone
  timezone: text("timezone").notNull().default("America/New_York"),

  // Optional date restrictions
  specificDates: date("specific_dates").array(),
  excludedDates: date("excluded_dates").array(),

  // Is active
  isActive: boolean("is_active").default(true),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// Campaign Contacts Table
// ============================================
export const campaignContacts = pgTable("campaign_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").references(() => outboundCampaigns.id, { onDelete: "cascade" }).notNull(),

  // Contact Info
  phoneNumber: text("phone_number").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),

  // Timezone Detection
  areaCode: text("area_code"),
  timezone: text("timezone"),

  // Call Status
  status: text("status").notNull().default("pending"), // pending, in_progress, completed, failed, do_not_call
  callAttempts: integer("call_attempts").default(0),
  lastCallAt: timestamp("last_call_at"),
  nextCallAt: timestamp("next_call_at"),

  // Outcome
  outcome: text("outcome"), // positive, negative, no_answer, voicemail

  // Custom Data
  customData: jsonb("custom_data").default({}),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint on campaign + phone
  uniqueContact: unique().on(table.campaignId, table.phoneNumber),
}));

// ============================================
// Campaign Calls Table
// ============================================
export const campaignCalls = pgTable("campaign_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").references(() => outboundCampaigns.id, { onDelete: "cascade" }).notNull(),
  contactId: uuid("contact_id").references(() => campaignContacts.id, { onDelete: "cascade" }).notNull(),

  // Vapi Integration
  vapiCallId: text("vapi_call_id"),

  // Call Status
  status: text("status").notNull().default("initiated"),

  // Outcome
  outcome: text("outcome"), // positive, negative, null

  // Call Metrics
  durationSeconds: integer("duration_seconds").default(0),
  cost: decimal("cost", { precision: 10, scale: 4 }).default("0"),

  // Vapi Data
  transcript: text("transcript"),
  summary: text("summary"),
  structuredData: jsonb("structured_data"),
  recordingUrl: text("recording_url"),

  // Error Handling
  errorCode: text("error_code"),
  errorMessage: text("error_message"),

  // Retry Tracking
  attemptNumber: integer("attempt_number").default(1),

  // Timestamps
  initiatedAt: timestamp("initiated_at").defaultNow(),
  answeredAt: timestamp("answered_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// Campaign SMS Table
// ============================================
export const campaignSms = pgTable("campaign_sms", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").references(() => outboundCampaigns.id, { onDelete: "cascade" }).notNull(),
  callId: uuid("call_id").references(() => campaignCalls.id, { onDelete: "set null" }),
  contactId: uuid("contact_id").references(() => campaignContacts.id, { onDelete: "cascade" }).notNull(),
  templateId: uuid("template_id"),

  // Trigger Info
  triggerOutcome: text("trigger_outcome"),

  // Message Content
  messageBody: text("message_body").notNull(),

  // Twilio Tracking
  twilioSid: text("twilio_sid"),
  twilioStatus: text("twilio_status"),
  twilioErrorCode: text("twilio_error_code"),
  twilioErrorMessage: text("twilio_error_message"),

  // Status
  status: text("status").notNull().default("queued"),

  // Cost
  segmentCount: integer("segment_count").default(1),
  cost: decimal("cost", { precision: 10, scale: 4 }),

  // Timestamps
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// Campaign SMS Templates Table
// ============================================
export const campaignSmsTemplates = pgTable("campaign_sms_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").references(() => outboundCampaigns.id, { onDelete: "cascade" }).notNull(),

  // Template Config
  name: text("name").notNull(),
  triggerType: text("trigger_type").notNull(), // positive_call, negative_call, no_answer, link_requested, custom

  // Template Body
  templateBody: text("template_body").notNull(),

  // Optional link
  linkUrl: text("link_url"),

  // Status
  isActive: boolean("is_active").default(true),

  // Usage Stats
  sendCount: integer("send_count").default(0),
  lastSentAt: timestamp("last_sent_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// Campaign Phone Numbers Table
// ============================================
export const campaignPhoneNumbers = pgTable("campaign_phone_numbers", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").references(() => outboundCampaigns.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),

  // Phone Number
  phoneNumber: text("phone_number").notNull(),
  friendlyName: text("friendly_name"),

  // Provider
  provider: text("provider").notNull().default("twilio"), // twilio, vapi

  // Provider IDs
  twilioSid: text("twilio_sid"),
  vapiPhoneId: text("vapi_phone_id"),

  // Provisioning
  isProvisioned: boolean("is_provisioned").default(false),

  // Status
  isActive: boolean("is_active").default(true),

  // Capabilities
  capabilities: jsonb("capabilities").default({ voice: true, sms: true }),

  // Usage Stats
  callsMade: integer("calls_made").default(0),
  smsSent: integer("sms_sent").default(0),
  lastUsedAt: timestamp("last_used_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// Campaign Billing Table
// ============================================
export const campaignBilling = pgTable("campaign_billing", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").references(() => outboundCampaigns.id, { onDelete: "cascade" }).notNull(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),

  // Charge Details
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  minutesUsed: decimal("minutes_used", { precision: 12, scale: 2 }).notNull(),
  ratePerMinute: decimal("rate_per_minute", { precision: 10, scale: 4 }).notNull(),

  // Payment Provider
  paymentProvider: text("payment_provider").default("stripe"),
  stripeChargeId: text("stripe_charge_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paypalTransactionId: text("paypal_transaction_id"),

  // Status
  status: text("status").notNull().default("pending"), // pending, succeeded, failed, refunded

  // Error Handling
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),

  // Period
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),

  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// Client API Keys Table
// ============================================
export const clientApiKeys = pgTable("client_api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),

  // Provider
  provider: text("provider").notNull(), // twilio, vapi

  // Encrypted Credentials
  apiKey: text("api_key"),
  apiSecret: text("api_secret"),
  accountSid: text("account_sid"),

  // Status
  isActive: boolean("is_active").default(true),
  lastValidated: timestamp("last_validated"),
  validationStatus: text("validation_status").default("pending"),

  // Usage
  lastUsedAt: timestamp("last_used_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique per client + provider
  uniqueClientProvider: unique().on(table.clientId, table.provider),
}));

// ============================================
// Area Code Timezones Table
// ============================================
export const areaCodeTimezones = pgTable("area_code_timezones", {
  areaCode: text("area_code").primaryKey(),
  timezone: text("timezone").notNull(),
  state: text("state"),
  region: text("region"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// Relations
// ============================================

export const outboundCampaignsRelations = relations(outboundCampaigns, ({ one, many }) => ({
  client: one(clients, {
    fields: [outboundCampaigns.clientId],
    references: [clients.id],
  }),
  phoneNumber: one(campaignPhoneNumbers, {
    fields: [outboundCampaigns.phoneNumberId],
    references: [campaignPhoneNumbers.id],
  }),
  schedules: many(campaignSchedules),
  contacts: many(campaignContacts),
  calls: many(campaignCalls),
  smsMessages: many(campaignSms),
  smsTemplates: many(campaignSmsTemplates),
  billingRecords: many(campaignBilling),
}));

export const campaignSchedulesRelations = relations(campaignSchedules, ({ one }) => ({
  campaign: one(outboundCampaigns, {
    fields: [campaignSchedules.campaignId],
    references: [outboundCampaigns.id],
  }),
}));

export const campaignContactsRelations = relations(campaignContacts, ({ one, many }) => ({
  campaign: one(outboundCampaigns, {
    fields: [campaignContacts.campaignId],
    references: [outboundCampaigns.id],
  }),
  calls: many(campaignCalls),
  smsMessages: many(campaignSms),
}));

export const campaignCallsRelations = relations(campaignCalls, ({ one, many }) => ({
  campaign: one(outboundCampaigns, {
    fields: [campaignCalls.campaignId],
    references: [outboundCampaigns.id],
  }),
  contact: one(campaignContacts, {
    fields: [campaignCalls.contactId],
    references: [campaignContacts.id],
  }),
  smsMessages: many(campaignSms),
}));

export const campaignSmsRelations = relations(campaignSms, ({ one }) => ({
  campaign: one(outboundCampaigns, {
    fields: [campaignSms.campaignId],
    references: [outboundCampaigns.id],
  }),
  call: one(campaignCalls, {
    fields: [campaignSms.callId],
    references: [campaignCalls.id],
  }),
  contact: one(campaignContacts, {
    fields: [campaignSms.contactId],
    references: [campaignContacts.id],
  }),
  template: one(campaignSmsTemplates, {
    fields: [campaignSms.templateId],
    references: [campaignSmsTemplates.id],
  }),
}));

export const campaignSmsTemplatesRelations = relations(campaignSmsTemplates, ({ one, many }) => ({
  campaign: one(outboundCampaigns, {
    fields: [campaignSmsTemplates.campaignId],
    references: [outboundCampaigns.id],
  }),
  smsMessages: many(campaignSms),
}));

export const campaignPhoneNumbersRelations = relations(campaignPhoneNumbers, ({ one, many }) => ({
  campaign: one(outboundCampaigns, {
    fields: [campaignPhoneNumbers.campaignId],
    references: [outboundCampaigns.id],
  }),
  client: one(clients, {
    fields: [campaignPhoneNumbers.clientId],
    references: [clients.id],
  }),
  campaigns: many(outboundCampaigns),
}));

export const campaignBillingRelations = relations(campaignBilling, ({ one }) => ({
  campaign: one(outboundCampaigns, {
    fields: [campaignBilling.campaignId],
    references: [outboundCampaigns.id],
  }),
  client: one(clients, {
    fields: [campaignBilling.clientId],
    references: [clients.id],
  }),
}));

export const clientApiKeysRelations = relations(clientApiKeys, ({ one }) => ({
  client: one(clients, {
    fields: [clientApiKeys.clientId],
    references: [clients.id],
  }),
}));

// ============================================
// Inbound Campaigns Schema
// AI-Powered Inbound Calling Campaign Feature
// ============================================

// Inbound Campaign Status Type
export type InboundCampaignStatus = "draft" | "active" | "paused" | "stopped";

// ============================================
// Inbound Campaigns Table
// ============================================
export const inboundCampaigns = pgTable("inbound_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description"),

  // Unique webhook token for receiving data
  webhookToken: text("webhook_token").unique().notNull(),

  // Status
  status: text("status").notNull().default("draft"), // draft, active, paused, stopped

  // Vapi Integration
  vapiApiKey: text("vapi_api_key"), // Encrypted Vapi private API key
  vapiAssistantId: text("vapi_assistant_id"),
  vapiPhoneNumberId: text("vapi_phone_number_id"),

  // Phone Number (FK to campaign_phone_numbers - internal)
  phoneNumberId: uuid("phone_number_id"),

  // AI Agent Configuration (legacy - kept for future use)
  agentConfig: jsonb("agent_config").default({}),

  // Payload Mapping (for AI to parse incoming webhooks)
  payloadMapping: jsonb("payload_mapping"),

  // Call Settings
  maxCallDuration: integer("max_call_duration").default(300),
  silenceTimeout: integer("silence_timeout").default(30),

  // Stats
  totalCalls: integer("total_calls").default(0),
  callsCompleted: integer("calls_completed").default(0),
  positiveOutcomes: integer("positive_outcomes").default(0),
  negativeOutcomes: integer("negative_outcomes").default(0),
  totalMinutes: decimal("total_minutes", { precision: 12, scale: 2 }).default("0"),

  // Active
  isActive: boolean("is_active").default(true),

  // Timestamps
  launchedAt: timestamp("launched_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// Inbound Campaign Calls Table
// ============================================
export const inboundCampaignCalls = pgTable("inbound_campaign_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").references(() => inboundCampaigns.id, { onDelete: "cascade" }).notNull(),

  // Call identifiers
  vapiCallId: text("vapi_call_id"),
  externalCallId: text("external_call_id"),

  // Caller Info
  callerPhone: text("caller_phone"),

  // Call Status
  status: text("status").notNull().default("processing"), // processing, completed, failed

  // Call Metrics
  durationSeconds: integer("duration_seconds").default(0),

  // Call Data
  transcript: text("transcript"),
  audioUrl: text("audio_url"),
  rawPayload: jsonb("raw_payload"),
  callTimestamp: timestamp("call_timestamp"),

  // AI Analysis
  aiSummary: text("ai_summary"),
  aiSentiment: text("ai_sentiment"),
  aiKeyPoints: jsonb("ai_key_points"),
  aiCallerIntent: text("ai_caller_intent"),
  aiResolution: text("ai_resolution"),
  aiProcessedAt: timestamp("ai_processed_at"),

  // Outcome Tag
  outcomeTagId: uuid("outcome_tag_id"),

  // Error Handling
  errorMessage: text("error_message"),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// Inbound Campaign Outcome Tags Table
// ============================================
export const inboundCampaignOutcomeTags = pgTable("inbound_campaign_outcome_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").references(() => inboundCampaigns.id, { onDelete: "cascade" }).notNull(),
  tagName: text("tag_name").notNull(),
  tagColor: text("tag_color").default("#6B7280"),
  isPositive: boolean("is_positive").default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// Inbound Campaign SMS Rules Table
// ============================================
export const inboundCampaignSmsRules = pgTable("inbound_campaign_sms_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").references(() => inboundCampaigns.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  triggerCondition: text("trigger_condition").notNull(),
  messageTemplate: text("message_template").notNull(),
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(0),
  triggerCount: integer("trigger_count").default(0),
  lastTriggeredAt: timestamp("last_triggered_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================
// Inbound Campaign Webhook Logs Table
// ============================================
export const inboundCampaignWebhookLogs = pgTable("inbound_campaign_webhook_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").references(() => inboundCampaigns.id, { onDelete: "cascade" }),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  processingTimeMs: integer("processing_time_ms"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// Inbound Campaign Relations
// ============================================
export const inboundCampaignsRelations = relations(inboundCampaigns, ({ one, many }) => ({
  client: one(clients, {
    fields: [inboundCampaigns.clientId],
    references: [clients.id],
  }),
  phoneNumber: one(campaignPhoneNumbers, {
    fields: [inboundCampaigns.phoneNumberId],
    references: [campaignPhoneNumbers.id],
  }),
  calls: many(inboundCampaignCalls),
  outcomeTags: many(inboundCampaignOutcomeTags),
  smsRules: many(inboundCampaignSmsRules),
  webhookLogs: many(inboundCampaignWebhookLogs),
}));

export const inboundCampaignCallsRelations = relations(inboundCampaignCalls, ({ one }) => ({
  campaign: one(inboundCampaigns, {
    fields: [inboundCampaignCalls.campaignId],
    references: [inboundCampaigns.id],
  }),
  outcomeTag: one(inboundCampaignOutcomeTags, {
    fields: [inboundCampaignCalls.outcomeTagId],
    references: [inboundCampaignOutcomeTags.id],
  }),
}));

export const inboundCampaignOutcomeTagsRelations = relations(inboundCampaignOutcomeTags, ({ one, many }) => ({
  campaign: one(inboundCampaigns, {
    fields: [inboundCampaignOutcomeTags.campaignId],
    references: [inboundCampaigns.id],
  }),
  calls: many(inboundCampaignCalls),
}));

export const inboundCampaignSmsRulesRelations = relations(inboundCampaignSmsRules, ({ one }) => ({
  campaign: one(inboundCampaigns, {
    fields: [inboundCampaignSmsRules.campaignId],
    references: [inboundCampaigns.id],
  }),
}));

export const inboundCampaignWebhookLogsRelations = relations(inboundCampaignWebhookLogs, ({ one }) => ({
  campaign: one(inboundCampaigns, {
    fields: [inboundCampaignWebhookLogs.campaignId],
    references: [inboundCampaigns.id],
  }),
}));

// ============================================
// Types
// ============================================

export type OutboundCampaign = typeof outboundCampaigns.$inferSelect;
export type NewOutboundCampaign = typeof outboundCampaigns.$inferInsert;

export type CampaignSchedule = typeof campaignSchedules.$inferSelect;
export type NewCampaignSchedule = typeof campaignSchedules.$inferInsert;

export type CampaignContact = typeof campaignContacts.$inferSelect;
export type NewCampaignContact = typeof campaignContacts.$inferInsert;

export type CampaignCall = typeof campaignCalls.$inferSelect;
export type NewCampaignCall = typeof campaignCalls.$inferInsert;

export type CampaignSmsMessage = typeof campaignSms.$inferSelect;
export type NewCampaignSmsMessage = typeof campaignSms.$inferInsert;

export type CampaignSmsTemplate = typeof campaignSmsTemplates.$inferSelect;
export type NewCampaignSmsTemplate = typeof campaignSmsTemplates.$inferInsert;

export type CampaignPhoneNumber = typeof campaignPhoneNumbers.$inferSelect;
export type NewCampaignPhoneNumber = typeof campaignPhoneNumbers.$inferInsert;

export type CampaignBillingRecord = typeof campaignBilling.$inferSelect;
export type NewCampaignBillingRecord = typeof campaignBilling.$inferInsert;

export type ClientApiKey = typeof clientApiKeys.$inferSelect;
export type NewClientApiKey = typeof clientApiKeys.$inferInsert;

export type AreaCodeTimezone = typeof areaCodeTimezones.$inferSelect;

// Inbound Campaign Types
export type InboundCampaign = typeof inboundCampaigns.$inferSelect;
export type NewInboundCampaign = typeof inboundCampaigns.$inferInsert;

export type InboundCampaignCall = typeof inboundCampaignCalls.$inferSelect;
export type NewInboundCampaignCall = typeof inboundCampaignCalls.$inferInsert;

export type InboundCampaignOutcomeTag = typeof inboundCampaignOutcomeTags.$inferSelect;
export type NewInboundCampaignOutcomeTag = typeof inboundCampaignOutcomeTags.$inferInsert;

export type InboundCampaignSmsRule = typeof inboundCampaignSmsRules.$inferSelect;
export type NewInboundCampaignSmsRule = typeof inboundCampaignSmsRules.$inferInsert;

export type InboundCampaignWebhookLog = typeof inboundCampaignWebhookLogs.$inferSelect;
export type NewInboundCampaignWebhookLog = typeof inboundCampaignWebhookLogs.$inferInsert;

// ============================================
// Agent Config Type
// ============================================
export interface AgentConfig {
  // Voice & Personality
  voiceId?: string;
  voiceProvider?: "vapi" | "elevenlabs" | "playht";
  agentName?: string;
  personalityDescription?: string;
  language?: string;

  // Conversation Script
  systemPrompt?: string;
  firstMessage?: string;
  callObjective?: string;
  endCallConditions?: string[];

  // Advanced Settings
  interruptionThreshold?: number;
  silenceTimeout?: number;
  maxCallDuration?: number;
}

// ============================================
// Structured Data Schema Type
// ============================================
export interface StructuredDataField {
  name: string;
  type: "string" | "boolean" | "number" | "date";
  description: string;
  required?: boolean;
}

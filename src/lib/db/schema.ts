import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  decimal,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Platform Settings
export const platformSettings = pgTable("platform_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  logoUrl: text("logo_url"),
  logoAspectRatio: decimal("logo_aspect_ratio", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Admin Users
export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey(),
  email: text("email").unique().notNull(),
  name: text("name").notNull(),
  role: text("role").default("admin"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Clients
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  name: text("name").notNull(),
  companyName: text("company_name"),
  username: text("username").unique(),
  tempPassword: text("temp_password"),
  passwordChangedAt: timestamp("password_changed_at"),
  isActive: boolean("is_active").default(true),
  inviteStatus: text("invite_status").default("draft"), // draft, pending, sent, accepted
  invitedAt: timestamp("invited_at"),
  acceptedAt: timestamp("accepted_at"),
  // Email preferences
  reportFrequency: text("report_frequency").default("weekly"), // none, daily, weekly, monthly
  reportDayOfWeek: integer("report_day_of_week").default(1), // 0=Sunday, 1=Monday, etc.
  reportHour: integer("report_hour").default(9), // Hour of day (0-23)
  lastReportSentAt: timestamp("last_report_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Campaigns
export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  webhookToken: text("webhook_token").unique().notNull(),
  isActive: boolean("is_active").default(true),
  payloadMapping: jsonb("payload_mapping"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Campaign Outcome Tags
export const campaignOutcomeTags = pgTable("campaign_outcome_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
  tagName: text("tag_name").notNull(),
  tagColor: text("tag_color").default("#6B7280"),
  isPositive: boolean("is_positive").default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Calls
export const calls = pgTable("calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),

  // Raw data
  transcript: text("transcript").notNull(),
  audioUrl: text("audio_url"),
  callerPhone: text("caller_phone"),
  callDuration: integer("call_duration"),
  externalCallId: text("external_call_id"),
  rawPayload: jsonb("raw_payload"),

  // AI Analysis
  aiSummary: text("ai_summary"),
  aiOutcomeTagId: uuid("ai_outcome_tag_id").references(() => campaignOutcomeTags.id),
  aiSentiment: text("ai_sentiment"),
  aiKeyPoints: jsonb("ai_key_points"),
  aiCallerIntent: text("ai_caller_intent"),
  aiResolution: text("ai_resolution"),
  aiProcessedAt: timestamp("ai_processed_at"),

  // Status
  status: text("status").default("processing"),
  errorMessage: text("error_message"),

  // Timestamps
  callTimestamp: timestamp("call_timestamp"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Webhook Logs
export const webhookLogs = pgTable("webhook_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").references(() => campaigns.id, { onDelete: "cascade" }),
  payload: jsonb("payload").notNull(),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Email Templates
export const emailTemplates = pgTable("email_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(), // welcome, password_reset, campaign_report, re_invite
  subject: text("subject").notNull(),
  heading: text("heading").notNull(),
  bodyContent: text("body_content").notNull(),
  buttonText: text("button_text"),
  buttonUrl: text("button_url"),
  footerText: text("footer_text"),
  primaryColor: text("primary_color").default("#10B981"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Email Logs
export const emailLogs = pgTable("email_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "set null" }),
  templateSlug: text("template_slug").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  recipientName: text("recipient_name"),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("pending"), // pending, sent, delivered, failed, bounced
  resendMessageId: text("resend_message_id"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"), // Store any additional data like campaign IDs, report period, etc.
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// API Keys - Override .env if present
export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  service: text("service").unique().notNull(), // openai, vapi, resend, twilio, cal_com, google_calendar, outlook_calendar, stripe, square, paypal
  keyData: jsonb("key_data").notNull(), // Encrypted JSON containing the keys for each service
  isActive: boolean("is_active").default(true),
  lastValidated: timestamp("last_validated"),
  validationStatus: text("validation_status"), // valid, invalid, pending
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const clientsRelations = relations(clients, ({ many }) => ({
  campaigns: many(campaigns),
  emailLogs: many(emailLogs),
}));

export const emailLogsRelations = relations(emailLogs, ({ one }) => ({
  client: one(clients, {
    fields: [emailLogs.clientId],
    references: [clients.id],
  }),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  client: one(clients, {
    fields: [campaigns.clientId],
    references: [clients.id],
  }),
  outcomeTags: many(campaignOutcomeTags),
  calls: many(calls),
  webhookLogs: many(webhookLogs),
}));

export const campaignOutcomeTagsRelations = relations(
  campaignOutcomeTags,
  ({ one, many }) => ({
    campaign: one(campaigns, {
      fields: [campaignOutcomeTags.campaignId],
      references: [campaigns.id],
    }),
    calls: many(calls),
  })
);

export const callsRelations = relations(calls, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [calls.campaignId],
    references: [campaigns.id],
  }),
  outcomeTag: one(campaignOutcomeTags, {
    fields: [calls.aiOutcomeTagId],
    references: [campaignOutcomeTags.id],
  }),
}));

export const webhookLogsRelations = relations(webhookLogs, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [webhookLogs.campaignId],
    references: [campaigns.id],
  }),
}));

// Types
export type PlatformSettings = typeof platformSettings.$inferSelect;
export type AdminUser = typeof adminUsers.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type CampaignOutcomeTag = typeof campaignOutcomeTags.$inferSelect;
export type Call = typeof calls.$inferSelect;
export type WebhookLog = typeof webhookLogs.$inferSelect;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type EmailLog = typeof emailLogs.$inferSelect;

export type NewClient = typeof clients.$inferInsert;
export type NewCampaign = typeof campaigns.$inferInsert;
export type NewCampaignOutcomeTag = typeof campaignOutcomeTags.$inferInsert;
export type NewCall = typeof calls.$inferInsert;
export type NewWebhookLog = typeof webhookLogs.$inferInsert;
export type NewEmailTemplate = typeof emailTemplates.$inferInsert;
export type NewEmailLog = typeof emailLogs.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

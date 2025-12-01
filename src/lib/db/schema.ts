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
  isActive: boolean("is_active").default(true),
  invitedAt: timestamp("invited_at"),
  acceptedAt: timestamp("accepted_at"),
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

// Relations
export const clientsRelations = relations(clients, ({ many }) => ({
  campaigns: many(campaigns),
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

export type NewClient = typeof clients.$inferInsert;
export type NewCampaign = typeof campaigns.$inferInsert;
export type NewCampaignOutcomeTag = typeof campaignOutcomeTags.$inferInsert;
export type NewCall = typeof calls.$inferInsert;
export type NewWebhookLog = typeof webhookLogs.$inferInsert;

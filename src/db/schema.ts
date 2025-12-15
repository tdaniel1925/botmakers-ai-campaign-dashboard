import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
  serial,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'client_user']);
export const campaignTypeEnum = pgEnum('campaign_type', ['inbound', 'outbound']);
export const sourceTypeEnum = pgEnum('source_type', ['phone', 'sms', 'web_form', 'chatbot']);
export const callStatusEnum = pgEnum('call_status', ['completed', 'no_answer', 'failed', 'busy', 'canceled']);
export const smsStatusEnum = pgEnum('sms_status', ['pending', 'sent', 'delivered', 'failed']);
export const reportFrequencyEnum = pgEnum('report_frequency', ['daily', 'weekly', 'monthly']);
export const reportScopeEnum = pgEnum('report_scope', ['all_campaigns', 'per_campaign']);
export const emailTemplateTypeEnum = pgEnum('email_template_type', ['credentials', 'welcome', 'marketing', 'password_reset', 'scheduled_report']);

// Organizations (Clients)
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  contactEmail: text('contact_email'),
  phone: text('phone'),
  address: text('address'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  nameIdx: index('organizations_name_idx').on(table.name),
  activeIdx: index('organizations_active_idx').on(table.isActive),
}));

// Users
export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // References Supabase auth.users.id
  email: text('email').notNull(),
  fullName: text('full_name'),
  role: userRoleEnum('role').default('client_user').notNull(),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  isActive: boolean('is_active').default(true).notNull(),
  mustChangePassword: boolean('must_change_password').default(false).notNull(),
  reportFrequency: reportFrequencyEnum('report_frequency'),
  reportScope: reportScopeEnum('report_scope'),
  timezone: text('timezone').default('America/Chicago'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  emailIdx: uniqueIndex('users_email_idx').on(table.email),
  orgIdx: index('users_org_idx').on(table.organizationId),
  roleIdx: index('users_role_idx').on(table.role),
}));

// Campaigns
export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  webhookUuid: uuid('webhook_uuid').defaultRandom().notNull(),
  campaignType: campaignTypeEnum('campaign_type').default('inbound').notNull(),
  twilioPhoneNumber: text('twilio_phone_number'),
  twilioOverride: boolean('twilio_override').default(false).notNull(),
  twilioAccountSid: text('twilio_account_sid'), // Encrypted
  twilioAuthToken: text('twilio_auth_token'), // Encrypted
  aiExtractionHints: jsonb('ai_extraction_hints').default({}).$type<Record<string, string>>(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('campaigns_org_idx').on(table.organizationId),
  webhookIdx: uniqueIndex('campaigns_webhook_idx').on(table.webhookUuid),
  activeIdx: index('campaigns_active_idx').on(table.isActive),
}));

// Contacts (for SMS deduplication)
export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  phoneNumber: text('phone_number').notNull(),
  smsTriggersfred: jsonb('sms_triggers_fired').default([]).$type<string[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  campaignPhoneIdx: uniqueIndex('contacts_campaign_phone_idx').on(table.campaignId, table.phoneNumber),
}));

// Interactions
export const interactions = pgTable('interactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  interactionNumber: serial('interaction_number'),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  sourceType: sourceTypeEnum('source_type').notNull(),
  sourcePlatform: text('source_platform'), // 'vapi', 'autocalls', 'twilio', etc.
  phoneNumber: text('phone_number'),
  callStatus: callStatusEnum('call_status'),
  durationSeconds: integer('duration_seconds'),
  transcript: text('transcript'),
  transcriptFormatted: jsonb('transcript_formatted').$type<Array<{ role: string; content: string }>>(),
  recordingUrl: text('recording_url'),
  aiSummary: text('ai_summary'),
  aiExtractedData: jsonb('ai_extracted_data').$type<Record<string, unknown>>(),
  rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>(),
  payloadHash: text('payload_hash'),
  tags: jsonb('tags').default([]).$type<string[]>(),
  flagged: boolean('flagged').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  campaignIdx: index('interactions_campaign_idx').on(table.campaignId),
  contactIdx: index('interactions_contact_idx').on(table.contactId),
  createdAtIdx: index('interactions_created_at_idx').on(table.createdAt),
  sourceTypeIdx: index('interactions_source_type_idx').on(table.sourceType),
  payloadHashIdx: index('interactions_payload_hash_idx').on(table.payloadHash),
}));

// SMS Triggers
export const smsTriggers = pgTable('sms_triggers', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  intentDescription: text('intent_description').notNull(),
  smsMessage: text('sms_message').notNull(),
  priority: integer('priority').default(100).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  campaignIdx: index('sms_triggers_campaign_idx').on(table.campaignId),
  priorityIdx: index('sms_triggers_priority_idx').on(table.priority),
}));

// SMS Logs
export const smsLogs = pgTable('sms_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  interactionId: uuid('interaction_id').references(() => interactions.id, { onDelete: 'set null' }),
  triggerId: uuid('trigger_id').references(() => smsTriggers.id, { onDelete: 'set null' }),
  contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
  toNumber: text('to_number').notNull(),
  fromNumber: text('from_number').notNull(),
  message: text('message').notNull(),
  status: smsStatusEnum('status').default('pending').notNull(),
  twilioSid: text('twilio_sid'),
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  interactionIdx: index('sms_logs_interaction_idx').on(table.interactionId),
  triggerIdx: index('sms_logs_trigger_idx').on(table.triggerId),
  statusIdx: index('sms_logs_status_idx').on(table.status),
}));

// Email Templates
export const emailTemplates = pgTable('email_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  type: emailTemplateTypeEnum('type').notNull(),
  subject: text('subject').notNull(),
  htmlContent: text('html_content').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  typeIdx: index('email_templates_type_idx').on(table.type),
}));

// Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(), // 'create', 'update', 'delete', 'view', 'login', etc.
  entityType: text('entity_type').notNull(), // 'organization', 'campaign', 'user', etc.
  entityId: uuid('entity_id'),
  details: jsonb('details').$type<Record<string, unknown>>(),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdx: index('audit_logs_user_idx').on(table.userId),
  entityIdx: index('audit_logs_entity_idx').on(table.entityType, table.entityId),
  createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
}));

// Webhook Error Logs
export const webhookErrorLogs = pgTable('webhook_error_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
  rawBody: text('raw_body'),
  errorType: text('error_type').notNull(), // 'invalid_json', 'processing_error', etc.
  errorMessage: text('error_message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  campaignIdx: index('webhook_error_logs_campaign_idx').on(table.campaignId),
  createdAtIdx: index('webhook_error_logs_created_at_idx').on(table.createdAt),
}));

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  campaigns: many(campaigns),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  auditLogs: many(auditLogs),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [campaigns.organizationId],
    references: [organizations.id],
  }),
  contacts: many(contacts),
  interactions: many(interactions),
  smsTriggers: many(smsTriggers),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [contacts.campaignId],
    references: [campaigns.id],
  }),
  interactions: many(interactions),
  smsLogs: many(smsLogs),
}));

export const interactionsRelations = relations(interactions, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [interactions.campaignId],
    references: [campaigns.id],
  }),
  contact: one(contacts, {
    fields: [interactions.contactId],
    references: [contacts.id],
  }),
  smsLogs: many(smsLogs),
}));

export const smsTriggersRelations = relations(smsTriggers, ({ one, many }) => ({
  campaign: one(campaigns, {
    fields: [smsTriggers.campaignId],
    references: [campaigns.id],
  }),
  smsLogs: many(smsLogs),
}));

export const smsLogsRelations = relations(smsLogs, ({ one }) => ({
  interaction: one(interactions, {
    fields: [smsLogs.interactionId],
    references: [interactions.id],
  }),
  trigger: one(smsTriggers, {
    fields: [smsLogs.triggerId],
    references: [smsTriggers.id],
  }),
  contact: one(contacts, {
    fields: [smsLogs.contactId],
    references: [contacts.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

// Export types
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Interaction = typeof interactions.$inferSelect;
export type NewInteraction = typeof interactions.$inferInsert;
export type SmsTrigger = typeof smsTriggers.$inferSelect;
export type NewSmsTrigger = typeof smsTriggers.$inferInsert;
export type SmsLog = typeof smsLogs.$inferSelect;
export type NewSmsLog = typeof smsLogs.$inferInsert;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type NewEmailTemplate = typeof emailTemplates.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type WebhookErrorLog = typeof webhookErrorLogs.$inferSelect;
export type NewWebhookErrorLog = typeof webhookErrorLogs.$inferInsert;

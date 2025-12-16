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

// Sales Portal Enums
export const leadStatusEnum = pgEnum('lead_status', ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost']);
export const commissionStatusEnum = pgEnum('commission_status', ['pending', 'approved', 'paid', 'cancelled']);
export const resourceTypeEnum = pgEnum('resource_type', ['pdf', 'image', 'video', 'document', 'link', 'other']);

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

// ============================================
// SALES PORTAL TABLES
// ============================================

// Sales Users (separate from regular users)
export const salesUsers = pgTable('sales_users', {
  id: uuid('id').primaryKey(), // References Supabase auth.users.id
  email: text('email').notNull(),
  fullName: text('full_name').notNull(),
  phone: text('phone'),
  avatar: text('avatar'),
  bio: text('bio'),
  commissionRate: integer('commission_rate').default(18).notNull(), // Default 18%
  isActive: boolean('is_active').default(true).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  emailIdx: uniqueIndex('sales_users_email_idx').on(table.email),
  activeIdx: index('sales_users_active_idx').on(table.isActive),
}));

// Lead Stages (configurable pipeline)
export const leadStages = pgTable('lead_stages', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color').default('#6366f1').notNull(),
  order: integer('order').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  isFinal: boolean('is_final').default(false).notNull(), // Won/Lost stages
  isWon: boolean('is_won').default(false).notNull(), // True for "Won" stage
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orderIdx: index('lead_stages_order_idx').on(table.order),
  activeIdx: index('lead_stages_active_idx').on(table.isActive),
}));

// Leads
export const leads = pgTable('leads', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadNumber: serial('lead_number'),
  salesUserId: uuid('sales_user_id').notNull().references(() => salesUsers.id, { onDelete: 'cascade' }),
  stageId: uuid('stage_id').references(() => leadStages.id, { onDelete: 'set null' }),
  // Contact Information
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  company: text('company'),
  jobTitle: text('job_title'),
  // Business Details
  estimatedValue: integer('estimated_value'), // In cents
  source: text('source'), // How they found us: referral, website, cold call, etc.
  notes: text('notes'),
  // Status
  status: leadStatusEnum('status').default('new').notNull(),
  convertedAt: timestamp('converted_at', { withTimezone: true }),
  convertedToOrgId: uuid('converted_to_org_id').references(() => organizations.id, { onDelete: 'set null' }),
  lostReason: text('lost_reason'),
  // Timestamps
  lastContactedAt: timestamp('last_contacted_at', { withTimezone: true }),
  nextFollowUpAt: timestamp('next_follow_up_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  salesUserIdx: index('leads_sales_user_idx').on(table.salesUserId),
  stageIdx: index('leads_stage_idx').on(table.stageId),
  statusIdx: index('leads_status_idx').on(table.status),
  createdAtIdx: index('leads_created_at_idx').on(table.createdAt),
  emailIdx: index('leads_email_idx').on(table.email),
  phoneIdx: index('leads_phone_idx').on(table.phone),
}));

// Lead Activities (timeline/activity log)
export const leadActivities = pgTable('lead_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  userId: uuid('user_id'), // Can be sales user or admin
  userType: text('user_type').notNull(), // 'sales' or 'admin'
  activityType: text('activity_type').notNull(), // 'note', 'call', 'email', 'meeting', 'stage_change', 'status_change', 'enrollment'
  title: text('title').notNull(),
  description: text('description'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  leadIdx: index('lead_activities_lead_idx').on(table.leadId),
  typeIdx: index('lead_activities_type_idx').on(table.activityType),
  createdAtIdx: index('lead_activities_created_at_idx').on(table.createdAt),
}));

// Commissions
export const commissions = pgTable('commissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  salesUserId: uuid('sales_user_id').notNull().references(() => salesUsers.id, { onDelete: 'cascade' }),
  leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  // Commission Details
  saleAmount: integer('sale_amount').notNull(), // In cents
  commissionRate: integer('commission_rate').notNull(), // Percentage at time of sale
  commissionAmount: integer('commission_amount').notNull(), // In cents
  // Status
  status: commissionStatusEnum('status').default('pending').notNull(),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  paymentMethod: text('payment_method'),
  paymentReference: text('payment_reference'),
  // Notes
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  salesUserIdx: index('commissions_sales_user_idx').on(table.salesUserId),
  leadIdx: index('commissions_lead_idx').on(table.leadId),
  statusIdx: index('commissions_status_idx').on(table.status),
  createdAtIdx: index('commissions_created_at_idx').on(table.createdAt),
}));

// Resource Categories
export const resourceCategories = pgTable('resource_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  icon: text('icon').default('folder'),
  color: text('color').default('#6366f1'),
  order: integer('order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  orderIdx: index('resource_categories_order_idx').on(table.order),
  activeIdx: index('resource_categories_active_idx').on(table.isActive),
}));

// Resources (sales materials)
export const resources = pgTable('resources', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id').references(() => resourceCategories.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  description: text('description'),
  type: resourceTypeEnum('type').notNull(),
  url: text('url'), // For links, file URLs
  fileSize: integer('file_size'), // In bytes
  fileName: text('file_name'),
  thumbnailUrl: text('thumbnail_url'),
  content: text('content'), // For text/document content
  tags: jsonb('tags').default([]).$type<string[]>(),
  downloadCount: integer('download_count').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  categoryIdx: index('resources_category_idx').on(table.categoryId),
  typeIdx: index('resources_type_idx').on(table.type),
  activeIdx: index('resources_active_idx').on(table.isActive),
}));

// Nurture Campaign Enrollments (linking leads to existing campaigns)
export const nurtureEnrollments = pgTable('nurture_enrollments', {
  id: uuid('id').primaryKey().defaultRandom(),
  leadId: uuid('lead_id').notNull().references(() => leads.id, { onDelete: 'cascade' }),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  salesUserId: uuid('sales_user_id').notNull().references(() => salesUsers.id, { onDelete: 'cascade' }),
  isActive: boolean('is_active').default(true).notNull(),
  enrolledAt: timestamp('enrolled_at', { withTimezone: true }).defaultNow().notNull(),
  unenrolledAt: timestamp('unenrolled_at', { withTimezone: true }),
  notes: text('notes'),
}, (table) => ({
  leadIdx: index('nurture_enrollments_lead_idx').on(table.leadId),
  campaignIdx: index('nurture_enrollments_campaign_idx').on(table.campaignId),
  salesUserIdx: index('nurture_enrollments_sales_user_idx').on(table.salesUserId),
  leadCampaignIdx: uniqueIndex('nurture_enrollments_lead_campaign_idx').on(table.leadId, table.campaignId),
}));

// Products/Services (for sales people to reference)
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  shortDescription: text('short_description'),
  price: integer('price'), // In cents, null if variable pricing
  pricingType: text('pricing_type').default('fixed'), // 'fixed', 'variable', 'quote', 'subscription'
  commissionRate: integer('commission_rate').default(18).notNull(), // Commission rate for this product
  features: jsonb('features').default([]).$type<string[]>(),
  benefits: jsonb('benefits').default([]).$type<string[]>(),
  imageUrl: text('image_url'),
  category: text('category'),
  isActive: boolean('is_active').default(true).notNull(),
  order: integer('order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  activeIdx: index('products_active_idx').on(table.isActive),
  categoryIdx: index('products_category_idx').on(table.category),
  orderIdx: index('products_order_idx').on(table.order),
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

// Sales Portal Relations
export const salesUsersRelations = relations(salesUsers, ({ many }) => ({
  leads: many(leads),
  commissions: many(commissions),
  nurtureEnrollments: many(nurtureEnrollments),
}));

export const leadStagesRelations = relations(leadStages, ({ many }) => ({
  leads: many(leads),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  salesUser: one(salesUsers, {
    fields: [leads.salesUserId],
    references: [salesUsers.id],
  }),
  stage: one(leadStages, {
    fields: [leads.stageId],
    references: [leadStages.id],
  }),
  convertedOrganization: one(organizations, {
    fields: [leads.convertedToOrgId],
    references: [organizations.id],
  }),
  activities: many(leadActivities),
  commissions: many(commissions),
  nurtureEnrollments: many(nurtureEnrollments),
}));

export const leadActivitiesRelations = relations(leadActivities, ({ one }) => ({
  lead: one(leads, {
    fields: [leadActivities.leadId],
    references: [leads.id],
  }),
}));

export const commissionsRelations = relations(commissions, ({ one }) => ({
  salesUser: one(salesUsers, {
    fields: [commissions.salesUserId],
    references: [salesUsers.id],
  }),
  lead: one(leads, {
    fields: [commissions.leadId],
    references: [leads.id],
  }),
  organization: one(organizations, {
    fields: [commissions.organizationId],
    references: [organizations.id],
  }),
  approver: one(users, {
    fields: [commissions.approvedBy],
    references: [users.id],
  }),
}));

export const resourceCategoriesRelations = relations(resourceCategories, ({ many }) => ({
  resources: many(resources),
}));

export const resourcesRelations = relations(resources, ({ one }) => ({
  category: one(resourceCategories, {
    fields: [resources.categoryId],
    references: [resourceCategories.id],
  }),
  creator: one(users, {
    fields: [resources.createdBy],
    references: [users.id],
  }),
}));

export const nurtureEnrollmentsRelations = relations(nurtureEnrollments, ({ one }) => ({
  lead: one(leads, {
    fields: [nurtureEnrollments.leadId],
    references: [leads.id],
  }),
  campaign: one(campaigns, {
    fields: [nurtureEnrollments.campaignId],
    references: [campaigns.id],
  }),
  salesUser: one(salesUsers, {
    fields: [nurtureEnrollments.salesUserId],
    references: [salesUsers.id],
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

// Sales Portal Types
export type SalesUser = typeof salesUsers.$inferSelect;
export type NewSalesUser = typeof salesUsers.$inferInsert;
export type LeadStage = typeof leadStages.$inferSelect;
export type NewLeadStage = typeof leadStages.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadActivity = typeof leadActivities.$inferSelect;
export type NewLeadActivity = typeof leadActivities.$inferInsert;
export type Commission = typeof commissions.$inferSelect;
export type NewCommission = typeof commissions.$inferInsert;
export type ResourceCategory = typeof resourceCategories.$inferSelect;
export type NewResourceCategory = typeof resourceCategories.$inferInsert;
export type Resource = typeof resources.$inferSelect;
export type NewResource = typeof resources.$inferInsert;
export type NurtureEnrollment = typeof nurtureEnrollments.$inferSelect;
export type NewNurtureEnrollment = typeof nurtureEnrollments.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

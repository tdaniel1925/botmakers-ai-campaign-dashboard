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
  logoUrlDark: text("logo_url_dark"), // Logo for dark mode
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

// Billing Rates - Usage-based pricing configuration
export const billingRates = pgTable("billing_rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  rateType: text("rate_type").notNull().unique(), // call_minutes, api_calls, workflows, storage_gb
  displayName: text("display_name").notNull(),
  description: text("description"),
  unitPrice: decimal("unit_price", { precision: 10, scale: 4 }).notNull(), // Price per unit (e.g., $0.05/min)
  unitName: text("unit_name").notNull(), // minute, call, workflow, GB
  minimumCharge: decimal("minimum_charge", { precision: 10, scale: 2 }).default("0"), // Minimum charge per billing period
  freeAllowance: integer("free_allowance").default(0), // Free units before charging
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Client Payment Methods - Stored cards/accounts
export const clientPaymentMethods = pgTable("client_payment_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),
  // Payment provider
  paymentProvider: text("payment_provider").notNull().default("stripe"), // stripe, paypal, square
  // Provider customer IDs
  stripeCustomerId: text("stripe_customer_id"),
  stripePaymentMethodId: text("stripe_payment_method_id"),
  paypalPayerId: text("paypal_payer_id"),
  paypalVaultId: text("paypal_vault_id"),
  squareCustomerId: text("square_customer_id"),
  squareCardId: text("square_card_id"),
  // Card display info (non-sensitive)
  cardBrand: text("card_brand"), // visa, mastercard, amex, etc.
  cardLast4: text("card_last4"),
  cardExpMonth: integer("card_exp_month"),
  cardExpYear: integer("card_exp_year"),
  // Status
  isDefault: boolean("is_default").default(true),
  isValid: boolean("is_valid").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Usage Records - Track all billable usage
export const usageRecords = pgTable("usage_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),
  rateType: text("rate_type").notNull(), // call_minutes, api_calls, workflows
  quantity: decimal("quantity", { precision: 12, scale: 4 }).notNull(), // Amount of usage
  unitPrice: decimal("unit_price", { precision: 10, scale: 4 }).notNull(), // Price at time of usage
  totalAmount: decimal("total_amount", { precision: 10, scale: 4 }).notNull(), // quantity * unitPrice
  // Reference to what generated the usage
  referenceType: text("reference_type"), // call, api_request, workflow
  referenceId: uuid("reference_id"),
  description: text("description"),
  // Billing status
  billingPeriod: text("billing_period").notNull(), // YYYY-MM format
  invoiceId: uuid("invoice_id"), // Links to billing_history when invoiced
  createdAt: timestamp("created_at").defaultNow(),
});

// Client Billing Accounts - Track balance and billing status
export const clientBillingAccounts = pgTable("client_billing_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull().unique(),
  // Current billing period balance
  currentBalance: decimal("current_balance", { precision: 10, scale: 2 }).default("0"), // Pending charges
  // Account status
  status: text("status").notNull().default("active"), // active, suspended, past_due
  // Auto-charge threshold
  autoChargeThreshold: decimal("auto_charge_threshold", { precision: 10, scale: 2 }).default("50"), // Charge when balance reaches this
  autoChargeEnabled: boolean("auto_charge_enabled").default(true),
  // Last billing
  lastChargeAt: timestamp("last_charge_at"),
  lastChargeAmount: decimal("last_charge_amount", { precision: 10, scale: 2 }),
  // Failed payment tracking
  failedPaymentCount: integer("failed_payment_count").default(0),
  lastFailedAt: timestamp("last_failed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Billing History / Invoices
export const billingHistory = pgTable("billing_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),
  // Payment provider tracking
  paymentProvider: text("payment_provider").default("stripe"), // stripe, paypal, square
  // Provider-specific IDs
  stripeInvoiceId: text("stripe_invoice_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paypalTransactionId: text("paypal_transaction_id"),
  paypalCaptureId: text("paypal_capture_id"),
  squarePaymentId: text("square_payment_id"),
  squareOrderId: text("square_order_id"),
  // Common fields
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("usd"),
  status: text("status").notNull(), // paid, open, void, uncollectible, refunded
  description: text("description"),
  invoicePdfUrl: text("invoice_pdf_url"),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Audit Logs
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"), // Can be admin or client
  userType: text("user_type").notNull(), // admin, client
  userEmail: text("user_email"),
  action: text("action").notNull(), // created, updated, deleted, login, logout, etc.
  resourceType: text("resource_type").notNull(), // client, campaign, call, settings, etc.
  resourceId: uuid("resource_id"),
  details: jsonb("details"), // Additional context
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Notifications
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  userType: text("user_type").notNull(), // admin, client
  type: text("type").notNull(), // info, warning, error, success
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"), // Optional link to related resource
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const clientsRelations = relations(clients, ({ many, one }) => ({
  campaigns: many(campaigns),
  emailLogs: many(emailLogs),
  billingAccount: one(clientBillingAccounts),
  paymentMethods: many(clientPaymentMethods),
  usageRecords: many(usageRecords),
  billingHistory: many(billingHistory),
}));

export const clientBillingAccountsRelations = relations(clientBillingAccounts, ({ one }) => ({
  client: one(clients, {
    fields: [clientBillingAccounts.clientId],
    references: [clients.id],
  }),
}));

export const clientPaymentMethodsRelations = relations(clientPaymentMethods, ({ one }) => ({
  client: one(clients, {
    fields: [clientPaymentMethods.clientId],
    references: [clients.id],
  }),
}));

export const usageRecordsRelations = relations(usageRecords, ({ one }) => ({
  client: one(clients, {
    fields: [usageRecords.clientId],
    references: [clients.id],
  }),
}));

export const billingHistoryRelations = relations(billingHistory, ({ one }) => ({
  client: one(clients, {
    fields: [billingHistory.clientId],
    references: [clients.id],
  }),
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
export type BillingRate = typeof billingRates.$inferSelect;
export type NewBillingRate = typeof billingRates.$inferInsert;
export type ClientPaymentMethod = typeof clientPaymentMethods.$inferSelect;
export type NewClientPaymentMethod = typeof clientPaymentMethods.$inferInsert;
export type UsageRecord = typeof usageRecords.$inferSelect;
export type NewUsageRecord = typeof usageRecords.$inferInsert;
export type ClientBillingAccount = typeof clientBillingAccounts.$inferSelect;
export type NewClientBillingAccount = typeof clientBillingAccounts.$inferInsert;
export type BillingHistoryRecord = typeof billingHistory.$inferSelect;
export type NewBillingHistoryRecord = typeof billingHistory.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

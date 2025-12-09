// Database response types (snake_case as returned by Supabase)
export interface DbClient {
  id: string;
  email: string;
  name: string;
  company_name: string | null;
  is_active: boolean;
  invited_at: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbCampaign {
  id: string;
  client_id: string | null;
  name: string;
  description: string | null;
  webhook_token: string;
  is_active: boolean;
  payload_mapping: Record<string, string> | null;
  created_at: string;
  updated_at: string;
  clients?: {
    name: string;
    company_name?: string;
  };
}

export interface DbCampaignOutcomeTag {
  id: string;
  campaign_id: string | null;
  tag_name: string;
  tag_color: string;
  is_positive: boolean;
  sort_order: number;
  created_at: string;
}

export interface DbCall {
  id: string;
  campaign_id: string | null;
  transcript: string;
  audio_url: string | null;
  caller_phone: string | null;
  call_duration: number | null;
  external_call_id: string | null;
  raw_payload: unknown;
  ai_summary: string | null;
  ai_outcome_tag_id: string | null;
  ai_sentiment: string | null;
  ai_key_points: string[] | null;
  ai_caller_intent: string | null;
  ai_resolution: string | null;
  ai_processed_at: string | null;
  status: string;
  error_message: string | null;
  call_timestamp: string | null;
  created_at: string;
  updated_at: string;
  campaign_outcome_tags?: {
    tag_name: string;
    tag_color: string;
  };
  campaigns?: {
    name: string;
    clients?: {
      name: string;
    };
  };
}

export interface DbWebhookLog {
  id: string;
  campaign_id: string | null;
  payload: unknown;
  status: string;
  error_message: string | null;
  created_at: string;
  campaigns?: {
    name: string;
    clients?: {
      name: string;
    };
  };
}

export interface DbPlatformSettings {
  id: string;
  logo_url: string | null;
  logo_aspect_ratio: number | null;
  created_at: string;
  updated_at: string;
}

export type AdminRole = "super_admin" | "admin" | "viewer";

export interface DbAdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  is_active: boolean;
  last_login_at: string | null;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ClientUserRole = "owner" | "manager" | "member" | "viewer";

export interface DbClientUser {
  id: string;
  client_id: string;
  auth_user_id: string | null;
  email: string;
  name: string;
  role: ClientUserRole;
  is_active: boolean;
  temp_password: string | null;
  password_changed_at: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  invited_by: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  clients?: {
    id: string;
    name: string;
    company_name: string | null;
  };
}

// Outbound Campaign Types
export type OutboundCampaignStatus = "draft" | "active" | "paused" | "stopped" | "completed";
export type CampaignContactStatus = "pending" | "in_progress" | "completed" | "failed" | "skipped";
export type CampaignCallStatus = "initiated" | "ringing" | "answered" | "completed" | "failed" | "no_answer" | "busy" | "voicemail";

export interface DbOutboundCampaign {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  status: OutboundCampaignStatus;
  agent_config: {
    systemPrompt: string;
    firstMessage?: string;
    voiceId?: string;
    voiceProvider?: string;
    endCallConditions?: string[];
    maxDuration?: number;
  } | null;
  structured_data_schema: Record<string, unknown> | null;
  vapi_assistant_id: string | null;
  max_concurrent_calls: number;
  retry_enabled: boolean;
  retry_attempts: number;
  retry_delay_minutes: number;
  certification_accepted: boolean;
  certification_accepted_at: string | null;
  certification_accepted_by: string | null;
  is_test_mode: boolean;
  test_call_limit: number;
  total_contacts: number;
  contacts_completed: number;
  launched_at: string | null;
  created_at: string;
  updated_at: string;
  clients?: {
    id: string;
    name: string;
    email: string;
  };
  campaign_phone_numbers?: DbCampaignPhoneNumber[];
  campaign_schedules?: DbCampaignSchedule[];
}

export interface DbCampaignPhoneNumber {
  id: string;
  campaign_id: string;
  phone_number: string;
  provider: "twilio" | "vapi";
  vapi_phone_id: string | null;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
}

export interface DbCampaignSchedule {
  id: string;
  campaign_id: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
}

export interface DbCampaignContact {
  id: string;
  campaign_id: string;
  first_name: string | null;
  last_name: string | null;
  phone_number: string;
  email: string | null;
  timezone: string | null;
  custom_fields: Record<string, unknown> | null;
  status: CampaignContactStatus;
  outcome: string | null;
  call_attempts: number;
  last_called_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbCampaignCall {
  id: string;
  campaign_id: string;
  contact_id: string;
  phone_number: string;
  phone_number_id: string;
  vapi_call_id: string | null;
  status: CampaignCallStatus;
  duration_seconds: number | null;
  transcript: string | null;
  summary: string | null;
  structured_data: Record<string, unknown> | null;
  outcome: string | null;
  outcome_reason: string | null;
  recording_url: string | null;
  call_attempts: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  campaign_contacts?: DbCampaignContact;
}

export interface DbCampaignSmsTemplate {
  id: string;
  campaign_id: string;
  name: string;
  trigger_type: "positive_outcome" | "negative_outcome" | "no_answer" | "manual";
  message_template: string;
  delay_minutes: number;
  is_active: boolean;
  created_at: string;
}

export interface DbCampaignSmsLog {
  id: string;
  campaign_id: string;
  contact_id: string;
  template_id: string | null;
  phone_number: string;
  message: string;
  status: "pending" | "sent" | "delivered" | "failed";
  external_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

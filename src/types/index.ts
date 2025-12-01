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

export interface DbAdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

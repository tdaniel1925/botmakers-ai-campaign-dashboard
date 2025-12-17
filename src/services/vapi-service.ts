/**
 * VAPI Service - Handles integration with VAPI.ai for outbound calling
 *
 * IMPORTANT: VAPI API keys are NOT stored in the database.
 * Keys are provided per-session by the admin and passed to each function.
 */

const VAPI_BASE_URL = 'https://api.vapi.ai';

// Types for VAPI API responses
export interface VapiAssistant {
  id: string;
  name: string;
  model?: {
    provider: string;
    model: string;
  };
  voice?: {
    provider: string;
    voiceId: string;
  };
  firstMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VapiPhoneNumber {
  id: string;
  number: string;
  name?: string;
  provider: string;
  createdAt: string;
  updatedAt: string;
  assistantId?: string;
  squadId?: string;
}

export interface VapiCall {
  id: string;
  orgId: string;
  type: 'inboundPhoneCall' | 'outboundPhoneCall' | 'webCall';
  status: 'queued' | 'ringing' | 'in-progress' | 'forwarding' | 'ended';
  endedReason?: string;
  assistantId?: string;
  phoneNumberId?: string;
  customer?: {
    number?: string;
    name?: string;
  };
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  endedAt?: string;
  transcript?: string;
  recordingUrl?: string;
  summary?: string;
  analysis?: {
    summary?: string;
    structuredData?: Record<string, unknown>;
    successEvaluation?: string;
  };
  messages?: Array<{
    role: 'assistant' | 'user' | 'system' | 'function';
    message?: string;
    time: number;
    secondsFromStart: number;
  }>;
  artifact?: {
    messages?: Array<{
      role: string;
      message: string;
      time: number;
      secondsFromStart: number;
    }>;
    recordingUrl?: string;
    transcript?: string;
  };
  costBreakdown?: {
    llm?: number;
    stt?: number;
    tts?: number;
    vapi?: number;
    total?: number;
  };
}

export interface VapiError {
  message: string;
  error?: string;
  statusCode?: number;
}

// Helper to make authenticated requests to VAPI
async function vapiRequest<T>(
  apiKey: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${VAPI_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' })) as VapiError;
    throw new Error(error.message || `VAPI API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Test connection to VAPI by fetching assistants
 */
export async function testVapiConnection(apiKey: string): Promise<{
  success: boolean;
  message: string;
  assistantCount?: number;
}> {
  try {
    const assistants = await vapiRequest<VapiAssistant[]>(apiKey, '/assistant');
    return {
      success: true,
      message: `Connected successfully. Found ${assistants.length} assistant(s).`,
      assistantCount: assistants.length,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to connect to VAPI',
    };
  }
}

/**
 * Fetch all assistants from VAPI
 */
export async function getVapiAssistants(apiKey: string): Promise<VapiAssistant[]> {
  return vapiRequest<VapiAssistant[]>(apiKey, '/assistant');
}

/**
 * Fetch a single assistant by ID
 */
export async function getVapiAssistant(apiKey: string, assistantId: string): Promise<VapiAssistant> {
  return vapiRequest<VapiAssistant>(apiKey, `/assistant/${assistantId}`);
}

/**
 * Fetch all phone numbers from VAPI
 */
export async function getVapiPhoneNumbers(apiKey: string): Promise<VapiPhoneNumber[]> {
  return vapiRequest<VapiPhoneNumber[]>(apiKey, '/phone-number');
}

/**
 * Fetch a single phone number by ID
 */
export async function getVapiPhoneNumber(apiKey: string, phoneNumberId: string): Promise<VapiPhoneNumber> {
  return vapiRequest<VapiPhoneNumber>(apiKey, `/phone-number/${phoneNumberId}`);
}

/**
 * Initiate an outbound call via VAPI
 */
export async function createOutboundCall(
  apiKey: string,
  params: {
    assistantId: string;
    phoneNumberId: string;
    customerNumber: string;
    customerName?: string;
    assistantOverrides?: {
      firstMessage?: string;
      variableValues?: Record<string, string>;
    };
  }
): Promise<VapiCall> {
  const body: Record<string, unknown> = {
    assistantId: params.assistantId,
    phoneNumberId: params.phoneNumberId,
    customer: {
      number: params.customerNumber,
      name: params.customerName,
    },
  };

  if (params.assistantOverrides) {
    body.assistantOverrides = params.assistantOverrides;
  }

  return vapiRequest<VapiCall>(apiKey, '/call/phone', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Get call details by ID
 */
export async function getVapiCall(apiKey: string, callId: string): Promise<VapiCall> {
  return vapiRequest<VapiCall>(apiKey, `/call/${callId}`);
}

/**
 * List calls with optional filters
 */
export async function listVapiCalls(
  apiKey: string,
  params?: {
    assistantId?: string;
    phoneNumberId?: string;
    limit?: number;
    createdAtGt?: string;
    createdAtLt?: string;
  }
): Promise<VapiCall[]> {
  const searchParams = new URLSearchParams();
  if (params?.assistantId) searchParams.set('assistantId', params.assistantId);
  if (params?.phoneNumberId) searchParams.set('phoneNumberId', params.phoneNumberId);
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.createdAtGt) searchParams.set('createdAtGt', params.createdAtGt);
  if (params?.createdAtLt) searchParams.set('createdAtLt', params.createdAtLt);

  const query = searchParams.toString();
  return vapiRequest<VapiCall[]>(apiKey, `/call${query ? `?${query}` : ''}`);
}

/**
 * End an active call
 */
export async function endVapiCall(apiKey: string, callId: string): Promise<VapiCall> {
  return vapiRequest<VapiCall>(apiKey, `/call/${callId}`, {
    method: 'DELETE',
  });
}

/**
 * Format transcript from VAPI messages into readable format
 */
export function formatVapiTranscript(messages: VapiCall['messages']): string {
  if (!messages || messages.length === 0) return '';

  return messages
    .filter((msg) => msg.role === 'assistant' || msg.role === 'user')
    .map((msg) => {
      const role = msg.role === 'assistant' ? 'AI' : 'Customer';
      return `${role}: ${msg.message || ''}`;
    })
    .join('\n');
}

/**
 * Calculate call duration in seconds from VAPI call object
 */
export function calculateCallDuration(call: VapiCall): number | null {
  if (!call.startedAt || !call.endedAt) return null;

  const start = new Date(call.startedAt).getTime();
  const end = new Date(call.endedAt).getTime();

  return Math.round((end - start) / 1000);
}

/**
 * Map VAPI call status to our outbound call result enum
 */
export function mapVapiStatusToResult(call: VapiCall): 'answered' | 'no_answer' | 'busy' | 'failed' | 'voicemail' | 'canceled' {
  if (call.status !== 'ended') {
    return 'canceled';
  }

  const endedReason = call.endedReason?.toLowerCase() || '';

  // Check for successful call (customer answered and conversation happened)
  if (call.transcript && call.transcript.length > 0) {
    return 'answered';
  }

  // Check for common failure reasons
  if (endedReason.includes('busy')) return 'busy';
  if (endedReason.includes('no-answer') || endedReason.includes('no_answer')) return 'no_answer';
  if (endedReason.includes('voicemail')) return 'voicemail';
  if (endedReason.includes('failed') || endedReason.includes('error')) return 'failed';
  if (endedReason.includes('canceled') || endedReason.includes('cancelled')) return 'canceled';

  // Default to no_answer if call ended without transcript
  return 'no_answer';
}

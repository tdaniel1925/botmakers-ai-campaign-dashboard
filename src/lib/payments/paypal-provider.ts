import {
  PaymentProviderInterface,
  CreateCustomerParams,
  CustomerResult,
  CreateCheckoutParams,
  CheckoutResult,
  SubscriptionInfo,
  CancelSubscriptionParams,
  WebhookEventResult,
} from "./types";

// PayPal API base URLs
const PAYPAL_API_BASE = process.env.PAYPAL_MODE === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

interface PayPalTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error(`PayPal auth failed: ${response.statusText}`);
  }

  const data: PayPalTokenResponse = await response.json();

  // Cache token with 5-minute buffer before expiry
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  return data.access_token;
}

async function paypalRequest<T>(
  endpoint: string,
  method: string = "GET",
  body?: Record<string, unknown>
): Promise<T> {
  const token = await getAccessToken();

  const response = await fetch(`${PAYPAL_API_BASE}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`PayPal API error: ${response.status} - ${error}`);
  }

  return response.json();
}

export const paypalProvider: PaymentProviderInterface = {
  async createCustomer(_params: CreateCustomerParams): Promise<CustomerResult> {
    // PayPal doesn't require pre-creating customers
    // The payer is created during subscription checkout
    // We'll use the clientId as a reference
    return { customerId: _params.clientId };
  },

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult> {
    // Create a PayPal subscription
    const subscription = await paypalRequest<{
      id: string;
      status: string;
      links: Array<{ rel: string; href: string }>;
    }>("/v1/billing/subscriptions", "POST", {
      plan_id: params.priceId, // PayPal Plan ID
      application_context: {
        brand_name: "BotMakers",
        locale: "en-US",
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        return_url: params.successUrl,
        cancel_url: params.cancelUrl,
      },
      custom_id: params.clientId, // Store our client ID for webhook reference
    });

    // Find the approval URL
    const approveLink = subscription.links.find((link) => link.rel === "approve");

    if (!approveLink) {
      throw new Error("No PayPal approval URL found");
    }

    return {
      url: approveLink.href,
      sessionId: subscription.id,
    };
  },

  async getSubscription(subscriptionId: string): Promise<SubscriptionInfo | null> {
    try {
      const subscription = await paypalRequest<{
        id: string;
        status: string;
        billing_info?: {
          next_billing_time?: string;
          last_payment?: {
            time: string;
          };
        };
        plan_id: string;
      }>(`/v1/billing/subscriptions/${subscriptionId}`);

      // Map PayPal status to our status
      const statusMap: Record<string, SubscriptionInfo["status"]> = {
        APPROVAL_PENDING: "trialing",
        APPROVED: "active",
        ACTIVE: "active",
        SUSPENDED: "past_due",
        CANCELLED: "canceled",
        EXPIRED: "canceled",
      };

      const lastPayment = subscription.billing_info?.last_payment?.time;
      const nextBilling = subscription.billing_info?.next_billing_time;

      return {
        id: subscription.id,
        status: statusMap[subscription.status] || "active",
        currentPeriodStart: lastPayment ? new Date(lastPayment) : new Date(),
        currentPeriodEnd: nextBilling ? new Date(nextBilling) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: subscription.status === "CANCELLED",
        planId: subscription.plan_id,
      };
    } catch {
      return null;
    }
  },

  async cancelSubscription(params: CancelSubscriptionParams): Promise<void> {
    await paypalRequest(`/v1/billing/subscriptions/${params.subscriptionId}/cancel`, "POST", {
      reason: "Customer requested cancellation",
    });
  },

  async resumeSubscription(subscriptionId: string): Promise<void> {
    await paypalRequest(`/v1/billing/subscriptions/${subscriptionId}/activate`, "POST", {
      reason: "Customer requested reactivation",
    });
  },

  async constructWebhookEvent(payload: string | Buffer, signature: string): Promise<WebhookEventResult> {
    // PayPal webhook verification
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    if (!webhookId) {
      throw new Error("PAYPAL_WEBHOOK_ID not configured");
    }

    // Parse the payload
    const body = typeof payload === "string" ? payload : payload.toString();
    const event = JSON.parse(body);

    // Verify the webhook (simplified - in production use PayPal's verification API)
    // PayPal sends headers: paypal-transmission-id, paypal-transmission-time, paypal-cert-url, paypal-auth-algo, paypal-transmission-sig
    // For now we trust the signature header presence
    if (!signature) {
      throw new Error("Missing PayPal webhook signature");
    }

    return {
      type: event.event_type,
      data: event.resource,
    };
  },
};

// Export helper to check if PayPal is configured
export function isPayPalConfigured(): boolean {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

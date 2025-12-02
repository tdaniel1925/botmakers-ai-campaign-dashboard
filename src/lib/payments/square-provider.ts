import { SquareClient, SquareEnvironment } from "square";
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
import crypto from "crypto";

let squareClient: SquareClient | null = null;

function getSquareClient(): SquareClient {
  if (!squareClient) {
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error("SQUARE_ACCESS_TOKEN is not set");
    }

    squareClient = new SquareClient({
      token: accessToken,
      environment: process.env.SQUARE_ENVIRONMENT === "production"
        ? SquareEnvironment.Production
        : SquareEnvironment.Sandbox,
    });
  }
  return squareClient;
}

export const squareProvider: PaymentProviderInterface = {
  async createCustomer(params: CreateCustomerParams): Promise<CustomerResult> {
    const client = getSquareClient();

    const response = await client.customers.create({
      idempotencyKey: crypto.randomUUID(),
      emailAddress: params.email,
      givenName: params.name.split(" ")[0],
      familyName: params.name.split(" ").slice(1).join(" ") || undefined,
      referenceId: params.clientId,
    });

    if (!response.customer?.id) {
      throw new Error("Failed to create Square customer");
    }

    return { customerId: response.customer.id };
  },

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const client = getSquareClient();
    const locationId = process.env.SQUARE_LOCATION_ID;

    if (!locationId) {
      throw new Error("SQUARE_LOCATION_ID not configured");
    }

    // For Square subscriptions, we use the Subscriptions API
    // First, ensure customer exists
    let customerId = params.customerId;

    if (!customerId) {
      const customerResult = await squareProvider.createCustomer({
        email: params.customerEmail,
        name: params.customerName,
        clientId: params.clientId,
      });
      customerId = customerResult.customerId;
    }

    // Create subscription
    const response = await client.subscriptions.create({
      idempotencyKey: crypto.randomUUID(),
      locationId,
      customerId,
      planVariationId: params.priceId, // Square Plan Variation ID
      source: {
        name: "BotMakers Dashboard",
      },
    });

    if (!response.subscription) {
      throw new Error("Failed to create Square subscription");
    }

    // Square subscriptions may require payment method - generate checkout link
    // For now, return a deep link to Square's hosted page or dashboard
    const subscriptionId = response.subscription.id;

    // Square doesn't have a direct hosted checkout for subscriptions like Stripe
    // We'll redirect to success with the subscription ID for the webhook to handle
    const checkoutUrl = `${params.successUrl}?subscription_id=${subscriptionId}&provider=square`;

    return {
      url: checkoutUrl,
      sessionId: subscriptionId,
    };
  },

  async getSubscription(subscriptionId: string): Promise<SubscriptionInfo | null> {
    const client = getSquareClient();

    try {
      const response = await client.subscriptions.get({ subscriptionId });
      const subscription = response.subscription;

      if (!subscription) {
        return null;
      }

      // Map Square status to our status
      const statusMap: Record<string, SubscriptionInfo["status"]> = {
        PENDING: "trialing",
        ACTIVE: "active",
        CANCELED: "canceled",
        DEACTIVATED: "canceled",
        PAUSED: "past_due",
      };

      return {
        id: subscription.id!,
        status: statusMap[subscription.status || "ACTIVE"] || "active",
        currentPeriodStart: subscription.startDate ? new Date(subscription.startDate) : new Date(),
        currentPeriodEnd: subscription.chargedThroughDate
          ? new Date(subscription.chargedThroughDate)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: subscription.status === "CANCELED",
        planId: subscription.planVariationId,
      };
    } catch {
      return null;
    }
  },

  async cancelSubscription(params: CancelSubscriptionParams): Promise<void> {
    const client = getSquareClient();

    await client.subscriptions.cancel({ subscriptionId: params.subscriptionId });
  },

  async resumeSubscription(subscriptionId: string): Promise<void> {
    const client = getSquareClient();

    await client.subscriptions.resume({
      subscriptionId,
      resumeEffectiveDate: new Date().toISOString().split("T")[0],
    });
  },

  async constructWebhookEvent(payload: string | Buffer, signature: string): Promise<WebhookEventResult> {
    const webhookSignatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;

    if (!webhookSignatureKey) {
      throw new Error("SQUARE_WEBHOOK_SIGNATURE_KEY not configured");
    }

    // Verify Square webhook signature
    const body = typeof payload === "string" ? payload : payload.toString();
    const notificationUrl = process.env.SQUARE_WEBHOOK_URL || "";

    // Square uses HMAC-SHA256 for signature verification
    const hmac = crypto.createHmac("sha256", webhookSignatureKey);
    hmac.update(notificationUrl + body);
    const expectedSignature = hmac.digest("base64");

    if (signature !== expectedSignature) {
      throw new Error("Invalid Square webhook signature");
    }

    const event = JSON.parse(body);

    return {
      type: event.type,
      data: event.data?.object || event.data || {},
    };
  },
};

// Export helper to check if Square is configured
export function isSquareConfigured(): boolean {
  return !!(process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID);
}

import Stripe from "stripe";
import {
  PaymentProviderInterface,
  CreateCustomerParams,
  CustomerResult,
  CreateCheckoutParams,
  CheckoutResult,
  SubscriptionInfo,
  CancelSubscriptionParams,
  PortalSessionParams,
  PortalSessionResult,
  WebhookEventResult,
} from "./types";

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not set in environment variables");
    }
    stripeInstance = new Stripe(secretKey, {
      apiVersion: "2025-11-17.clover",
      typescript: true,
    });
  }
  return stripeInstance;
}

export const stripeProvider: PaymentProviderInterface = {
  async createCustomer(params: CreateCustomerParams): Promise<CustomerResult> {
    const stripe = getStripe();
    const customer = await stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: {
        clientId: params.clientId,
      },
    });
    return { customerId: customer.id };
  },

  async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const stripe = getStripe();

    // Create customer if not provided
    let customerId = params.customerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: params.customerEmail,
        name: params.customerName,
        metadata: { clientId: params.clientId },
      });
      customerId = customer.id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [
        {
          price: params.priceId,
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        clientId: params.clientId,
        planId: params.planId,
      },
    });

    return {
      url: session.url!,
      sessionId: session.id,
    };
  },

  async getSubscription(subscriptionId: string): Promise<SubscriptionInfo | null> {
    const stripe = getStripe();
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      const statusMap: Record<string, SubscriptionInfo["status"]> = {
        trialing: "trialing",
        active: "active",
        past_due: "past_due",
        canceled: "canceled",
        unpaid: "unpaid",
      };

      return {
        id: subscription.id,
        status: statusMap[subscription.status] || "active",
        currentPeriodStart: new Date(subscription.items.data[0]?.current_period_start ?? subscription.created * 1000),
        currentPeriodEnd: new Date(subscription.items.data[0]?.current_period_end ?? (subscription.created + 30 * 24 * 60 * 60) * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        planId: subscription.items.data[0]?.price?.id,
      };
    } catch {
      return null;
    }
  },

  async cancelSubscription(params: CancelSubscriptionParams): Promise<void> {
    const stripe = getStripe();
    if (params.cancelAtPeriodEnd !== false) {
      await stripe.subscriptions.update(params.subscriptionId, {
        cancel_at_period_end: true,
      });
    } else {
      await stripe.subscriptions.cancel(params.subscriptionId);
    }
  },

  async resumeSubscription(subscriptionId: string): Promise<void> {
    const stripe = getStripe();
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  },

  async createPortalSession(params: PortalSessionParams): Promise<PortalSessionResult> {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
    });
    return { url: session.url };
  },

  async constructWebhookEvent(payload: string | Buffer, signature: string): Promise<WebhookEventResult> {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    }
    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    return {
      type: event.type,
      data: event.data.object as unknown as Record<string, unknown>,
    };
  },
};

// Re-export utility functions for backward compatibility
export { getStripe };

export async function getInvoices(customerId: string, limit = 10) {
  const stripe = getStripe();
  return stripe.invoices.list({
    customer: customerId,
    limit,
  });
}

export async function getUpcomingInvoice(customerId: string) {
  const stripe = getStripe();
  return stripe.invoices.createPreview({
    customer: customerId,
  });
}

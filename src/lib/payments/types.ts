// Payment provider types and interfaces

export type PaymentProvider = "stripe" | "paypal" | "square";

export interface PaymentProviderConfig {
  provider: PaymentProvider;
  isEnabled: boolean;
  displayName: string;
  icon: string;
}

export interface CreateCheckoutParams {
  customerId?: string;
  customerEmail: string;
  customerName: string;
  clientId: string;
  planId: string;
  priceId: string; // Provider-specific price/plan ID
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  url: string;
  sessionId?: string;
}

export interface CreateCustomerParams {
  email: string;
  name: string;
  clientId: string;
}

export interface CustomerResult {
  customerId: string;
}

export interface SubscriptionInfo {
  id: string;
  status: "trialing" | "active" | "past_due" | "canceled" | "unpaid";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  planId?: string;
}

export interface CancelSubscriptionParams {
  subscriptionId: string;
  cancelAtPeriodEnd?: boolean;
}

export interface PortalSessionParams {
  customerId: string;
  returnUrl: string;
}

export interface PortalSessionResult {
  url: string;
}

export interface WebhookEventResult {
  type: string;
  data: Record<string, unknown>;
}

export interface PaymentProviderInterface {
  // Core methods
  createCustomer(params: CreateCustomerParams): Promise<CustomerResult>;
  createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutResult>;
  getSubscription(subscriptionId: string): Promise<SubscriptionInfo | null>;
  cancelSubscription(params: CancelSubscriptionParams): Promise<void>;
  resumeSubscription(subscriptionId: string): Promise<void>;

  // Portal/Management
  createPortalSession?(params: PortalSessionParams): Promise<PortalSessionResult>;

  // Webhook handling
  constructWebhookEvent(payload: string | Buffer, signature: string): Promise<WebhookEventResult>;
}

// Provider-specific plan IDs from subscription_plans
export interface PlanProviderIds {
  stripe?: string;
  paypal?: string;
  square?: string;
}

export function getPlanIdForProvider(
  plan: { stripePriceId?: string | null; paypalPlanId?: string | null; squarePlanId?: string | null },
  provider: PaymentProvider
): string | null {
  switch (provider) {
    case "stripe":
      return plan.stripePriceId || null;
    case "paypal":
      return plan.paypalPlanId || null;
    case "square":
      return plan.squarePlanId || null;
    default:
      return null;
  }
}

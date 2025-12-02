import { PaymentProvider, PaymentProviderInterface, PaymentProviderConfig } from "./types";
import { stripeProvider } from "./stripe-provider";
import { paypalProvider, isPayPalConfigured } from "./paypal-provider";
import { squareProvider, isSquareConfigured } from "./square-provider";

// Export all types
export * from "./types";

// Export individual providers
export { stripeProvider } from "./stripe-provider";
export { paypalProvider, isPayPalConfigured } from "./paypal-provider";
export { squareProvider, isSquareConfigured } from "./square-provider";

// Provider registry
const providers: Record<PaymentProvider, PaymentProviderInterface> = {
  stripe: stripeProvider,
  paypal: paypalProvider,
  square: squareProvider,
};

/**
 * Get a payment provider by name
 */
export function getPaymentProvider(provider: PaymentProvider): PaymentProviderInterface {
  const providerInstance = providers[provider];
  if (!providerInstance) {
    throw new Error(`Unknown payment provider: ${provider}`);
  }
  return providerInstance;
}

/**
 * Check if a provider is properly configured
 */
export function isProviderConfigured(provider: PaymentProvider): boolean {
  switch (provider) {
    case "stripe":
      return !!process.env.STRIPE_SECRET_KEY;
    case "paypal":
      return isPayPalConfigured();
    case "square":
      return isSquareConfigured();
    default:
      return false;
  }
}

/**
 * Get list of all configured/enabled payment providers
 */
export function getEnabledProviders(): PaymentProviderConfig[] {
  const allProviders: PaymentProviderConfig[] = [
    {
      provider: "stripe",
      isEnabled: isProviderConfigured("stripe"),
      displayName: "Credit/Debit Card",
      icon: "CreditCard",
    },
    {
      provider: "paypal",
      isEnabled: isProviderConfigured("paypal"),
      displayName: "PayPal",
      icon: "Wallet",
    },
    {
      provider: "square",
      isEnabled: isProviderConfigured("square"),
      displayName: "Square",
      icon: "Square",
    },
  ];

  return allProviders.filter((p) => p.isEnabled);
}

/**
 * Get all providers (for admin config display)
 */
export function getAllProviders(): PaymentProviderConfig[] {
  return [
    {
      provider: "stripe",
      isEnabled: isProviderConfigured("stripe"),
      displayName: "Stripe",
      icon: "CreditCard",
    },
    {
      provider: "paypal",
      isEnabled: isProviderConfigured("paypal"),
      displayName: "PayPal",
      icon: "Wallet",
    },
    {
      provider: "square",
      isEnabled: isProviderConfigured("square"),
      displayName: "Square",
      icon: "Square",
    },
  ];
}

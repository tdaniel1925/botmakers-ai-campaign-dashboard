import { createServiceClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import Stripe from "stripe";

// Track usage for a client
export interface TrackUsageParams {
  clientId: string;
  rateType: "call_minutes" | "api_calls" | "workflows";
  quantity: number;
  referenceType?: string;
  referenceId?: string;
  description?: string;
}

export async function trackUsage(params: TrackUsageParams): Promise<void> {
  const supabase = await createServiceClient();
  const billingPeriod = format(new Date(), "yyyy-MM");

  // Get the current rate for this type
  const { data: rate } = await supabase
    .from("billing_rates")
    .select("*")
    .eq("rate_type", params.rateType)
    .eq("is_active", true)
    .single();

  if (!rate) {
    console.warn(`No active rate found for type: ${params.rateType}`);
    return;
  }

  // Calculate total amount (considering free allowance)
  const { data: existingUsage } = await supabase
    .from("usage_records")
    .select("quantity")
    .eq("client_id", params.clientId)
    .eq("rate_type", params.rateType)
    .eq("billing_period", billingPeriod);

  const totalUsedSoFar = (existingUsage || []).reduce(
    (sum, r) => sum + parseFloat(r.quantity),
    0
  );

  const freeAllowance = rate.free_allowance || 0;
  let billableQuantity = params.quantity;

  // Calculate how much of this usage is billable
  if (totalUsedSoFar < freeAllowance) {
    const remainingFree = freeAllowance - totalUsedSoFar;
    billableQuantity = Math.max(0, params.quantity - remainingFree);
  }

  const unitPrice = parseFloat(rate.unit_price);
  const totalAmount = billableQuantity * unitPrice;

  // Record the usage
  await supabase.from("usage_records").insert({
    client_id: params.clientId,
    rate_type: params.rateType,
    quantity: params.quantity.toString(),
    unit_price: unitPrice.toString(),
    total_amount: totalAmount.toString(),
    reference_type: params.referenceType,
    reference_id: params.referenceId,
    description: params.description,
    billing_period: billingPeriod,
  });

  // Update client billing account balance
  if (totalAmount > 0) {
    await supabase.rpc("increment_billing_balance", {
      p_client_id: params.clientId,
      p_amount: totalAmount,
    }).catch(async () => {
      // Fallback: update directly
      const { data: account } = await supabase
        .from("client_billing_accounts")
        .select("current_balance")
        .eq("client_id", params.clientId)
        .single();

      const newBalance = parseFloat(account?.current_balance || "0") + totalAmount;

      await supabase
        .from("client_billing_accounts")
        .upsert({
          client_id: params.clientId,
          current_balance: newBalance.toString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "client_id",
        });
    });

    // Check if we should auto-charge
    await checkAndAutoCharge(params.clientId);
  }
}

// Check if balance exceeds threshold and charge
async function checkAndAutoCharge(clientId: string): Promise<void> {
  const supabase = await createServiceClient();

  // Get billing account
  const { data: account } = await supabase
    .from("client_billing_accounts")
    .select("*")
    .eq("client_id", clientId)
    .single();

  if (!account || !account.auto_charge_enabled) return;

  const currentBalance = parseFloat(account.current_balance || "0");
  const threshold = parseFloat(account.auto_charge_threshold || "50");

  if (currentBalance >= threshold) {
    await chargeClient(clientId, currentBalance);
  }
}

// Charge a client for their current balance
export async function chargeClient(clientId: string, amount: number): Promise<boolean> {
  const supabase = await createServiceClient();

  // Get default payment method
  const { data: paymentMethod } = await supabase
    .from("client_payment_methods")
    .select("*")
    .eq("client_id", clientId)
    .eq("is_default", true)
    .eq("is_valid", true)
    .single();

  if (!paymentMethod) {
    console.warn(`No valid payment method for client: ${clientId}`);
    // Update account status
    await supabase
      .from("client_billing_accounts")
      .update({
        status: "past_due",
        updated_at: new Date().toISOString(),
      })
      .eq("client_id", clientId);
    return false;
  }

  try {
    if (paymentMethod.payment_provider === "stripe") {
      return await chargeWithStripe(clientId, amount, paymentMethod);
    } else if (paymentMethod.payment_provider === "paypal") {
      return await chargeWithPayPal(clientId, amount, paymentMethod);
    } else if (paymentMethod.payment_provider === "square") {
      return await chargeWithSquare(clientId, amount, paymentMethod);
    }
  } catch (error) {
    console.error("Failed to charge client:", error);

    // Update failure count
    await supabase
      .from("client_billing_accounts")
      .update({
        failed_payment_count: (parseInt(String(paymentMethod.failed_payment_count || 0)) + 1),
        last_failed_at: new Date().toISOString(),
        status: "past_due",
        updated_at: new Date().toISOString(),
      })
      .eq("client_id", clientId);

    return false;
  }

  return false;
}

// Charge with Stripe
async function chargeWithStripe(
  clientId: string,
  amount: number,
  paymentMethod: Record<string, unknown>
): Promise<boolean> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe not configured");

  const stripe = new Stripe(secretKey, { apiVersion: "2024-06-20" });

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency: "usd",
    customer: paymentMethod.stripe_customer_id as string,
    payment_method: paymentMethod.stripe_payment_method_id as string,
    off_session: true,
    confirm: true,
    metadata: {
      client_id: clientId,
    },
    description: `Usage charges - ${format(new Date(), "MMMM yyyy")}`,
  });

  return paymentIntent.status === "succeeded";
}

// Charge with PayPal
async function chargeWithPayPal(
  clientId: string,
  amount: number,
  paymentMethod: Record<string, unknown>
): Promise<boolean> {
  // PayPal billing agreement charge
  const accessToken = await getPayPalAccessToken();
  const billingAgreementId = paymentMethod.paypal_vault_id as string;

  if (!billingAgreementId) throw new Error("No PayPal billing agreement");

  const response = await fetch(
    `${getPayPalBaseUrl()}/v1/payments/billing-agreements/${billingAgreementId}/agreement-transactions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        note: `Usage charges - ${format(new Date(), "MMMM yyyy")}`,
        transaction_list: [{
          amount: {
            total: amount.toFixed(2),
            currency: "USD",
          },
          description: "Usage charges",
        }],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`PayPal charge failed: ${JSON.stringify(error)}`);
  }

  // Record payment
  const supabase = await createServiceClient();
  await supabase.from("billing_history").insert({
    client_id: clientId,
    payment_provider: "paypal",
    amount: amount.toFixed(2),
    currency: "usd",
    status: "paid",
    description: `Usage charges - ${format(new Date(), "MMMM yyyy")}`,
    paid_at: new Date().toISOString(),
  });

  // Reset balance
  await supabase
    .from("client_billing_accounts")
    .update({
      current_balance: "0",
      last_charge_at: new Date().toISOString(),
      last_charge_amount: amount.toFixed(2),
      failed_payment_count: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("client_id", clientId);

  return true;
}

// Charge with Square
async function chargeWithSquare(
  clientId: string,
  amount: number,
  paymentMethod: Record<string, unknown>
): Promise<boolean> {
  const { SquareClient, SquareEnvironment } = await import("square");
  const crypto = await import("crypto");

  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;

  if (!accessToken || !locationId) throw new Error("Square not configured");

  const square = new SquareClient({
    token: accessToken,
    environment: process.env.SQUARE_ENVIRONMENT === "production"
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox,
  });

  const response = await square.payments.create({
    idempotencyKey: crypto.randomUUID(),
    sourceId: paymentMethod.square_card_id as string,
    amountMoney: {
      amount: BigInt(Math.round(amount * 100)),
      currency: "USD",
    },
    customerId: paymentMethod.square_customer_id as string,
    locationId,
    note: `Usage charges - ${format(new Date(), "MMMM yyyy")}`,
  });

  if (response.payment?.status === "COMPLETED") {
    // Record payment
    const supabase = await createServiceClient();
    await supabase.from("billing_history").insert({
      client_id: clientId,
      payment_provider: "square",
      square_payment_id: response.payment.id,
      amount: amount.toFixed(2),
      currency: "usd",
      status: "paid",
      description: `Usage charges - ${format(new Date(), "MMMM yyyy")}`,
      paid_at: new Date().toISOString(),
    });

    // Reset balance
    await supabase
      .from("client_billing_accounts")
      .update({
        current_balance: "0",
        last_charge_at: new Date().toISOString(),
        last_charge_amount: amount.toFixed(2),
        failed_payment_count: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("client_id", clientId);

    return true;
  }

  throw new Error(`Square payment failed: ${response.payment?.status}`);
}

// PayPal helpers
let cachedPayPalToken: { token: string; expires: number } | null = null;

async function getPayPalAccessToken(): Promise<string> {
  if (cachedPayPalToken && Date.now() < cachedPayPalToken.expires) {
    return cachedPayPalToken.token;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials not configured");
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error("Failed to get PayPal access token");
  }

  const data = await response.json();
  cachedPayPalToken = {
    token: data.access_token,
    expires: Date.now() + (data.expires_in - 60) * 1000,
  };

  return data.access_token;
}

function getPayPalBaseUrl(): string {
  return process.env.PAYPAL_ENVIRONMENT === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

// Track call usage from webhook processing
export async function trackCallUsage(
  clientId: string,
  callId: string,
  durationMinutes: number
): Promise<void> {
  await trackUsage({
    clientId,
    rateType: "call_minutes",
    quantity: durationMinutes,
    referenceType: "call",
    referenceId: callId,
    description: `Call duration: ${durationMinutes.toFixed(2)} minutes`,
  });
}

// Track API usage
export async function trackApiUsage(
  clientId: string,
  count: number = 1,
  description?: string
): Promise<void> {
  await trackUsage({
    clientId,
    rateType: "api_calls",
    quantity: count,
    referenceType: "api_request",
    description: description || "API request",
  });
}

// Track workflow usage
export async function trackWorkflowUsage(
  clientId: string,
  workflowId?: string,
  description?: string
): Promise<void> {
  await trackUsage({
    clientId,
    rateType: "workflows",
    quantity: 1,
    referenceType: "workflow",
    referenceId: workflowId,
    description: description || "Workflow execution",
  });
}

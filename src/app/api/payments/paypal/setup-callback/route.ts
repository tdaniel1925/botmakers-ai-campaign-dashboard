import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// PayPal billing agreement callback after user approves
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const clientId = searchParams.get("client_id");

    if (!token || !clientId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?setup=error&message=missing_params`
      );
    }

    // Execute the billing agreement
    const accessToken = await getPayPalAccessToken();

    const response = await fetch(
      `${getPayPalBaseUrl()}/v1/billing-agreements/agreements`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token_id: token,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("PayPal agreement execution error:", error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?setup=error&message=agreement_failed`
      );
    }

    const agreement = await response.json();

    // Save the billing agreement to database
    const supabase = await createServiceClient();

    // Check for existing PayPal payment method
    const { data: existing } = await supabase
      .from("client_payment_methods")
      .select("id")
      .eq("client_id", clientId)
      .eq("payment_provider", "paypal")
      .single();

    const paymentMethodData = {
      client_id: clientId,
      payment_provider: "paypal",
      paypal_payer_id: agreement.payer?.payer_info?.payer_id,
      paypal_vault_id: agreement.id,
      card_brand: "paypal",
      card_last4: agreement.payer?.payer_info?.email?.slice(-4) || null,
      is_default: !existing, // Make default if first PayPal method
      is_valid: true,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      await supabase
        .from("client_payment_methods")
        .update(paymentMethodData)
        .eq("id", existing.id);
    } else {
      await supabase
        .from("client_payment_methods")
        .insert(paymentMethodData);
    }

    // Ensure billing account exists
    const { data: billingAccount } = await supabase
      .from("client_billing_accounts")
      .select("id")
      .eq("client_id", clientId)
      .single();

    if (!billingAccount) {
      await supabase
        .from("client_billing_accounts")
        .insert({
          client_id: clientId,
          status: "active",
        });
    }

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?setup=success&provider=paypal`
    );
  } catch (error) {
    console.error("PayPal setup callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?setup=error&message=unknown`
    );
  }
}

// PayPal helpers
let cachedToken: { token: string; expires: number } | null = null;

async function getPayPalAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires) {
    return cachedToken.token;
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
  cachedToken = {
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

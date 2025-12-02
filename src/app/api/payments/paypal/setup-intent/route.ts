import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPayPalConfigured } from "@/lib/payments/paypal-provider";

// PayPal vault setup for saving payment methods
export async function POST() {
  try {
    if (!isPayPalConfigured()) {
      return NextResponse.json(
        { error: "PayPal is not configured" },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get client
    const { data: client } = await supabase
      .from("clients")
      .select("id, name, email")
      .eq("email", user.email)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // PayPal vault requires creating a setup token and redirecting
    // For now, we'll use PayPal's hosted checkout to save payment method
    const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Create a billing agreement for vault
    const accessToken = await getPayPalAccessToken();

    const response = await fetch(
      `${getPayPalBaseUrl()}/v1/billing-agreements/agreement-tokens`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: "Payment method for usage billing",
          payer: {
            payment_method: "PAYPAL",
          },
          plan: {
            type: "MERCHANT_INITIATED_BILLING",
            merchant_preferences: {
              return_url: `${origin}/api/payments/paypal/setup-callback?client_id=${client.id}`,
              cancel_url: `${origin}/dashboard/billing?setup=canceled`,
              notify_url: `${origin}/api/payments/paypal/webhook`,
              accepted_pymt_type: "INSTANT",
            },
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("PayPal agreement token error:", error);
      throw new Error("Failed to create PayPal agreement token");
    }

    const data = await response.json();
    const approvalUrl = data.links?.find((l: { rel: string }) => l.rel === "approval_url")?.href;

    if (!approvalUrl) {
      throw new Error("No approval URL in PayPal response");
    }

    return NextResponse.json({ url: approvalUrl });
  } catch (error) {
    console.error("Error creating PayPal setup:", error);
    return NextResponse.json(
      { error: "Failed to create PayPal setup session" },
      { status: 500 }
    );
  }
}

// PayPal access token helper
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

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPayPalConfigured } from "@/lib/payments/paypal-provider";

export async function POST(request: NextRequest) {
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
      .select("id")
      .eq("email", user.email)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get subscription with PayPal subscription ID
    const { data: subscription } = await supabase
      .from("client_subscriptions")
      .select("paypal_subscription_id")
      .eq("client_id", client.id)
      .single();

    if (!subscription?.paypal_subscription_id) {
      return NextResponse.json(
        { error: "No PayPal subscription found" },
        { status: 404 }
      );
    }

    // PayPal doesn't have a billing portal like Stripe
    // Redirect to PayPal's subscription management page
    const isLive = process.env.PAYPAL_MODE === "live";
    const paypalUrl = isLive
      ? `https://www.paypal.com/myaccount/autopay/connect/${subscription.paypal_subscription_id}/manage`
      : `https://www.sandbox.paypal.com/myaccount/autopay/connect/${subscription.paypal_subscription_id}/manage`;

    return NextResponse.json({ url: paypalUrl });
  } catch (error) {
    console.error("Error creating PayPal portal link:", error);
    return NextResponse.json(
      { error: "Failed to generate PayPal management link" },
      { status: 500 }
    );
  }
}

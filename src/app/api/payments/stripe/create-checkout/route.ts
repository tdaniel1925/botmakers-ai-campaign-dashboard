import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripeProvider } from "@/lib/payments/stripe-provider";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId } = await request.json();

    if (!planId) {
      return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });
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

    // Get plan with Stripe price ID
    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (!plan || !plan.stripe_price_id) {
      return NextResponse.json(
        { error: "Plan not configured for Stripe" },
        { status: 400 }
      );
    }

    // Check for existing subscription
    const { data: existingSub } = await supabase
      .from("client_subscriptions")
      .select("stripe_customer_id")
      .eq("client_id", client.id)
      .single();

    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL;

    // Create checkout session
    const result = await stripeProvider.createCheckoutSession({
      customerId: existingSub?.stripe_customer_id || undefined,
      customerEmail: client.email,
      customerName: client.name,
      clientId: client.id,
      planId: plan.id,
      priceId: plan.stripe_price_id,
      successUrl: `${origin}/dashboard?checkout=success&provider=stripe`,
      cancelUrl: `${origin}/dashboard/billing?checkout=canceled`,
    });

    return NextResponse.json({ url: result.url });
  } catch (error) {
    console.error("Error creating Stripe checkout:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

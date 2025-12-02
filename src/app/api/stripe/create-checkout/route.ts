import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCustomer, createCheckoutSession } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { priceId } = await request.json();

    if (!priceId) {
      return NextResponse.json({ error: "Price ID is required" }, { status: 400 });
    }

    // Get client info
    const { data: client } = await supabase
      .from("clients")
      .select("id, email, name")
      .eq("email", user.email)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Check if client has a subscription record
    const { data: existingSub } = await supabase
      .from("client_subscriptions")
      .select("stripe_customer_id")
      .eq("client_id", client.id)
      .single();

    let customerId = existingSub?.stripe_customer_id;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await createCustomer(client.email, client.name, client.id);
      customerId = customer.id;

      // Create or update subscription record
      await supabase.from("client_subscriptions").upsert({
        client_id: client.id,
        stripe_customer_id: customerId,
        status: "trialing",
      });
    }

    // Create checkout session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:2900";
    const session = await createCheckoutSession(
      customerId,
      priceId,
      `${appUrl}/dashboard?checkout=success`,
      `${appUrl}/dashboard/billing?checkout=canceled`
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

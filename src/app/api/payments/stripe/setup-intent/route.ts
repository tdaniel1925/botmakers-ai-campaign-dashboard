import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";

let stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    stripe = new Stripe(secretKey, {
      apiVersion: "2024-06-20",
    });
  }
  return stripe;
}

export async function POST() {
  try {
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

    const stripeClient = getStripe();

    // Check for existing Stripe customer
    const { data: existingMethod } = await supabase
      .from("client_payment_methods")
      .select("stripe_customer_id")
      .eq("client_id", client.id)
      .eq("payment_provider", "stripe")
      .not("stripe_customer_id", "is", null)
      .limit(1)
      .single();

    let customerId = existingMethod?.stripe_customer_id;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripeClient.customers.create({
        email: client.email,
        name: client.name,
        metadata: {
          client_id: client.id,
        },
      });
      customerId = customer.id;
    }

    // Create SetupIntent for saving card
    const setupIntent = await stripeClient.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      metadata: {
        client_id: client.id,
      },
    });

    // Create a checkout session for card setup (easier UX than Elements)
    const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await stripeClient.checkout.sessions.create({
      customer: customerId,
      mode: "setup",
      payment_method_types: ["card"],
      success_url: `${origin}/dashboard/billing?setup=success&provider=stripe`,
      cancel_url: `${origin}/dashboard/billing?setup=canceled`,
      metadata: {
        client_id: client.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating Stripe setup intent:", error);
    return NextResponse.json(
      { error: "Failed to create setup session" },
      { status: 500 }
    );
  }
}

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

    // Get client
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("email", user.email)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get subscription with Stripe customer ID
    const { data: subscription } = await supabase
      .from("client_subscriptions")
      .select("stripe_customer_id")
      .eq("client_id", client.id)
      .single();

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No Stripe subscription found" },
        { status: 404 }
      );
    }

    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL;

    const result = await stripeProvider.createPortalSession!({
      customerId: subscription.stripe_customer_id,
      returnUrl: `${origin}/dashboard/billing`,
    });

    return NextResponse.json({ url: result.url });
  } catch (error) {
    console.error("Error creating Stripe portal session:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}

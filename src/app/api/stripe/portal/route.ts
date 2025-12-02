import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPortalSession } from "@/lib/stripe";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get client and their subscription
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("email", user.email)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const { data: subscription } = await supabase
      .from("client_subscriptions")
      .select("stripe_customer_id")
      .eq("client_id", client.id)
      .single();

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No billing account found" },
        { status: 400 }
      );
    }

    // Create portal session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:2900";
    const session = await createPortalSession(
      subscription.stripe_customer_id,
      `${appUrl}/dashboard/billing`
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error creating portal session:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}

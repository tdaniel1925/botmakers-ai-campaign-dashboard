import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSquareConfigured } from "@/lib/payments/square-provider";

export async function POST(request: NextRequest) {
  try {
    if (!isSquareConfigured()) {
      return NextResponse.json(
        { error: "Square is not configured" },
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

    // Get subscription
    const { data: subscription } = await supabase
      .from("client_subscriptions")
      .select("square_subscription_id, square_customer_id")
      .eq("client_id", client.id)
      .single();

    if (!subscription?.square_subscription_id) {
      return NextResponse.json(
        { error: "No Square subscription found" },
        { status: 404 }
      );
    }

    // Square doesn't have a customer portal like Stripe
    // Redirect to Square Dashboard - customers typically contact merchant
    // For self-service, redirect to a cancel/manage page on your site
    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL;

    return NextResponse.json({
      url: `${origin}/dashboard/billing/manage?provider=square`,
      message: "Square subscriptions are managed through customer support or the billing page",
    });
  } catch (error) {
    console.error("Error with Square portal:", error);
    return NextResponse.json(
      { error: "Failed to access Square billing management" },
      { status: 500 }
    );
  }
}

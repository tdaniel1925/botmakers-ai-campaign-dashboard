import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { squareProvider, isSquareConfigured } from "@/lib/payments/square-provider";

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

    // Get plan with Square plan ID
    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (!plan || !plan.square_plan_id) {
      return NextResponse.json(
        { error: "Plan not configured for Square" },
        { status: 400 }
      );
    }

    // Check for existing Square customer
    const { data: existingSub } = await supabase
      .from("client_subscriptions")
      .select("square_customer_id")
      .eq("client_id", client.id)
      .single();

    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL;

    // Create Square subscription
    const result = await squareProvider.createCheckoutSession({
      customerId: existingSub?.square_customer_id || undefined,
      customerEmail: client.email,
      customerName: client.name,
      clientId: client.id,
      planId: plan.id,
      priceId: plan.square_plan_id,
      successUrl: `${origin}/dashboard?checkout=success&provider=square`,
      cancelUrl: `${origin}/dashboard/billing?checkout=canceled`,
    });

    return NextResponse.json({ url: result.url });
  } catch (error) {
    console.error("Error creating Square checkout:", error);
    return NextResponse.json(
      { error: "Failed to create Square subscription" },
      { status: 500 }
    );
  }
}

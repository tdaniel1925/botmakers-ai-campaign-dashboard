import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { paypalProvider, isPayPalConfigured } from "@/lib/payments/paypal-provider";

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

    // Get plan with PayPal plan ID
    const { data: plan } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .single();

    if (!plan || !plan.paypal_plan_id) {
      return NextResponse.json(
        { error: "Plan not configured for PayPal" },
        { status: 400 }
      );
    }

    const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL;

    // Create PayPal subscription
    const result = await paypalProvider.createCheckoutSession({
      customerEmail: client.email,
      customerName: client.name,
      clientId: client.id,
      planId: plan.id,
      priceId: plan.paypal_plan_id,
      successUrl: `${origin}/dashboard?checkout=success&provider=paypal`,
      cancelUrl: `${origin}/dashboard/billing?checkout=canceled`,
    });

    return NextResponse.json({ url: result.url });
  } catch (error) {
    console.error("Error creating PayPal checkout:", error);
    return NextResponse.json(
      { error: "Failed to create PayPal subscription" },
      { status: 500 }
    );
  }
}

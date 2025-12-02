import { NextRequest, NextResponse } from "next/server";
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
      apiVersion: "2025-11-17.clover",
    });
  }
  return stripe;
}

// DELETE - Remove payment method
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Get payment method and verify ownership
    const { data: paymentMethod } = await supabase
      .from("client_payment_methods")
      .select("*")
      .eq("id", id)
      .eq("client_id", client.id)
      .single();

    if (!paymentMethod) {
      return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
    }

    // Check if this is the only payment method
    const { count } = await supabase
      .from("client_payment_methods")
      .select("*", { count: "exact", head: true })
      .eq("client_id", client.id);

    // Detach from payment provider
    try {
      if (paymentMethod.payment_provider === "stripe" && paymentMethod.stripe_payment_method_id) {
        const stripeClient = getStripe();
        await stripeClient.paymentMethods.detach(paymentMethod.stripe_payment_method_id);
      }
      // PayPal and Square don't have direct detach - just remove from our DB
    } catch (providerError) {
      console.error("Error detaching from provider:", providerError);
      // Continue with deletion even if provider detach fails
    }

    // Delete from database
    await supabase
      .from("client_payment_methods")
      .delete()
      .eq("id", id);

    // If this was the default and there are others, set a new default
    if (paymentMethod.is_default && (count || 0) > 1) {
      const { data: newDefault } = await supabase
        .from("client_payment_methods")
        .select("id")
        .eq("client_id", client.id)
        .limit(1)
        .single();

      if (newDefault) {
        await supabase
          .from("client_payment_methods")
          .update({ is_default: true })
          .eq("id", newDefault.id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting payment method:", error);
    return NextResponse.json(
      { error: "Failed to delete payment method" },
      { status: 500 }
    );
  }
}

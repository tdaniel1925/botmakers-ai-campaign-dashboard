import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "No signature" }, { status: 400 });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET not configured");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    const stripeClient = getStripe();
    let event: Stripe.Event;

    try {
      event = stripeClient.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("Stripe webhook signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    switch (event.type) {
      // Handle setup session completed (card saved)
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Only handle setup mode sessions
        if (session.mode !== "setup") break;

        const clientId = session.metadata?.client_id;
        if (!clientId) break;

        const customerId = session.customer as string;
        const setupIntentId = session.setup_intent as string;

        if (setupIntentId) {
          // Get the setup intent to get payment method details
          const setupIntent = await stripeClient.setupIntents.retrieve(setupIntentId);
          const paymentMethodId = setupIntent.payment_method as string;

          if (paymentMethodId) {
            // Get payment method details
            const paymentMethod = await stripeClient.paymentMethods.retrieve(paymentMethodId);
            const card = paymentMethod.card;

            // Check for existing Stripe payment method for this client
            const { data: existing } = await supabase
              .from("client_payment_methods")
              .select("id")
              .eq("client_id", clientId)
              .eq("payment_provider", "stripe")
              .single();

            const paymentMethodData = {
              client_id: clientId,
              payment_provider: "stripe",
              stripe_customer_id: customerId,
              stripe_payment_method_id: paymentMethodId,
              card_brand: card?.brand || null,
              card_last4: card?.last4 || null,
              card_exp_month: card?.exp_month || null,
              card_exp_year: card?.exp_year || null,
              is_default: !existing, // Make default if first card
              is_valid: true,
              updated_at: new Date().toISOString(),
            };

            if (existing) {
              await supabase
                .from("client_payment_methods")
                .update(paymentMethodData)
                .eq("id", existing.id);
            } else {
              await supabase
                .from("client_payment_methods")
                .insert(paymentMethodData);
            }

            // Set as default payment method on customer
            await stripeClient.customers.update(customerId, {
              invoice_settings: {
                default_payment_method: paymentMethodId,
              },
            });

            // Ensure billing account exists
            const { data: billingAccount } = await supabase
              .from("client_billing_accounts")
              .select("id")
              .eq("client_id", clientId)
              .single();

            if (!billingAccount) {
              await supabase
                .from("client_billing_accounts")
                .insert({
                  client_id: clientId,
                  status: "active",
                });
            }
          }
        }
        break;
      }

      // Handle successful payments
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const clientId = paymentIntent.metadata?.client_id;

        if (clientId) {
          // Record payment in billing history
          await supabase.from("billing_history").insert({
            client_id: clientId,
            payment_provider: "stripe",
            stripe_payment_intent_id: paymentIntent.id,
            amount: (paymentIntent.amount / 100).toFixed(2),
            currency: paymentIntent.currency,
            status: "paid",
            description: paymentIntent.description || "Usage charges",
            paid_at: new Date().toISOString(),
          });

          // Update billing account
          await supabase
            .from("client_billing_accounts")
            .update({
              last_charge_at: new Date().toISOString(),
              last_charge_amount: (paymentIntent.amount / 100).toFixed(2),
              current_balance: "0", // Reset balance after payment
              failed_payment_count: 0,
              updated_at: new Date().toISOString(),
            })
            .eq("client_id", clientId);
        }
        break;
      }

      // Handle failed payments
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const clientId = paymentIntent.metadata?.client_id;

        if (clientId) {
          // Update billing account with failure
          await supabase.rpc("increment_failed_payment_count", {
            p_client_id: clientId,
          }).catch(() => {
            // Fallback if RPC doesn't exist
            supabase
              .from("client_billing_accounts")
              .update({
                last_failed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("client_id", clientId);
          });
        }
        break;
      }

      // Handle payment method updates
      case "payment_method.updated": {
        const paymentMethod = event.data.object as Stripe.PaymentMethod;
        const card = paymentMethod.card;

        if (card) {
          await supabase
            .from("client_payment_methods")
            .update({
              card_brand: card.brand,
              card_last4: card.last4,
              card_exp_month: card.exp_month,
              card_exp_year: card.exp_year,
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_payment_method_id", paymentMethod.id);
        }
        break;
      }

      // Handle payment method detached
      case "payment_method.detached": {
        const paymentMethod = event.data.object as Stripe.PaymentMethod;

        await supabase
          .from("client_payment_methods")
          .update({
            is_valid: false,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_payment_method_id", paymentMethod.id);
        break;
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = constructWebhookEvent(body, signature);
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Find client by Stripe customer ID
        const { data: clientSub } = await supabase
          .from("client_subscriptions")
          .select("id, client_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (clientSub) {
          // Access subscription period from the items
          const subscriptionItem = subscription.items?.data?.[0];
          const periodStart = subscriptionItem?.current_period_start || Math.floor(Date.now() / 1000);
          const periodEnd = subscriptionItem?.current_period_end || Math.floor(Date.now() / 1000);

          await supabase
            .from("client_subscriptions")
            .update({
              stripe_subscription_id: subscription.id,
              status: subscription.status,
              current_period_start: new Date(periodStart * 1000).toISOString(),
              current_period_end: new Date(periodEnd * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end,
              updated_at: new Date().toISOString(),
            })
            .eq("id", clientSub.id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: clientSub } = await supabase
          .from("client_subscriptions")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (clientSub) {
          await supabase
            .from("client_subscriptions")
            .update({
              status: "canceled",
              updated_at: new Date().toISOString(),
            })
            .eq("id", clientSub.id);
        }
        break;
      }

      case "invoice.paid": {
        // Use unknown first then access properties safely
        const invoiceData = event.data.object as unknown as Record<string, unknown>;
        const customerId = invoiceData.customer as string;

        // Find client
        const { data: clientSub } = await supabase
          .from("client_subscriptions")
          .select("client_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (clientSub) {
          // Record in billing history
          const amountPaid = (invoiceData.amount_paid as number) || 0;
          const periodStart = invoiceData.period_start as number | undefined;
          const periodEnd = invoiceData.period_end as number | undefined;

          await supabase.from("billing_history").insert({
            client_id: clientSub.client_id,
            stripe_invoice_id: invoiceData.id as string,
            stripe_payment_intent_id: (invoiceData.payment_intent as string) || null,
            amount: (amountPaid / 100).toString(),
            currency: invoiceData.currency as string,
            status: "paid",
            description: (invoiceData.description as string) || "Subscription payment",
            invoice_pdf_url: (invoiceData.invoice_pdf as string) || null,
            period_start: periodStart
              ? new Date(periodStart * 1000).toISOString()
              : null,
            period_end: periodEnd
              ? new Date(periodEnd * 1000).toISOString()
              : null,
            paid_at: new Date().toISOString(),
          });

          // Reset monthly usage
          await supabase
            .from("client_subscriptions")
            .update({
              calls_used_this_month: 0,
              last_usage_reset_at: new Date().toISOString(),
            })
            .eq("client_id", clientSub.client_id);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoiceData = event.data.object as unknown as Record<string, unknown>;
        const customerId = invoiceData.customer as string;

        const { data: clientSub } = await supabase
          .from("client_subscriptions")
          .select("client_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (clientSub) {
          const amountDue = (invoiceData.amount_due as number) || 0;

          await supabase.from("billing_history").insert({
            client_id: clientSub.client_id,
            stripe_invoice_id: invoiceData.id as string,
            amount: (amountDue / 100).toString(),
            currency: invoiceData.currency as string,
            status: "open",
            description: "Payment failed",
          });

          // Update subscription status
          await supabase
            .from("client_subscriptions")
            .update({
              status: "past_due",
              updated_at: new Date().toISOString(),
            })
            .eq("client_id", clientSub.client_id);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

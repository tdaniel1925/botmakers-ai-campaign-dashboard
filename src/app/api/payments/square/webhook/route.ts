import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { squareProvider, isSquareConfigured } from "@/lib/payments/square-provider";

export async function POST(request: NextRequest) {
  try {
    if (!isSquareConfigured()) {
      return NextResponse.json({ error: "Square not configured" }, { status: 503 });
    }

    const body = await request.text();
    const signature = request.headers.get("x-square-hmacsha256-signature") || "";

    let event;
    try {
      event = await squareProvider.constructWebhookEvent(body, signature);
    } catch (err) {
      console.error("Square webhook signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    switch (event.type) {
      case "subscription.created":
      case "subscription.updated": {
        const subscription = event.data as {
          subscription?: {
            id: string;
            customer_id: string;
            plan_variation_id: string;
            status: string;
            start_date?: string;
            charged_through_date?: string;
          };
        };

        const sub = subscription.subscription;
        if (!sub) break;

        // Find client by Square customer ID
        const { data: existingSub } = await supabase
          .from("client_subscriptions")
          .select("client_id")
          .eq("square_customer_id", sub.customer_id)
          .single();

        if (!existingSub) {
          console.log("No client found for Square customer:", sub.customer_id);
          break;
        }

        // Find plan by Square plan variation ID
        const { data: plan } = await supabase
          .from("subscription_plans")
          .select("id")
          .eq("square_plan_id", sub.plan_variation_id)
          .single();

        // Map Square status to our status
        const statusMap: Record<string, string> = {
          PENDING: "trialing",
          ACTIVE: "active",
          CANCELED: "canceled",
          DEACTIVATED: "canceled",
          PAUSED: "past_due",
        };

        await supabase
          .from("client_subscriptions")
          .update({
            plan_id: plan?.id || null,
            square_subscription_id: sub.id,
            status: statusMap[sub.status] || "active",
            current_period_start: sub.start_date ? new Date(sub.start_date).toISOString() : null,
            current_period_end: sub.charged_through_date
              ? new Date(sub.charged_through_date).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq("client_id", existingSub.client_id);

        break;
      }

      case "subscription.canceled": {
        const subscription = event.data as {
          subscription?: {
            id: string;
            customer_id: string;
          };
        };

        const sub = subscription.subscription;
        if (!sub) break;

        await supabase
          .from("client_subscriptions")
          .update({
            status: "canceled",
            cancel_at_period_end: true,
            updated_at: new Date().toISOString(),
          })
          .eq("square_subscription_id", sub.id);

        break;
      }

      case "invoice.payment_made": {
        const invoiceData = event.data as {
          invoice?: {
            id: string;
            subscription_id?: string;
            order_id?: string;
            payment_requests?: Array<{
              computed_amount_money?: {
                amount?: number;
                currency?: string;
              };
            }>;
          };
        };

        const invoice = invoiceData.invoice;
        if (!invoice?.subscription_id) break;

        // Find subscription
        const { data: sub } = await supabase
          .from("client_subscriptions")
          .select("client_id")
          .eq("square_subscription_id", invoice.subscription_id)
          .single();

        if (sub) {
          const amount = invoice.payment_requests?.[0]?.computed_amount_money?.amount || 0;
          const currency = invoice.payment_requests?.[0]?.computed_amount_money?.currency || "USD";

          // Record payment (Square amounts are in cents)
          await supabase.from("billing_history").insert({
            client_id: sub.client_id,
            payment_provider: "square",
            square_payment_id: invoice.id,
            square_order_id: invoice.order_id || null,
            amount: (amount / 100).toFixed(2),
            currency: currency.toLowerCase(),
            status: "paid",
            description: "Square subscription payment",
            paid_at: new Date().toISOString(),
          });

          // Reset monthly usage
          await supabase
            .from("client_subscriptions")
            .update({
              calls_used_this_month: 0,
              last_usage_reset_at: new Date().toISOString(),
            })
            .eq("client_id", sub.client_id);
        }

        break;
      }

      default:
        console.log(`Unhandled Square event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Square webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

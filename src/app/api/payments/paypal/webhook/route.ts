import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { paypalProvider, isPayPalConfigured } from "@/lib/payments/paypal-provider";

export async function POST(request: NextRequest) {
  try {
    if (!isPayPalConfigured()) {
      return NextResponse.json({ error: "PayPal not configured" }, { status: 503 });
    }

    const body = await request.text();
    const signature = request.headers.get("paypal-transmission-sig") || "";

    let event;
    try {
      event = await paypalProvider.constructWebhookEvent(body, signature);
    } catch (err) {
      console.error("PayPal webhook signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    switch (event.type) {
      case "BILLING.SUBSCRIPTION.CREATED":
      case "BILLING.SUBSCRIPTION.ACTIVATED": {
        const subscription = event.data as {
          id: string;
          custom_id?: string;
          plan_id: string;
          status: string;
          billing_info?: {
            next_billing_time?: string;
          };
          subscriber?: {
            payer_id?: string;
          };
        };

        const clientId = subscription.custom_id;
        if (!clientId) break;

        // Find plan by PayPal plan ID
        const { data: plan } = await supabase
          .from("subscription_plans")
          .select("id")
          .eq("paypal_plan_id", subscription.plan_id)
          .single();

        // Update or create subscription
        await supabase
          .from("client_subscriptions")
          .upsert({
            client_id: clientId,
            plan_id: plan?.id || null,
            payment_provider: "paypal",
            paypal_subscription_id: subscription.id,
            paypal_payer_id: subscription.subscriber?.payer_id || null,
            status: subscription.status === "ACTIVE" ? "active" : "trialing",
            current_period_end: subscription.billing_info?.next_billing_time
              ? new Date(subscription.billing_info.next_billing_time).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: "client_id",
          });

        break;
      }

      case "BILLING.SUBSCRIPTION.CANCELLED":
      case "BILLING.SUBSCRIPTION.SUSPENDED": {
        const subscription = event.data as {
          id: string;
          custom_id?: string;
          status: string;
        };

        await supabase
          .from("client_subscriptions")
          .update({
            status: "canceled",
            cancel_at_period_end: true,
            updated_at: new Date().toISOString(),
          })
          .eq("paypal_subscription_id", subscription.id);

        break;
      }

      case "PAYMENT.SALE.COMPLETED": {
        const payment = event.data as {
          id: string;
          billing_agreement_id?: string;
          amount: {
            total: string;
            currency: string;
          };
          custom?: string;
        };

        // Find subscription by billing agreement
        if (payment.billing_agreement_id) {
          const { data: sub } = await supabase
            .from("client_subscriptions")
            .select("client_id")
            .eq("paypal_subscription_id", payment.billing_agreement_id)
            .single();

          if (sub) {
            // Record payment
            await supabase.from("billing_history").insert({
              client_id: sub.client_id,
              payment_provider: "paypal",
              paypal_transaction_id: payment.id,
              amount: payment.amount.total,
              currency: payment.amount.currency.toLowerCase(),
              status: "paid",
              description: "PayPal subscription payment",
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
        }

        break;
      }

      default:
        console.log(`Unhandled PayPal event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("PayPal webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

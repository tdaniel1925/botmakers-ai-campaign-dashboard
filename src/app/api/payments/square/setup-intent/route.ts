import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SquareClient, SquareEnvironment } from "square";
import crypto from "crypto";

let squareClient: SquareClient | null = null;

function getSquareClient(): SquareClient {
  if (!squareClient) {
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error("SQUARE_ACCESS_TOKEN is not set");
    }

    squareClient = new SquareClient({
      token: accessToken,
      environment: process.env.SQUARE_ENVIRONMENT === "production"
        ? SquareEnvironment.Production
        : SquareEnvironment.Sandbox,
    });
  }
  return squareClient;
}

export async function POST() {
  try {
    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const applicationId = process.env.SQUARE_APPLICATION_ID;
    const locationId = process.env.SQUARE_LOCATION_ID;

    if (!accessToken || !applicationId || !locationId) {
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
      .select("id, name, email")
      .eq("email", user.email)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const square = getSquareClient();

    // Check for existing Square customer
    const { data: existingMethod } = await supabase
      .from("client_payment_methods")
      .select("square_customer_id")
      .eq("client_id", client.id)
      .eq("payment_provider", "square")
      .not("square_customer_id", "is", null)
      .limit(1)
      .single();

    let customerId = existingMethod?.square_customer_id;

    // Create Square customer if doesn't exist
    if (!customerId) {
      const customerResponse = await square.customers.create({
        idempotencyKey: crypto.randomUUID(),
        emailAddress: client.email,
        givenName: client.name.split(" ")[0],
        familyName: client.name.split(" ").slice(1).join(" ") || undefined,
        referenceId: client.id,
      });

      if (!customerResponse.customer?.id) {
        throw new Error("Failed to create Square customer");
      }
      customerId = customerResponse.customer.id;
    }

    // Square Web Payments SDK needs to be used on the frontend
    // Return the data needed to initialize the SDK
    const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    return NextResponse.json({
      // Redirect to a page that uses Square Web Payments SDK
      url: `${origin}/dashboard/billing/add-card?provider=square&customer_id=${customerId}`,
      customerId,
      applicationId,
      locationId,
    });
  } catch (error) {
    console.error("Error creating Square setup:", error);
    return NextResponse.json(
      { error: "Failed to create Square setup session" },
      { status: 500 }
    );
  }
}

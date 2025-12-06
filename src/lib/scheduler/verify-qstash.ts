import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || "",
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || "",
});

/**
 * Verify QStash signature for App Router handlers
 * Returns null if signature is valid, or an error response if invalid
 */
export async function verifyQStashSignature(
  request: NextRequest
): Promise<NextResponse | null> {
  // Skip verification in development
  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  const signature = request.headers.get("upstash-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing QStash signature" },
      { status: 401 }
    );
  }

  try {
    const body = await request.text();
    const isValid = await receiver.verify({
      signature,
      body,
    });

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid QStash signature" },
        { status: 401 }
      );
    }

    // Re-create the request with the body for the handler
    // Note: The body has already been consumed, so the handler needs to parse it from the passed body
    return null;
  } catch (error) {
    console.error("QStash signature verification failed:", error);
    return NextResponse.json(
      { error: "QStash signature verification failed" },
      { status: 401 }
    );
  }
}

/**
 * Wrapper to verify QStash and get parsed body
 * Returns { error: Response } if verification fails, or { body: T } if successful
 */
export async function verifyQStashAndGetBody<T>(
  request: NextRequest
): Promise<{ error: NextResponse } | { body: T }> {
  // Skip verification in development
  if (process.env.NODE_ENV !== "production") {
    const body = await request.json();
    return { body: body as T };
  }

  const signature = request.headers.get("upstash-signature");

  if (!signature) {
    return {
      error: NextResponse.json(
        { error: "Missing QStash signature" },
        { status: 401 }
      ),
    };
  }

  try {
    const bodyText = await request.text();
    const isValid = await receiver.verify({
      signature,
      body: bodyText,
    });

    if (!isValid) {
      return {
        error: NextResponse.json(
          { error: "Invalid QStash signature" },
          { status: 401 }
        ),
      };
    }

    return { body: JSON.parse(bodyText) as T };
  } catch (error) {
    console.error("QStash signature verification failed:", error);
    return {
      error: NextResponse.json(
        { error: "QStash signature verification failed" },
        { status: 401 }
      ),
    };
  }
}

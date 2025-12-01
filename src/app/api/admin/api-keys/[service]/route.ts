import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateApiKeys, serviceConfig, ApiService } from "@/lib/api-keys";
import { verifyAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/admin-auth";
import { decryptObject, isEncrypted } from "@/lib/encryption";

// Lazy init to avoid build-time errors
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Helper to decrypt key data - handles both encrypted strings and legacy plain objects
 */
function getDecryptedKeyData(keyData: unknown): Record<string, string> | null {
  if (!keyData) return null;

  // If it's a string, it should be encrypted
  if (typeof keyData === "string") {
    if (isEncrypted(keyData)) {
      try {
        return decryptObject<Record<string, string>>(keyData);
      } catch (error) {
        console.error("Failed to decrypt key data:", error);
        return null;
      }
    }
    return null;
  }

  // Legacy: plain object (not encrypted)
  if (typeof keyData === "object") {
    return keyData as Record<string, string>;
  }

  return null;
}

// GET - Fetch API keys for a specific service (full data)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ service: string }> }
) {
  // Verify admin authentication
  const authResult = await verifyAdmin();
  if (!authResult.authenticated || !authResult.admin) {
    return authResult.error === "Not authenticated"
      ? unauthorizedResponse(authResult.error)
      : forbiddenResponse(authResult.error);
  }

  try {
    const supabase = getSupabaseClient();
    const { service } = await params;

    if (!Object.keys(serviceConfig).includes(service)) {
      return NextResponse.json(
        { error: "Invalid service" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("api_keys")
      .select("*")
      .eq("service", service)
      .single();

    const config = serviceConfig[service as ApiService];

    if (error || !data) {
      // Return env fallback info
      const envKeys: Record<string, string> = {};
      let hasEnvKeys = false;

      for (const field of config.fields) {
        const envKey = config.envKeys[field.key];
        const value = process.env[envKey];
        if (value) {
          envKeys[field.key] = value;
          hasEnvKeys = true;
        }
      }

      return NextResponse.json({
        service,
        source: hasEnvKeys ? "env" : null,
        keyData: hasEnvKeys ? envKeys : null,
        isActive: hasEnvKeys,
        config,
      });
    }

    // Decrypt the key data
    const decryptedKeyData = getDecryptedKeyData(data.key_data);

    return NextResponse.json({
      service,
      source: "database",
      keyData: decryptedKeyData,
      isActive: data.is_active,
      lastValidated: data.last_validated,
      validationStatus: data.validation_status,
      config,
    });
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return NextResponse.json(
      { error: "Failed to fetch API keys" },
      { status: 500 }
    );
  }
}

// PUT - Update API key status (enable/disable)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ service: string }> }
) {
  // Verify admin authentication
  const authResult = await verifyAdmin();
  if (!authResult.authenticated || !authResult.admin) {
    return authResult.error === "Not authenticated"
      ? unauthorizedResponse(authResult.error)
      : forbiddenResponse(authResult.error);
  }

  try {
    const supabase = getSupabaseClient();
    const { service } = await params;
    const body = await request.json();

    const { isActive } = body;

    if (typeof isActive !== "boolean") {
      return NextResponse.json(
        { error: "isActive must be a boolean" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("api_keys")
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("service", service)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      isActive: data.is_active,
    });
  } catch (error) {
    console.error("Error updating API key:", error);
    return NextResponse.json(
      { error: "Failed to update API key" },
      { status: 500 }
    );
  }
}

// DELETE - Remove API keys for a service (falls back to .env)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ service: string }> }
) {
  // Verify admin authentication
  const authResult = await verifyAdmin();
  if (!authResult.authenticated || !authResult.admin) {
    return authResult.error === "Not authenticated"
      ? unauthorizedResponse(authResult.error)
      : forbiddenResponse(authResult.error);
  }

  try {
    const supabase = getSupabaseClient();
    const { service } = await params;

    const { error } = await supabase
      .from("api_keys")
      .delete()
      .eq("service", service);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "API keys removed. Will now use .env fallback if available.",
    });
  } catch (error) {
    console.error("Error deleting API keys:", error);
    return NextResponse.json(
      { error: "Failed to delete API keys" },
      { status: 500 }
    );
  }
}

// POST - Validate existing keys
export async function POST(
  request: Request,
  { params }: { params: Promise<{ service: string }> }
) {
  // Verify admin authentication
  const authResult = await verifyAdmin();
  if (!authResult.authenticated || !authResult.admin) {
    return authResult.error === "Not authenticated"
      ? unauthorizedResponse(authResult.error)
      : forbiddenResponse(authResult.error);
  }

  try {
    const supabase = getSupabaseClient();
    const { service } = await params;

    if (!Object.keys(serviceConfig).includes(service)) {
      return NextResponse.json(
        { error: "Invalid service" },
        { status: 400 }
      );
    }

    // Get current keys
    const { data } = await supabase
      .from("api_keys")
      .select("key_data")
      .eq("service", service)
      .single();

    let keyData: Record<string, string> | null = null;

    if (data?.key_data) {
      keyData = getDecryptedKeyData(data.key_data);
    }

    // If no database keys, try .env
    if (!keyData) {
      const config = serviceConfig[service as ApiService];
      const envKeys: Record<string, string> = {};
      let hasEnvKeys = false;

      for (const field of config.fields) {
        const envKey = config.envKeys[field.key];
        const value = process.env[envKey];
        if (value) {
          envKeys[field.key] = value;
          hasEnvKeys = true;
        }
      }

      if (hasEnvKeys) {
        keyData = envKeys;
      }
    }

    if (!keyData) {
      return NextResponse.json(
        { error: "No keys configured for this service" },
        { status: 400 }
      );
    }

    // Validate
    const result = await validateApiKeys(service as ApiService, keyData);

    // Update validation status in database if keys are stored there
    if (data) {
      await supabase
        .from("api_keys")
        .update({
          last_validated: new Date().toISOString(),
          validation_status: result.valid ? "valid" : "invalid",
        })
        .eq("service", service);
    }

    return NextResponse.json({
      valid: result.valid,
      error: result.error,
      lastValidated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error validating API keys:", error);
    return NextResponse.json(
      { error: "Failed to validate API keys" },
      { status: 500 }
    );
  }
}

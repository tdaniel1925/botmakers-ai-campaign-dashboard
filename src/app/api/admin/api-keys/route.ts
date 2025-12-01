import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateApiKeys, serviceConfig, ApiService } from "@/lib/api-keys";
import { verifyAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/admin-auth";
import { encryptObject } from "@/lib/encryption";

// Lazy init to avoid build-time errors
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - Fetch all API keys (without sensitive data for listing)
export async function GET() {
  // Verify admin authentication
  const authResult = await verifyAdmin();
  if (!authResult.authenticated || !authResult.admin) {
    return authResult.error === "Not authenticated"
      ? unauthorizedResponse(authResult.error)
      : forbiddenResponse(authResult.error);
  }

  try {
    const supabase = getSupabaseClient();

    const { data: keys, error } = await supabase
      .from("api_keys")
      .select("id, service, is_active, last_validated, validation_status, created_at, updated_at")
      .order("service", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return list of services with their configuration status
    const allServices = Object.keys(serviceConfig) as ApiService[];
    const serviceStatus = allServices.map((service) => {
      const dbKey = keys?.find((k) => k.service === service);
      const config = serviceConfig[service];

      // Check .env fallback
      let hasEnvKeys = false;
      for (const field of config.fields) {
        const envKey = config.envKeys[field.key];
        if (process.env[envKey]) {
          hasEnvKeys = true;
          break;
        }
      }

      return {
        service,
        name: config.name,
        description: config.description,
        isConfigured: !!dbKey || hasEnvKeys,
        source: dbKey ? "database" : hasEnvKeys ? "env" : null,
        isActive: dbKey?.is_active ?? false,
        lastValidated: dbKey?.last_validated,
        validationStatus: dbKey?.validation_status,
        updatedAt: dbKey?.updated_at,
      };
    });

    return NextResponse.json({ services: serviceStatus });
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return NextResponse.json(
      { error: "Failed to fetch API keys" },
      { status: 500 }
    );
  }
}

// POST - Save/update API keys for a service
export async function POST(request: Request) {
  // Verify admin authentication
  const authResult = await verifyAdmin();
  if (!authResult.authenticated || !authResult.admin) {
    return authResult.error === "Not authenticated"
      ? unauthorizedResponse(authResult.error)
      : forbiddenResponse(authResult.error);
  }

  try {
    const supabase = getSupabaseClient();
    const body = await request.json();

    const { service, keyData, validate = true } = body;

    if (!service || !keyData) {
      return NextResponse.json(
        { error: "Service and keyData are required" },
        { status: 400 }
      );
    }

    if (!Object.keys(serviceConfig).includes(service)) {
      return NextResponse.json(
        { error: "Invalid service" },
        { status: 400 }
      );
    }

    // Validate required fields
    const config = serviceConfig[service as ApiService];
    for (const field of config.fields) {
      if (field.required && !keyData[field.key]) {
        return NextResponse.json(
          { error: `${field.label} is required` },
          { status: 400 }
        );
      }
    }

    // Validate keys if requested
    let validationStatus = "pending";
    let validationError = null;

    if (validate) {
      const result = await validateApiKeys(service as ApiService, keyData);
      validationStatus = result.valid ? "valid" : "invalid";
      if (!result.valid) {
        validationError = result.error;
      }
    }

    // Encrypt the key data before storing
    const encryptedKeyData = encryptObject(keyData);

    // Upsert the key
    const { data, error } = await supabase
      .from("api_keys")
      .upsert(
        {
          service,
          key_data: encryptedKeyData, // Store as encrypted string
          is_active: true,
          last_validated: validate ? new Date().toISOString() : null,
          validation_status: validationStatus,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "service" }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      service,
      validationStatus,
      validationError,
      data: {
        id: data.id,
        service: data.service,
        isActive: data.is_active,
        lastValidated: data.last_validated,
        validationStatus: data.validation_status,
      },
    });
  } catch (error) {
    console.error("Error saving API keys:", error);
    return NextResponse.json(
      { error: "Failed to save API keys" },
      { status: 500 }
    );
  }
}

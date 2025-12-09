import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin, forbiddenResponse } from "@/lib/admin-auth";

interface VerifyResult {
  success: boolean;
  provider: string;
  assistant?: {
    id: string;
    name: string;
  };
  error?: string;
}

/**
 * POST /api/admin/outbound-campaigns/verify-provider
 * Verify connection to a call provider (Vapi, AutoCalls.ai, or Synthflow)
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyAdmin();
    if (!authResult.authenticated || !authResult.admin) {
      return forbiddenResponse(authResult.error);
    }

    const body = await request.json();
    const { provider, api_key, assistant_id, model_id, use_system_key } = body;

    if (!provider) {
      return NextResponse.json(
        { error: "Provider is required" },
        { status: 400 }
      );
    }

    // Determine which API key to use
    let effectiveApiKey = api_key;

    // For Vapi with system keys, use server-side environment variable
    if (provider === "vapi" && use_system_key) {
      effectiveApiKey = process.env.VAPI_API_KEY;
      if (!effectiveApiKey) {
        return NextResponse.json(
          { error: "System Vapi API key is not configured. Please contact the administrator." },
          { status: 500 }
        );
      }
    } else if (!api_key) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    let result: VerifyResult;

    switch (provider) {
      case "vapi":
        result = await verifyVapi(effectiveApiKey, assistant_id);
        break;
      case "autocalls":
        result = await verifyAutoCalls(api_key, assistant_id);
        break;
      case "synthflow":
        result = await verifySynthflow(api_key, model_id);
        break;
      default:
        return NextResponse.json(
          { error: `Unknown provider: ${provider}` },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, provider: result.provider },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error verifying provider:", error);
    return NextResponse.json(
      { error: "Failed to verify provider connection" },
      { status: 500 }
    );
  }
}

/**
 * Verify Vapi API key and optionally assistant
 */
async function verifyVapi(apiKey: string, assistantId?: string): Promise<VerifyResult> {
  try {
    // If assistant ID is provided, verify it exists
    if (assistantId) {
      const response = await fetch(`https://api.vapi.ai/assistant/${assistantId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          return {
            success: false,
            provider: "vapi",
            error: "Invalid API key",
          };
        }
        if (response.status === 404) {
          return {
            success: false,
            provider: "vapi",
            error: "Assistant not found",
          };
        }
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          provider: "vapi",
          error: errorData.message || `API error: ${response.status}`,
        };
      }

      const assistant = await response.json();
      return {
        success: true,
        provider: "vapi",
        assistant: {
          id: assistant.id,
          name: assistant.name || "Unnamed Assistant",
        },
      };
    }

    // Just verify API key by listing assistants
    const response = await fetch("https://api.vapi.ai/assistant", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return {
          success: false,
          provider: "vapi",
          error: "Invalid API key",
        };
      }
      return {
        success: false,
        provider: "vapi",
        error: `API error: ${response.status}`,
      };
    }

    return {
      success: true,
      provider: "vapi",
    };
  } catch (error) {
    console.error("Vapi verification error:", error);
    return {
      success: false,
      provider: "vapi",
      error: "Failed to connect to Vapi API",
    };
  }
}

/**
 * Verify AutoCalls.ai API key and optionally assistant
 */
async function verifyAutoCalls(apiKey: string, assistantId?: string): Promise<VerifyResult> {
  try {
    // Fetch list of assistants to verify API key
    const response = await fetch("https://app.autocalls.ai/api/user/assistants/get", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          provider: "autocalls",
          error: "Invalid API key",
        };
      }
      return {
        success: false,
        provider: "autocalls",
        error: `API error: ${response.status}`,
      };
    }

    const data = await response.json();

    // If assistant ID is provided, check if it exists in the list
    if (assistantId) {
      const assistantIdNum = parseInt(assistantId, 10);
      const assistants = data.assistants || data.data || data || [];
      const assistant = assistants.find((a: { id: number; name?: string }) =>
        a.id === assistantIdNum
      );

      if (!assistant) {
        return {
          success: false,
          provider: "autocalls",
          error: "Assistant not found in your account",
        };
      }

      return {
        success: true,
        provider: "autocalls",
        assistant: {
          id: String(assistant.id),
          name: assistant.name || "Unnamed Assistant",
        },
      };
    }

    return {
      success: true,
      provider: "autocalls",
    };
  } catch (error) {
    console.error("AutoCalls verification error:", error);
    return {
      success: false,
      provider: "autocalls",
      error: "Failed to connect to AutoCalls.ai API",
    };
  }
}

/**
 * Verify Synthflow API key and optionally model
 */
async function verifySynthflow(apiKey: string, modelId?: string): Promise<VerifyResult> {
  try {
    // If model ID is provided, verify it exists
    if (modelId) {
      const response = await fetch(`https://api.synthflow.ai/v2/assistants/${modelId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return {
            success: false,
            provider: "synthflow",
            error: "Invalid API key",
          };
        }
        if (response.status === 404) {
          return {
            success: false,
            provider: "synthflow",
            error: "Model/Assistant not found",
          };
        }
        return {
          success: false,
          provider: "synthflow",
          error: `API error: ${response.status}`,
        };
      }

      const assistant = await response.json();
      return {
        success: true,
        provider: "synthflow",
        assistant: {
          id: assistant.model_id || modelId,
          name: assistant.name || "Unnamed Assistant",
        },
      };
    }

    // Just verify API key by listing assistants
    const response = await fetch("https://api.synthflow.ai/v2/assistants/", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          provider: "synthflow",
          error: "Invalid API key",
        };
      }
      return {
        success: false,
        provider: "synthflow",
        error: `API error: ${response.status}`,
      };
    }

    return {
      success: true,
      provider: "synthflow",
    };
  } catch (error) {
    console.error("Synthflow verification error:", error);
    return {
      success: false,
      provider: "synthflow",
      error: "Failed to connect to Synthflow API",
    };
  }
}

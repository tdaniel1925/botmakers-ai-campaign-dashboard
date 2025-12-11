import { createClient } from "@/lib/supabase/server";
import { verifyAdmin } from "@/lib/admin-auth";

export interface ClientAuthResult {
  authenticated: boolean;
  clientId: string | null;
  isImpersonating: boolean;
  error?: string;
}

/**
 * Get the client ID for API requests.
 * Supports admin impersonation via X-Impersonate-Client-Id header.
 *
 * @param request - The incoming request object to check for impersonation header
 */
export async function getClientId(request?: Request): Promise<ClientAuthResult> {
  try {
    const supabase = await createClient();

    // Check for impersonation header
    const impersonatedClientId = request?.headers.get("X-Impersonate-Client-Id");

    if (impersonatedClientId) {
      // Verify the requester is an admin
      const adminAuth = await verifyAdmin();
      console.log("[client-auth] Impersonation attempt:", {
        impersonatedClientId,
        adminAuth: { authenticated: adminAuth.authenticated, error: adminAuth.error }
      });
      if (!adminAuth.authenticated || !adminAuth.admin) {
        return {
          authenticated: false,
          clientId: null,
          isImpersonating: false,
          error: "Admin access required for impersonation",
        };
      }

      // Verify the client exists
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id")
        .eq("id", impersonatedClientId)
        .single();

      if (clientError || !client) {
        return {
          authenticated: false,
          clientId: null,
          isImpersonating: false,
          error: "Impersonated client not found",
        };
      }

      return {
        authenticated: true,
        clientId: client.id,
        isImpersonating: true,
      };
    }

    // Normal authentication flow
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return {
        authenticated: false,
        clientId: null,
        isImpersonating: false,
        error: "Not authenticated",
      };
    }

    // First try to find client by email (owner)
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("email", user.email)
      .single();

    if (client) {
      return {
        authenticated: true,
        clientId: client.id,
        isImpersonating: false,
      };
    }

    // Try to find user in client_users table (team member)
    const { data: clientUser, error: clientUserError } = await supabase
      .from("client_users")
      .select("client_id")
      .eq("email", user.email)
      .single();

    if (clientUser) {
      return {
        authenticated: true,
        clientId: clientUser.client_id,
        isImpersonating: false,
      };
    }

    return {
      authenticated: false,
      clientId: null,
      isImpersonating: false,
      error: "Client not found",
    };
  } catch (error) {
    console.error("Client auth error:", error);
    return {
      authenticated: false,
      clientId: null,
      isImpersonating: false,
      error: "Authentication error",
    };
  }
}

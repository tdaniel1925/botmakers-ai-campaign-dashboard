"use client";

import { useState, useEffect } from "react";
import { ClientSidebar, MobileMenuButton } from "@/components/dashboard/client-sidebar";
import { createClient } from "@/lib/supabase/client";
import { SessionTimeoutWarning } from "@/components/shared/session-timeout-warning";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Eye } from "lucide-react";
import { ClientContext } from "@/contexts/client-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string>("User");
  const [companyName, setCompanyName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("owner");
  const [isLoading, setIsLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const supabase = createClient();

  const handleBackToAdmin = () => {
    sessionStorage.removeItem("viewAsClientId");
    window.location.href = "/admin";
  };

  const fetchData = async () => {
    try {
      // Check if admin is impersonating a client
      const impersonatedClientId = typeof window !== "undefined"
        ? sessionStorage.getItem("viewAsClientId")
        : null;

      if (impersonatedClientId) {
        // Admin impersonation mode - load the selected client's data
        setIsImpersonating(true);
        const { data: client } = await supabase
          .from("clients")
          .select("id, name, company_name, email")
          .eq("id", impersonatedClientId)
          .single();

        if (client) {
          setClientId(client.id);
          setClientName(client.name);
          setCompanyName(client.company_name || client.name);
          setUserEmail(client.email);
          setUserRole("owner"); // Admin sees as owner
        }
        setIsLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        setUserEmail(user.email);

        // Try to find client by email
        const { data: client } = await supabase
          .from("clients")
          .select("id, name, company_name, email, status")
          .eq("email", user.email)
          .single();

        if (client) {
          setClientId(client.id);
          setClientName(client.name);
          setCompanyName(client.company_name || client.name);

          // Auto-activate client on first login if status is pending
          if (client.status === "pending") {
            await supabase
              .from("clients")
              .update({ status: "active", updated_at: new Date().toISOString() })
              .eq("id", client.id);
          }

          // Get user role from client_users if exists
          const { data: clientUser } = await supabase
            .from("client_users")
            .select("role")
            .eq("client_id", client.id)
            .eq("email", user.email)
            .single();

          if (clientUser) {
            setUserRole(clientUser.role);
          }
        } else {
          // Try to find user in client_users table (team member)
          const { data: clientUser } = await supabase
            .from("client_users")
            .select(`
              id,
              name,
              email,
              role,
              client:clients(id, name, company_name)
            `)
            .eq("email", user.email)
            .single();

          if (clientUser && clientUser.client) {
            // Handle both array and single object responses from Supabase
            const clientArray = clientUser.client as unknown;
            const clientData = Array.isArray(clientArray)
              ? clientArray[0] as { id: string; name: string; company_name: string | null }
              : clientArray as { id: string; name: string; company_name: string | null };

            if (clientData) {
              setClientId(clientData.id);
              setClientName(clientUser.name);
              setCompanyName(clientData.company_name || clientData.name);
              setUserRole(clientUser.role);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error fetching client data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [supabase]);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <ClientContext.Provider
      value={{
        clientId,
        clientName,
        companyName,
        userEmail,
        userRole,
        isLoading,
        isImpersonating,
        refetch: fetchData,
      }}
    >
      <div className="flex h-screen flex-col">
        {/* Admin Impersonation Banner */}
        {isImpersonating && (
          <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between z-50">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              <span className="text-sm font-medium">
                Preview Mode: Viewing as <strong>{companyName || clientName}</strong>
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="bg-white/20 border-amber-700 hover:bg-white/30 text-amber-950"
              onClick={handleBackToAdmin}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Admin
            </Button>
          </div>
        )}
        <div className="flex flex-1 overflow-hidden">
          <ClientSidebar
            userName={clientName}
            userEmail={userEmail}
            companyName={companyName}
            userRole={userRole}
            isOpen={sidebarOpen}
            onToggle={toggleSidebar}
          />
          <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-background">
            {/* Mobile header */}
            <div className="sticky top-0 z-30 flex items-center gap-4 border-b bg-background p-4 lg:hidden">
              <MobileMenuButton onClick={toggleSidebar} />
              <span className="font-semibold">{companyName || "Dashboard"}</span>
            </div>
            <div className="container mx-auto py-6 px-4 max-w-7xl">{children}</div>
          </main>
        </div>
        {!isImpersonating && <SessionTimeoutWarning logoutUrl="/login" />}
      </div>
    </ClientContext.Provider>
  );
}

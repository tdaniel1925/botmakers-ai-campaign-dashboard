import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminsManagement } from "./admins-management";

export default async function AdminsPage() {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check if current user is super_admin
  const { data: currentAdmin } = await supabase
    .from("admin_users")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (!currentAdmin || currentAdmin.role !== "super_admin") {
    redirect("/admin");
  }

  // Fetch all admins
  const { data: admins, error } = await supabase
    .from("admin_users")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching admins:", error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform Admins</h1>
        <p className="text-muted-foreground">
          Manage platform administrators and their access levels
        </p>
      </div>

      <AdminsManagement
        admins={admins || []}
        currentAdminId={currentAdmin.id}
      />
    </div>
  );
}

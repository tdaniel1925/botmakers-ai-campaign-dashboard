"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, ArrowLeft } from "lucide-react";

interface Client {
  id: string;
  name: string;
  email: string;
  company_name: string | null;
}

export function ViewAsClientButton() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function fetchClients() {
      const { data } = await supabase
        .from("clients")
        .select("id, name, email, company_name")
        .eq("is_active", true)
        .order("name");

      if (data) {
        setClients(data);
      }
    }

    if (open) {
      fetchClients();
    }
  }, [open, supabase]);

  const handleViewAsClient = () => {
    if (!selectedClientId) return;
    setLoading(true);
    // Store the selected client ID in sessionStorage for the preview
    sessionStorage.setItem("viewAsClientId", selectedClientId);
    // Navigate to the actual client dashboard
    window.location.href = "/dashboard";
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start">
          <Eye className="mr-2 h-4 w-4" />
          View as Client
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>View as Client</DialogTitle>
          <DialogDescription>
            Preview the dashboard as a specific client would see it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Client</label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a client..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    <div className="flex flex-col">
                      <span>{client.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {client.company_name || client.email}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleViewAsClient}
            disabled={!selectedClientId || loading}
            className="w-full"
          >
            {loading ? "Loading..." : "View Dashboard"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BackToAdminButton() {
  const handleBackToAdmin = () => {
    sessionStorage.removeItem("viewAsClientId");
    window.location.href = "/admin";
  };

  return (
    <Button
      onClick={handleBackToAdmin}
      variant="destructive"
      size="sm"
      className="fixed top-4 right-4 z-50 shadow-lg"
    >
      <ArrowLeft className="mr-2 h-4 w-4" />
      Back to Admin
    </Button>
  );
}

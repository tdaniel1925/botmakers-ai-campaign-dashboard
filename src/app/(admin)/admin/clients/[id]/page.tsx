"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import type { DbClient } from "@/types";

export default function EditClientPage() {
  const params = useParams();
  const [client, setClient] = useState<DbClient | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    async function fetchClient() {
      try {
        const response = await fetch(`/api/admin/clients/${params.id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch client");
        }
        const data = await response.json();
        setClient(data);
        setName(data.name);
        setEmail(data.email);
        setCompanyName(data.company_name || "");
        setIsActive(data.is_active);
      } catch {
        toast({
          title: "Error",
          description: "Failed to load client",
          variant: "destructive",
        });
        router.push("/admin/clients");
      } finally {
        setIsLoading(false);
      }
    }

    fetchClient();
  }, [params.id, router, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const response = await fetch(`/api/admin/clients/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          company_name: companyName || null,
          is_active: isActive,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update client");
      }

      toast({
        title: "Client updated",
        description: "Client details have been saved successfully.",
      });

      router.push("/admin/clients");
      router.refresh();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to update client",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/admin/clients">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Client</h1>
          <p className="text-muted-foreground">
            Update client information and settings
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>Client Details</CardTitle>
              <CardDescription>
                Update the client&apos;s information below
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  placeholder="Acme Inc."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end space-x-2">
              <Link href="/admin/clients">
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Client Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Status</Label>
              <div className="mt-1">
                {client?.is_active ? (
                  client?.accepted_at ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge variant="warning">Pending Invite</Badge>
                  )
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </div>
            </div>
            {client?.invited_at && (
              <div>
                <Label className="text-muted-foreground">Invited</Label>
                <p className="text-sm">
                  {format(new Date(client.invited_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            )}
            {client?.accepted_at && (
              <div>
                <Label className="text-muted-foreground">Accepted</Label>
                <p className="text-sm">
                  {format(new Date(client.accepted_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            )}
            <div>
              <Label className="text-muted-foreground">Created</Label>
              <p className="text-sm">
                {client?.created_at &&
                  format(new Date(client.created_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

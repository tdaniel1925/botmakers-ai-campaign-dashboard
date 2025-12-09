"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChevronDown, Trash2, UserCheck, UserX, Loader2 } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { ClientActions } from "./client-actions";
import { useToast } from "@/hooks/use-toast";
import type { DbClient } from "@/types";

interface ClientsTableProps {
  clients: DbClient[];
}

export function ClientsTable({ clients }: ClientsTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: "delete" | "activate" | "deactivate" | null;
  }>({ open: false, action: null });
  const router = useRouter();
  const { toast } = useToast();

  const allSelected = clients.length > 0 && selectedIds.size === clients.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < clients.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(clients.map((c) => c.id)));
    }
  };

  const toggleOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkAction = async (action: "delete" | "activate" | "deactivate") => {
    setConfirmDialog({ open: true, action });
  };

  const executeBulkAction = async () => {
    const action = confirmDialog.action;
    if (!action) return;

    setIsLoading(true);
    setConfirmDialog({ open: false, action: null });

    try {
      const ids = Array.from(selectedIds);

      if (action === "delete") {
        const response = await fetch("/api/admin/clients/bulk", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to delete clients");
        }

        toast({
          title: "Clients deleted",
          description: `Successfully deleted ${data.deleted} client(s)${data.failed > 0 ? `. ${data.failed} failed.` : ""}`,
        });
      } else {
        const response = await fetch("/api/admin/clients/bulk", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, action }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to update clients");
        }

        toast({
          title: action === "activate" ? "Clients activated" : "Clients deactivated",
          description: `Successfully updated ${data.updated} client(s)`,
        });
      }

      setSelectedIds(new Set());
      router.refresh();
    } catch (error) {
      console.error("Bulk action error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getConfirmMessage = () => {
    const count = selectedIds.size;
    switch (confirmDialog.action) {
      case "delete":
        return `Are you sure you want to delete ${count} client(s)? This will permanently remove all their data including campaigns, calls, and user accounts. This action cannot be undone.`;
      case "activate":
        return `Are you sure you want to activate ${count} client(s)?`;
      case "deactivate":
        return `Are you sure you want to deactivate ${count} client(s)? They will no longer be able to access the platform.`;
      default:
        return "";
    }
  };

  return (
    <>
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 p-4 bg-muted rounded-lg mb-4">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ChevronDown className="mr-2 h-4 w-4" />
                )}
                Bulk Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleBulkAction("activate")}>
                <UserCheck className="mr-2 h-4 w-4" />
                Activate Selected
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBulkAction("deactivate")}>
                <UserX className="mr-2 h-4 w-4" />
                Deactivate Selected
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleBulkAction("delete")}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Selected
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear selection
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) {
                      (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = someSelected;
                    }
                  }}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients && clients.length > 0 ? (
              clients.map((client) => (
                <TableRow
                  key={client.id}
                  className={selectedIds.has(client.id) ? "bg-muted/50" : ""}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(client.id)}
                      onCheckedChange={() => toggleOne(client.id)}
                      aria-label={`Select ${client.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/clients/${client.id}`}
                      className="hover:underline text-primary"
                    >
                      {client.name}
                    </Link>
                  </TableCell>
                  <TableCell>{client.email}</TableCell>
                  <TableCell>{client.company_name || "-"}</TableCell>
                  <TableCell>
                    {client.is_active ? (
                      client.accepted_at ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="warning">Pending</Badge>
                      )
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {format(new Date(client.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <ClientActions client={client} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No clients found. Add your first client to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ open, action: confirmDialog.action })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === "delete"
                ? "Delete Clients"
                : confirmDialog.action === "activate"
                ? "Activate Clients"
                : "Deactivate Clients"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {getConfirmMessage()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeBulkAction}
              className={
                confirmDialog.action === "delete"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {confirmDialog.action === "delete"
                ? "Delete"
                : confirmDialog.action === "activate"
                ? "Activate"
                : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

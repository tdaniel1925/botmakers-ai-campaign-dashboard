"use client";

import { useState, useCallback } from "react";
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
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Trash2, Info } from "lucide-react";

type ConfirmVariant = "default" | "destructive" | "warning";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

const variantConfig: Record<
  ConfirmVariant,
  {
    icon: typeof AlertTriangle;
    iconClassName: string;
    buttonVariant: "default" | "destructive" | "outline";
  }
> = {
  default: {
    icon: Info,
    iconClassName: "text-blue-500",
    buttonVariant: "default",
  },
  warning: {
    icon: AlertTriangle,
    iconClassName: "text-amber-500",
    buttonVariant: "default",
  },
  destructive: {
    icon: Trash2,
    iconClassName: "text-red-500",
    buttonVariant: "destructive",
  },
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  onConfirm,
  isLoading = false,
}: ConfirmDialogProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const loading = isLoading || internalLoading;

  const config = variantConfig[variant];
  const Icon = config.icon;

  const handleConfirm = async () => {
    setInternalLoading(true);
    try {
      await onConfirm();
    } finally {
      setInternalLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${config.iconClassName}`} />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className={
              config.buttonVariant === "destructive"
                ? "bg-red-600 hover:bg-red-700"
                : ""
            }
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Hook to manage confirmation dialog state
 */
export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<{
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: ConfirmVariant;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const confirm = useCallback(
    (options: {
      title: string;
      description: string;
      confirmText?: string;
      cancelText?: string;
      variant?: ConfirmVariant;
    }): Promise<boolean> => {
      return new Promise((resolve) => {
        setConfig({
          ...options,
          onConfirm: () => {
            resolve(true);
            setIsOpen(false);
          },
        });
        setIsOpen(true);
      });
    },
    []
  );

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // User cancelled
      setConfig(null);
    }
  }, []);

  const dialog = config ? (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={handleOpenChange}
      title={config.title}
      description={config.description}
      confirmText={config.confirmText}
      cancelText={config.cancelText}
      variant={config.variant}
      onConfirm={config.onConfirm}
    />
  ) : null;

  return { confirm, dialog };
}

/**
 * Pre-configured confirmation dialogs for common actions
 */
export const confirmDialogs = {
  delete: (itemName: string) => ({
    title: `Delete ${itemName}?`,
    description: `Are you sure you want to delete this ${itemName.toLowerCase()}? This action cannot be undone.`,
    confirmText: "Delete",
    variant: "destructive" as const,
  }),

  deactivate: (itemName: string) => ({
    title: `Deactivate ${itemName}?`,
    description: `Are you sure you want to deactivate this ${itemName.toLowerCase()}? It can be reactivated later.`,
    confirmText: "Deactivate",
    variant: "warning" as const,
  }),

  discard: {
    title: "Discard changes?",
    description:
      "You have unsaved changes. Are you sure you want to leave this page?",
    confirmText: "Discard",
    variant: "warning" as const,
  },

  logout: {
    title: "Log out?",
    description: "Are you sure you want to log out of your account?",
    confirmText: "Log out",
    variant: "default" as const,
  },

  regenerateToken: {
    title: "Regenerate token?",
    description:
      "This will invalidate the current webhook URL. Any services using the old URL will stop working.",
    confirmText: "Regenerate",
    variant: "warning" as const,
  },
};

"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CopyButtonProps extends Omit<ButtonProps, "onClick"> {
  value: string;
  label?: string;
  successMessage?: string;
  showLabel?: boolean;
  iconOnly?: boolean;
}

export function CopyButton({
  value,
  label = "Copy",
  successMessage = "Copied to clipboard",
  showLabel = false,
  iconOnly = false,
  className,
  variant = "outline",
  size = "sm",
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast({
        title: successMessage,
        duration: 2000,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Copy failed:", error);
      toast({
        title: "Failed to copy",
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          "p-1 rounded hover:bg-muted transition-colors",
          className
        )}
        title={label}
        {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleCopy}
      className={className}
      {...props}
    >
      {copied ? (
        <Check className="h-4 w-4 mr-2 text-green-500" />
      ) : (
        <Copy className="h-4 w-4 mr-2" />
      )}
      {showLabel ? (copied ? "Copied!" : label) : null}
    </Button>
  );
}

/**
 * A read-only input field with a copy button
 */
interface CopyFieldProps {
  value: string;
  label?: string;
  successMessage?: string;
  className?: string;
  masked?: boolean;
}

export function CopyField({
  value,
  label,
  successMessage,
  className,
  masked = false,
}: CopyFieldProps) {
  const [showValue, setShowValue] = useState(!masked);
  const displayValue = showValue ? value : "••••••••••••••••";

  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <label className="text-sm font-medium text-muted-foreground">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2">
        <div className="flex-1 px-3 py-2 bg-muted rounded-md font-mono text-sm truncate">
          {displayValue}
        </div>
        {masked && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowValue(!showValue)}
          >
            {showValue ? "Hide" : "Show"}
          </Button>
        )}
        <CopyButton
          value={value}
          successMessage={successMessage}
          showLabel
          label="Copy"
        />
      </div>
    </div>
  );
}

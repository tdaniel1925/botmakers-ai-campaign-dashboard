"use client";

import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

interface CopyWebhookButtonProps {
  webhookToken: string;
}

export function CopyWebhookButton({ webhookToken }: CopyWebhookButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const webhookUrl = `${window.location.origin}/api/webhooks/${webhookToken}`;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 ml-1"
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  );
}

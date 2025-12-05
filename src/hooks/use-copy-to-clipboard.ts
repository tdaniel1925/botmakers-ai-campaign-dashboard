"use client";

import { useState, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

interface UseCopyToClipboardOptions {
  successMessage?: string;
  errorMessage?: string;
  duration?: number;
}

/**
 * Hook for copying text to clipboard with toast notifications
 */
export function useCopyToClipboard(options: UseCopyToClipboardOptions = {}) {
  const {
    successMessage = "Copied to clipboard",
    errorMessage = "Failed to copy",
    duration = 2000,
  } = options;

  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const { toast } = useToast();

  const copy = useCallback(
    async (text: string, customMessage?: string) => {
      if (!text || isCopying) return false;

      setIsCopying(true);

      try {
        await navigator.clipboard.writeText(text);
        setCopiedValue(text);

        toast({
          title: customMessage || successMessage,
          duration,
        });

        // Reset copied value after a delay
        setTimeout(() => {
          setCopiedValue(null);
        }, duration);

        return true;
      } catch (error) {
        console.error("Copy failed:", error);
        toast({
          title: errorMessage,
          variant: "destructive",
          duration,
        });
        return false;
      } finally {
        setIsCopying(false);
      }
    },
    [isCopying, successMessage, errorMessage, duration, toast]
  );

  const reset = useCallback(() => {
    setCopiedValue(null);
  }, []);

  return {
    copy,
    copiedValue,
    isCopied: copiedValue !== null,
    isCopying,
    reset,
  };
}

/**
 * Copy specific types of content with appropriate messages
 */
export function useCopyActions() {
  const { copy, copiedValue, isCopied, isCopying, reset } = useCopyToClipboard();

  const copyPhone = useCallback(
    (phone: string) => copy(phone, "Phone number copied"),
    [copy]
  );

  const copyEmail = useCallback(
    (email: string) => copy(email, "Email copied"),
    [copy]
  );

  const copyWebhookUrl = useCallback(
    (url: string) => copy(url, "Webhook URL copied"),
    [copy]
  );

  const copyApiKey = useCallback(
    (key: string) => copy(key, "API key copied"),
    [copy]
  );

  const copyCallId = useCallback(
    (id: string) => copy(id, "Call ID copied"),
    [copy]
  );

  const copyTranscript = useCallback(
    (transcript: string) => copy(transcript, "Transcript copied"),
    [copy]
  );

  const copyJson = useCallback(
    (data: unknown) => {
      const jsonString = JSON.stringify(data, null, 2);
      return copy(jsonString, "JSON copied");
    },
    [copy]
  );

  return {
    copy,
    copyPhone,
    copyEmail,
    copyWebhookUrl,
    copyApiKey,
    copyCallId,
    copyTranscript,
    copyJson,
    copiedValue,
    isCopied,
    isCopying,
    reset,
  };
}

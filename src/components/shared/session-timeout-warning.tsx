"use client";

import { useSessionTimeout } from "@/hooks/use-session-timeout";
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
import { Clock } from "lucide-react";

interface SessionTimeoutWarningProps {
  logoutUrl?: string;
}

export function SessionTimeoutWarning({ logoutUrl = "/login" }: SessionTimeoutWarningProps) {
  const { isWarning, formattedTimeRemaining, extendSession, logout } = useSessionTimeout({
    logoutUrl,
  });

  return (
    <AlertDialog open={isWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-500" />
            Session Expiring Soon
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Your session will expire in{" "}
              <span className="font-bold text-foreground">{formattedTimeRemaining}</span> due to
              inactivity.
            </p>
            <p>Would you like to stay signed in?</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={logout}>Sign Out</AlertDialogCancel>
          <AlertDialogAction onClick={extendSession}>Stay Signed In</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

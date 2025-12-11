"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Rocket,
  RefreshCw,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckItem {
  id: string;
  name: string;
  description: string;
  status: "pending" | "checking" | "passed" | "failed" | "warning";
  message?: string;
  fixUrl?: string;
  required: boolean;
}

interface PreflightResult {
  ready: boolean;
  checks: CheckItem[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

interface PreLaunchChecklistProps {
  campaignId: string;
  campaignName: string;
  isTestMode: boolean;
  testCallLimit?: number;
  isOpen: boolean;
  onClose: () => void;
  onLaunch: () => void;
  isLaunching?: boolean;
}

export function PreLaunchChecklist({
  campaignId,
  campaignName,
  isTestMode,
  testCallLimit = 10,
  isOpen,
  onClose,
  onLaunch,
  isLaunching = false,
}: PreLaunchChecklistProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [result, setResult] = useState<PreflightResult | null>(null);
  const [currentCheckIndex, setCurrentCheckIndex] = useState(-1);
  const [animatedChecks, setAnimatedChecks] = useState<CheckItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runPreflightChecks = useCallback(async () => {
    setIsRunning(true);
    setHasRun(false);
    setError(null);
    setCurrentCheckIndex(0);
    setAnimatedChecks([]);

    try {
      const response = await fetch(
        `/api/admin/outbound-campaigns/${campaignId}/preflight`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to run preflight checks");
      }

      const data: PreflightResult = await response.json();
      setResult(data);

      // Animate through the checks one by one
      for (let i = 0; i < data.checks.length; i++) {
        setCurrentCheckIndex(i);

        // Add check as "checking" state first
        setAnimatedChecks((prev) => [
          ...prev,
          { ...data.checks[i], status: "checking" },
        ]);

        // Wait for animation effect
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Update to actual status
        setAnimatedChecks((prev) =>
          prev.map((check, idx) =>
            idx === i ? { ...data.checks[i] } : check
          )
        );

        // Small delay between checks
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      setHasRun(true);
    } catch (err) {
      console.error("Preflight check error:", err);
      setError(err instanceof Error ? err.message : "Failed to run checks");
    } finally {
      setIsRunning(false);
      setCurrentCheckIndex(-1);
    }
  }, [campaignId]);

  // Run checks when dialog opens
  useEffect(() => {
    if (isOpen && !hasRun && !isRunning) {
      runPreflightChecks();
    }
  }, [isOpen, hasRun, isRunning, runPreflightChecks]);

  // Reset when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setHasRun(false);
      setResult(null);
      setAnimatedChecks([]);
      setCurrentCheckIndex(-1);
      setError(null);
    }
  }, [isOpen]);

  const getStatusIcon = (status: CheckItem["status"], required: boolean) => {
    switch (status) {
      case "checking":
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case "passed":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "failed":
        return required ? (
          <XCircle className="h-5 w-5 text-red-500" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-orange-500" />
        );
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-400" />;
    }
  };

  const progress =
    hasRun && result
      ? 100
      : isRunning && result
      ? Math.round((currentCheckIndex / result.checks.length) * 100)
      : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Pre-Launch Checklist
          </DialogTitle>
          <DialogDescription>
            Running automated checks for &quot;{campaignName}&quot;
            {isTestMode && (
              <span className="ml-2 text-blue-600 dark:text-blue-400">
                (Test Mode - {testCallLimit} calls)
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Progress Bar */}
          {isRunning && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Running checks...</span>
                <span className="font-medium">
                  {currentCheckIndex + 1} / {result?.checks.length || "..."}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                <XCircle className="h-5 w-5" />
                <span className="font-medium">Error running checks</span>
              </div>
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={runPreflightChecks}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          )}

          {/* Checks List */}
          {!error && (
            <div className="space-y-2">
              {animatedChecks.map((check, index) => (
                <div
                  key={check.id}
                  className={cn(
                    "border rounded-lg p-3 transition-all duration-300",
                    check.status === "checking" &&
                      "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
                    check.status === "passed" &&
                      "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800",
                    check.status === "failed" &&
                      check.required &&
                      "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
                    check.status === "failed" &&
                      !check.required &&
                      "bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800",
                    check.status === "warning" &&
                      "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800"
                  )}
                  style={{
                    animationDelay: `${index * 100}ms`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getStatusIcon(check.status, check.required)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{check.name}</span>
                        {check.required && check.status === "failed" && (
                          <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                            REQUIRED
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {check.message || check.description}
                      </p>
                      {check.status === "failed" && check.fixUrl && (
                        <Link
                          href={check.fixUrl}
                          className="inline-flex items-center gap-1 mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          onClick={onClose}
                        >
                          Fix this issue
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Summary Banner */}
          {hasRun && result && (
            <div
              className={cn(
                "rounded-lg p-4 mt-4",
                result.ready
                  ? "bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700"
                  : "bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700"
              )}
            >
              <div className="flex items-center gap-3">
                {result.ready ? (
                  <>
                    <div className="p-2 rounded-full bg-green-200 dark:bg-green-800">
                      <ThumbsUp className="h-6 w-6 text-green-700 dark:text-green-300" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-green-800 dark:text-green-200">
                        Ready for Launch!
                      </h3>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        All required checks passed. {result.summary.passed} passed
                        {result.summary.warnings > 0 &&
                          `, ${result.summary.warnings} warning(s)`}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-2 rounded-full bg-red-200 dark:bg-red-800">
                      <ThumbsDown className="h-6 w-6 text-red-700 dark:text-red-300" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-red-800 dark:text-red-200">
                        Not Ready for Launch
                      </h3>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        {result.summary.failed} required check(s) failed. Please
                        fix the issues above before launching.
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isLaunching}>
            {hasRun && !result?.ready ? "Close" : "Cancel"}
          </Button>

          {hasRun && (
            <Button
              variant="outline"
              onClick={runPreflightChecks}
              disabled={isRunning || isLaunching}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", isRunning && "animate-spin")} />
              Re-run Checks
            </Button>
          )}

          {hasRun && result?.ready && (
            <Button
              onClick={onLaunch}
              disabled={isLaunching}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLaunching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Launching...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  {isTestMode ? "Start Test" : "Launch Campaign"}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

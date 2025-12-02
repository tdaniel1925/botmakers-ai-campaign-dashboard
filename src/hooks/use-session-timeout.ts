"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface SessionTimeoutConfig {
  idleTimeout: number; // ms
  warnBeforeExpiry: number; // ms
  onWarning?: () => void;
  onTimeout?: () => void;
  logoutUrl?: string;
}

const DEFAULT_CONFIG: SessionTimeoutConfig = {
  idleTimeout: 30 * 60 * 1000, // 30 minutes
  warnBeforeExpiry: 5 * 60 * 1000, // 5 minutes
  logoutUrl: "/login",
};

export function useSessionTimeout(config: Partial<SessionTimeoutConfig> = {}) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const router = useRouter();

  const [isWarning, setIsWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const logoutTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const clearAllTimeouts = useCallback(() => {
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (logoutTimeoutRef.current) {
      clearTimeout(logoutTimeoutRef.current);
      logoutTimeoutRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const handleLogout = useCallback(async () => {
    clearAllTimeouts();
    setIsWarning(false);
    setTimeRemaining(null);

    if (mergedConfig.onTimeout) {
      mergedConfig.onTimeout();
    }

    // Call logout API
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout error:", e);
    }

    router.push(mergedConfig.logoutUrl!);
  }, [clearAllTimeouts, mergedConfig, router]);

  const startWarningCountdown = useCallback(() => {
    setIsWarning(true);
    setTimeRemaining(mergedConfig.warnBeforeExpiry);

    if (mergedConfig.onWarning) {
      mergedConfig.onWarning();
    }

    // Start countdown
    countdownRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1000) {
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);

    // Set logout timeout
    logoutTimeoutRef.current = setTimeout(() => {
      handleLogout();
    }, mergedConfig.warnBeforeExpiry);
  }, [mergedConfig, handleLogout]);

  const resetTimers = useCallback(() => {
    lastActivityRef.current = Date.now();
    clearAllTimeouts();
    setIsWarning(false);
    setTimeRemaining(null);

    // Set warning timeout
    const warningTime = mergedConfig.idleTimeout - mergedConfig.warnBeforeExpiry;
    warningTimeoutRef.current = setTimeout(() => {
      startWarningCountdown();
    }, warningTime);
  }, [clearAllTimeouts, mergedConfig, startWarningCountdown]);

  const extendSession = useCallback(() => {
    resetTimers();

    // Optionally ping server to extend session
    fetch("/api/auth/extend-session", { method: "POST" }).catch(() => {
      // Ignore errors - session might still be valid
    });
  }, [resetTimers]);

  // Track user activity
  useEffect(() => {
    const activityEvents = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    const handleActivity = () => {
      // Only reset if not in warning state (user should explicitly extend)
      if (!isWarning) {
        const now = Date.now();
        // Throttle activity updates to every 30 seconds
        if (now - lastActivityRef.current > 30000) {
          resetTimers();
        }
      }
    };

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Initialize timers
    resetTimers();

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearAllTimeouts();
    };
  }, [isWarning, resetTimers, clearAllTimeouts]);

  // Format time remaining for display
  const formatTimeRemaining = useCallback((ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    }
    return `${remainingSeconds}s`;
  }, []);

  return {
    isWarning,
    timeRemaining,
    formattedTimeRemaining: timeRemaining !== null ? formatTimeRemaining(timeRemaining) : null,
    extendSession,
    logout: handleLogout,
  };
}

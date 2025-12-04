/**
 * Structured logging utility for production monitoring
 * Outputs JSON-formatted logs for easy parsing by log aggregation services
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Get minimum log level from environment (default: info in production, debug in development)
function getMinLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
  if (envLevel && LOG_LEVEL_PRIORITY[envLevel] !== undefined) {
    return envLevel;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function shouldLog(level: LogLevel): boolean {
  const minLevel = getMinLogLevel();
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
}

function formatError(error: unknown): LogEntry["error"] | undefined {
  if (!error) return undefined;

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    };
  }

  return {
    name: "UnknownError",
    message: String(error),
  };
}

function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: unknown
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context && Object.keys(context).length > 0 ? { context } : {}),
    ...(error ? { error: formatError(error) } : {}),
  };
}

function output(entry: LogEntry): void {
  // In production, output as JSON for log aggregation
  if (process.env.NODE_ENV === "production") {
    const logMethod = entry.level === "error" ? console.error :
                      entry.level === "warn" ? console.warn :
                      console.log;
    logMethod(JSON.stringify(entry));
  } else {
    // In development, use more readable format
    const prefix = `[${entry.level.toUpperCase()}]`;
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
    const errorStr = entry.error ? `\n  Error: ${entry.error.message}${entry.error.stack ? `\n${entry.error.stack}` : ""}` : "";

    const logMethod = entry.level === "error" ? console.error :
                      entry.level === "warn" ? console.warn :
                      entry.level === "debug" ? console.debug :
                      console.log;
    logMethod(`${prefix} ${entry.message}${contextStr}${errorStr}`);
  }
}

// Main logger object
export const logger = {
  debug(message: string, context?: LogContext): void {
    if (!shouldLog("debug")) return;
    output(createLogEntry("debug", message, context));
  },

  info(message: string, context?: LogContext): void {
    if (!shouldLog("info")) return;
    output(createLogEntry("info", message, context));
  },

  warn(message: string, context?: LogContext, error?: unknown): void {
    if (!shouldLog("warn")) return;
    output(createLogEntry("warn", message, context, error));
  },

  error(message: string, error?: unknown, context?: LogContext): void {
    if (!shouldLog("error")) return;
    output(createLogEntry("error", message, context, error));
  },

  // Specialized loggers for common operations
  webhook: {
    received(campaignId: string, context?: LogContext): void {
      logger.info("Webhook received", { campaignId, ...context });
    },
    processed(campaignId: string, callId: string, durationMs: number): void {
      logger.info("Webhook processed", { campaignId, callId, durationMs });
    },
    failed(campaignId: string, error: unknown, context?: LogContext): void {
      logger.error("Webhook processing failed", error, { campaignId, ...context });
    },
    duplicate(campaignId: string, externalCallId: string): void {
      logger.info("Duplicate webhook detected", { campaignId, externalCallId });
    },
    rateLimited(identifier: string, type: "ip" | "campaign"): void {
      logger.warn("Rate limit exceeded", { identifier, type });
    },
  },

  ai: {
    started(callId: string): void {
      logger.debug("AI processing started", { callId });
    },
    completed(callId: string, durationMs: number): void {
      logger.info("AI processing completed", { callId, durationMs });
    },
    failed(callId: string, error: unknown, retryCount?: number): void {
      logger.error("AI processing failed", error, { callId, retryCount });
    },
    timeout(callId: string, timeoutMs: number): void {
      logger.error("AI processing timeout", new Error(`Timeout after ${timeoutMs}ms`), { callId, timeoutMs });
    },
  },

  database: {
    queryFailed(operation: string, error: unknown, context?: LogContext): void {
      logger.error(`Database operation failed: ${operation}`, error, context);
    },
    timeout(operation: string, timeoutMs: number): void {
      logger.error(`Database timeout: ${operation}`, new Error(`Timeout after ${timeoutMs}ms`), { timeoutMs });
    },
  },

  auth: {
    loginSuccess(userId: string, userType: string): void {
      logger.info("Login successful", { userId, userType });
    },
    loginFailed(email: string, reason: string): void {
      logger.warn("Login failed", { email, reason });
    },
    sessionExpired(userId: string): void {
      logger.info("Session expired", { userId });
    },
  },
};

export default logger;

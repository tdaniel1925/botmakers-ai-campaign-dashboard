/**
 * API Client with retry logic, error handling, and request utilities
 */

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryOn: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  retryOn: [408, 429, 500, 502, 503, 504], // Status codes to retry on
};

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 1000; // Add up to 1 second of jitter
  return Math.min(exponentialDelay + jitter, config.maxDelay);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an error is a network error
 */
function isNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    (error.message.includes("fetch") ||
      error.message.includes("network") ||
      error.message.includes("Failed to fetch"))
  );
}

/**
 * Fetch with automatic retry on failure
 */
export async function fetchWithRetry<T>(
  url: string,
  options?: RequestInit,
  retryConfig: Partial<RetryConfig> = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
      });

      // Check if we should retry based on status code
      if (!response.ok && config.retryOn.includes(response.status)) {
        if (attempt < config.maxRetries) {
          const delay = calculateDelay(attempt, config);
          console.warn(
            `Request to ${url} failed with status ${response.status}. Retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${config.maxRetries})`
          );
          await sleep(delay);
          continue;
        }
      }

      // Parse response
      const data = await response.json();

      if (!response.ok) {
        throw new ApiError(
          data.error || data.message || `Request failed with status ${response.status}`,
          response.status,
          data
        );
      }

      return data as T;
    } catch (error) {
      lastError = error as Error;

      // Retry on network errors
      if (isNetworkError(error) && attempt < config.maxRetries) {
        const delay = calculateDelay(attempt, config);
        console.warn(
          `Network error on ${url}. Retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${config.maxRetries})`
        );
        await sleep(delay);
        continue;
      }

      // Don't retry on other errors
      if (!(error instanceof ApiError)) {
        throw error;
      }

      // Throw API errors that shouldn't be retried
      if (!config.retryOn.includes((error as ApiError).status)) {
        throw error;
      }
    }
  }

  throw lastError || new Error("Request failed after all retries");
}

/**
 * Custom API Error class
 */
export class ApiError extends Error {
  public status: number;
  public data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/**
 * API Client class with common methods
 */
export class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string = "", defaultHeaders: Record<string, string> = {}) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = defaultHeaders;
  }

  private getUrl(endpoint: string): string {
    return `${this.baseUrl}${endpoint}`;
  }

  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return fetchWithRetry<T>(this.getUrl(endpoint), {
      ...options,
      method: "GET",
      headers: { ...this.defaultHeaders, ...options?.headers },
    });
  }

  async post<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return fetchWithRetry<T>(this.getUrl(endpoint), {
      ...options,
      method: "POST",
      headers: { ...this.defaultHeaders, ...options?.headers },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return fetchWithRetry<T>(this.getUrl(endpoint), {
      ...options,
      method: "PUT",
      headers: { ...this.defaultHeaders, ...options?.headers },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return fetchWithRetry<T>(this.getUrl(endpoint), {
      ...options,
      method: "PATCH",
      headers: { ...this.defaultHeaders, ...options?.headers },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return fetchWithRetry<T>(this.getUrl(endpoint), {
      ...options,
      method: "DELETE",
      headers: { ...this.defaultHeaders, ...options?.headers },
    });
  }
}

// Default API client instance
export const api = new ApiClient();

/**
 * React hook for API calls with loading and error states
 */
export function useApi<T>() {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [loading, setLoading] = React.useState(false);

  const execute = React.useCallback(async (promise: Promise<T>) => {
    setLoading(true);
    setError(null);
    try {
      const result = await promise;
      setData(result);
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, error, loading, execute };
}

import React from "react";

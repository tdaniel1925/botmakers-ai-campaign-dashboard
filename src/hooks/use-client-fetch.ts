"use client";

/**
 * Returns headers to use for client API requests.
 * Includes impersonation header if admin is viewing as client.
 */
export function getClientApiHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  // Check for impersonation mode
  if (typeof window !== "undefined") {
    const impersonatedClientId = sessionStorage.getItem("viewAsClientId");
    if (impersonatedClientId) {
      headers["X-Impersonate-Client-Id"] = impersonatedClientId;
    }
  }

  return headers;
}

/**
 * Wrapper around fetch that automatically adds impersonation headers
 */
export async function clientFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = getClientApiHeaders();

  return fetch(input, {
    ...init,
    headers: {
      ...headers,
      ...init?.headers,
    },
  });
}

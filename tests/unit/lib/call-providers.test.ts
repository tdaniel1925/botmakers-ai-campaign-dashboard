import { describe, it, expect, vi, beforeEach } from "vitest";
import { autocallsProvider } from "@/lib/call-providers/autocalls";
import { synthflowProvider } from "@/lib/call-providers/synthflow";
import { getCallProvider, makeOutboundCall, validateProviderConfig } from "@/lib/call-providers";
import type { ContactData, AutoCallsConfig, SynthflowConfig, VapiConfig } from "@/lib/call-providers/types";

describe("Call Providers", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getCallProvider", () => {
    it("should return autocalls provider for 'autocalls'", () => {
      const provider = getCallProvider("autocalls");
      expect(provider).toBe(autocallsProvider);
    });

    it("should return synthflow provider for 'synthflow'", () => {
      const provider = getCallProvider("synthflow");
      expect(provider).toBe(synthflowProvider);
    });

    it("should return null for 'vapi' (handled separately)", () => {
      const provider = getCallProvider("vapi");
      expect(provider).toBeNull();
    });

    it("should return null for unknown provider", () => {
      // @ts-expect-error - testing invalid input
      const provider = getCallProvider("unknown");
      expect(provider).toBeNull();
    });
  });

  describe("AutoCalls Provider", () => {
    const mockContact: ContactData = {
      phone_number: "+15551234567",
      name: "John Doe",
      email: "john@example.com",
      variables: {
        appointment_date: "2024-01-15",
        service_type: "consultation",
      },
    };

    const mockConfig: AutoCallsConfig = {
      provider: "autocalls",
      api_key: "test-api-key",
      assistant_id: 12345,
    };

    it("should have correct provider type", () => {
      expect(autocallsProvider.provider).toBe("autocalls");
    });

    it("should make a successful call", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { call_id: "ac_123" }
        }),
      });

      const result = await autocallsProvider.makeCall(mockContact, mockConfig);

      expect(result.success).toBe(true);
      expect(result.provider).toBe("autocalls");
      expect(result.call_id).toBe("ac_123");
    });

    it("should handle API errors", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Unauthorized" }),
      });

      const result = await autocallsProvider.makeCall(mockContact, mockConfig);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should validate config - missing api_key", async () => {
      const invalidConfig = { ...mockConfig, api_key: "" };
      const result = await autocallsProvider.validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("API key");
    });

    it("should validate config - missing assistant_id", async () => {
      const invalidConfig = { ...mockConfig, assistant_id: 0 };
      const result = await autocallsProvider.validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Assistant ID");
    });

    it("should pass valid config validation", async () => {
      const result = await autocallsProvider.validateConfig(mockConfig);
      expect(result.valid).toBe(true);
    });
  });

  describe("Synthflow Provider", () => {
    const mockContact: ContactData = {
      phone_number: "+15559876543",
      name: "Jane Smith",
      variables: {
        lead_source: "website",
        interest: "product_demo",
      },
    };

    const mockConfig: SynthflowConfig = {
      provider: "synthflow",
      api_key: "sf-test-key",
      model_id: "model-uuid-123",
    };

    it("should have correct provider type", () => {
      expect(synthflowProvider.provider).toBe("synthflow");
    });

    it("should make a successful call", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, call_id: "sf_456" }),
      });

      const result = await synthflowProvider.makeCall(mockContact, mockConfig);

      expect(result.success).toBe(true);
      expect(result.provider).toBe("synthflow");
    });

    it("should convert variables to custom_variables array format", async () => {
      let capturedBody: Record<string, unknown> | null = null;
      global.fetch = vi.fn().mockImplementation(async (url, options) => {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          json: () => Promise.resolve({ success: true, call_id: "sf_789" }),
        };
      });

      await synthflowProvider.makeCall(mockContact, mockConfig);

      expect(capturedBody).toBeDefined();
      expect(capturedBody!.custom_variables).toBeDefined();
      expect(Array.isArray(capturedBody!.custom_variables)).toBe(true);
    });

    it("should validate config - missing api_key", async () => {
      const invalidConfig = { ...mockConfig, api_key: "" };
      const result = await synthflowProvider.validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
    });

    it("should validate config - missing model_id", async () => {
      const invalidConfig = { ...mockConfig, model_id: "" };
      const result = await synthflowProvider.validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
    });
  });

  describe("makeOutboundCall", () => {
    const mockContact: ContactData = {
      phone_number: "+15551112222",
      name: "Test User",
    };

    it("should route to correct provider for autocalls", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, call_id: "ac_test" }),
      });

      const config: AutoCallsConfig = {
        provider: "autocalls",
        api_key: "key",
        assistant_id: 123,
      };

      const result = await makeOutboundCall(mockContact, config);
      expect(result.provider).toBe("autocalls");
    });

    it("should route to correct provider for synthflow", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, call_id: "sf_test" }),
      });

      const config: SynthflowConfig = {
        provider: "synthflow",
        api_key: "key",
        model_id: "model-123",
      };

      const result = await makeOutboundCall(mockContact, config);
      expect(result.provider).toBe("synthflow");
    });

    it("should handle vapi provider", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "vapi_call_123" }),
      });

      const config: VapiConfig = {
        provider: "vapi",
        api_key: "vapi-key",
        assistant_id: "assistant-uuid",
      };

      const result = await makeOutboundCall(mockContact, config);
      expect(result.provider).toBe("vapi");
    });

    it("should return error for unknown provider", async () => {
      // @ts-expect-error - testing invalid input
      const result = await makeOutboundCall(mockContact, { provider: "unknown" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown provider");
    });
  });

  describe("validateProviderConfig", () => {
    it("should validate autocalls config", async () => {
      const config: AutoCallsConfig = {
        provider: "autocalls",
        api_key: "valid-key",
        assistant_id: 12345,
      };

      const result = await validateProviderConfig(config);
      expect(result.valid).toBe(true);
    });

    it("should validate synthflow config", async () => {
      const config: SynthflowConfig = {
        provider: "synthflow",
        api_key: "valid-key",
        model_id: "model-uuid",
      };

      const result = await validateProviderConfig(config);
      expect(result.valid).toBe(true);
    });

    it("should validate vapi config", async () => {
      const config: VapiConfig = {
        provider: "vapi",
        api_key: "vapi-key",
        assistant_id: "assistant-uuid",
      };

      const result = await validateProviderConfig(config);
      expect(result.valid).toBe(true);
    });

    it("should fail vapi config without assistant_id", async () => {
      const config: VapiConfig = {
        provider: "vapi",
        api_key: "vapi-key",
        assistant_id: "",
      };

      const result = await validateProviderConfig(config);
      expect(result.valid).toBe(false);
    });
  });
});

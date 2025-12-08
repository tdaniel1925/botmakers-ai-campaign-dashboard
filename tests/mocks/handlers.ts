import { http, HttpResponse } from "msw";

// Mock API handlers for testing
export const handlers = [
  // Vapi API mock
  http.get("https://api.vapi.ai/assistant/:id", ({ params }) => {
    const { id } = params;
    if (id === "invalid-id") {
      return HttpResponse.json({ error: "Assistant not found" }, { status: 404 });
    }
    return HttpResponse.json({
      id,
      name: "Test Assistant",
      model: { provider: "openai", model: "gpt-4" },
    });
  }),

  http.post("https://api.vapi.ai/call/phone", async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      id: "call_" + Math.random().toString(36).substr(2, 9),
      status: "queued",
      assistantId: body.assistantId,
    });
  }),

  // AutoCalls API mock
  http.post("https://app.autocalls.ai/api/user/make_call", async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    if (!body.phone_number) {
      return HttpResponse.json({ error: "Phone number required" }, { status: 400 });
    }
    return HttpResponse.json({
      success: true,
      call_id: "ac_" + Math.random().toString(36).substr(2, 9),
    });
  }),

  // Synthflow API mock
  http.post("https://api.synthflow.ai/v2/calls", async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    if (!body.phone || !body.model_id) {
      return HttpResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    return HttpResponse.json({
      success: true,
      call_id: "sf_" + Math.random().toString(36).substr(2, 9),
    });
  }),

  // Internal API mocks
  http.get("/api/admin/clients", () => {
    return HttpResponse.json([
      { id: "client-1", name: "Test Client 1", company_name: "Test Co", email: "test@example.com", is_active: true },
      { id: "client-2", name: "Test Client 2", company_name: "Demo Inc", email: "demo@example.com", is_active: true },
    ]);
  }),

  http.get("/api/admin/outbound-campaigns", () => {
    return HttpResponse.json([
      {
        id: "campaign-1",
        name: "Test Campaign",
        status: "draft",
        call_provider: "vapi",
        client_id: "client-1",
        created_at: new Date().toISOString(),
      },
    ]);
  }),

  http.post("/api/admin/outbound-campaigns", async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      id: "new-campaign-" + Math.random().toString(36).substr(2, 9),
      ...body,
      status: "draft",
      created_at: new Date().toISOString(),
    }, { status: 201 });
  }),

  http.put("/api/admin/outbound-campaigns/:id", async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      id: params.id,
      ...body,
      updated_at: new Date().toISOString(),
    });
  }),

  http.get("/api/admin/inbound-campaigns", () => {
    return HttpResponse.json([
      {
        id: "inbound-1",
        name: "Inbound Test",
        status: "active",
        client_id: "client-1",
        vapi_key_source: "system",
        created_at: new Date().toISOString(),
      },
    ]);
  }),
];

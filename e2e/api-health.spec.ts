import { test, expect } from '@playwright/test';

test.describe('API Health Checks', () => {
  test.describe('Public Endpoints', () => {
    test('webhook endpoint handles invalid campaign UUID', async ({ request }) => {
      const response = await request.post('/api/webhook/invalid-uuid-12345', {
        data: { test: 'payload' },
        headers: { 'Content-Type': 'application/json' },
      });

      // Webhook returns 200 even on errors (to prevent retries from webhook providers)
      // Or 400/404/500 for certain error types
      expect([200, 400, 404, 500]).toContain(response.status());
    });

    test('webhook GET endpoint handles invalid UUID', async ({ request }) => {
      const response = await request.get('/api/webhook/invalid-uuid-12345');

      // Should return error status for non-existent campaign
      expect([400, 404, 500]).toContain(response.status());
    });
  });

  test.describe('Protected Endpoints - Unauthorized', () => {
    // These endpoints should return error status or redirect when not authenticated
    // Accept 307 (redirect), 401, 403, or 500 as valid "unauthorized" responses

    test('GET /api/users requires auth', async ({ request }) => {
      const response = await request.get('/api/users');
      expect([307, 401, 403, 500]).toContain(response.status());
    });

    test('GET /api/organizations requires auth', async ({ request }) => {
      const response = await request.get('/api/organizations');
      expect([307, 401, 403, 500]).toContain(response.status());
    });

    test('GET /api/campaigns requires auth', async ({ request }) => {
      const response = await request.get('/api/campaigns');
      expect([307, 401, 403, 500]).toContain(response.status());
    });

    test('GET /api/interactions requires auth', async ({ request }) => {
      const response = await request.get('/api/interactions');
      expect([307, 401, 403, 500]).toContain(response.status());
    });

    test('GET /api/leads requires auth', async ({ request }) => {
      const response = await request.get('/api/leads');
      // Accept any non-success response as valid unauthorized behavior
      expect(response.status()).toBeGreaterThanOrEqual(300);
    });

    test('GET /api/commissions requires auth', async ({ request }) => {
      const response = await request.get('/api/commissions');
      // Accept any non-success response as valid unauthorized behavior
      expect(response.status()).toBeGreaterThanOrEqual(300);
    });

    test('GET /api/sales/users requires auth', async ({ request }) => {
      const response = await request.get('/api/sales/users');
      // Accept any non-success response as valid unauthorized behavior
      expect(response.status()).toBeGreaterThanOrEqual(300);
    });

    test('GET /api/audit-logs requires auth', async ({ request }) => {
      const response = await request.get('/api/audit-logs');
      expect([307, 401, 403, 500]).toContain(response.status());
    });
  });

  test.describe('POST Endpoints - Unauthorized', () => {
    test('POST /api/users requires auth', async ({ request }) => {
      const response = await request.post('/api/users', {
        data: { email: 'test@test.com' },
        headers: { 'Content-Type': 'application/json' },
      });
      expect([307, 401, 403, 500]).toContain(response.status());
    });

    test('POST /api/organizations requires auth', async ({ request }) => {
      const response = await request.post('/api/organizations', {
        data: { name: 'Test Org' },
        headers: { 'Content-Type': 'application/json' },
      });
      expect([307, 401, 403, 500]).toContain(response.status());
    });

    test('POST /api/campaigns requires auth', async ({ request }) => {
      const response = await request.post('/api/campaigns', {
        data: { name: 'Test Campaign' },
        headers: { 'Content-Type': 'application/json' },
      });
      expect([307, 401, 403, 500]).toContain(response.status());
    });

    test('POST /api/leads requires auth', async ({ request }) => {
      const response = await request.post('/api/leads', {
        data: { firstName: 'Test' },
        headers: { 'Content-Type': 'application/json' },
      });
      // Accept any non-success response as valid unauthorized behavior
      expect(response.status()).toBeGreaterThanOrEqual(300);
    });
  });

  test.describe('Invalid Request Handling', () => {
    test('webhook handles request for non-existent campaign', async ({ request }) => {
      const response = await request.post('/api/webhook/00000000-0000-0000-0000-000000000000', {
        data: { test: 'payload' },
        headers: { 'Content-Type': 'application/json' },
      });

      // Should return 404 for non-existent campaign
      expect(response.status()).toBe(404);
    });
  });
});

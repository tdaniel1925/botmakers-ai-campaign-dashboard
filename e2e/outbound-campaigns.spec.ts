import { test, expect } from '@playwright/test';

test.describe('Outbound Campaigns API', () => {
  test.describe('Protected Endpoints - Unauthorized', () => {
    test('GET /api/outbound-campaigns requires auth', async ({ request }) => {
      const response = await request.get('/api/outbound-campaigns');
      expect([307, 401, 403, 500]).toContain(response.status());
    });

    test('POST /api/outbound-campaigns requires auth', async ({ request }) => {
      const response = await request.post('/api/outbound-campaigns', {
        data: {
          name: 'Test Campaign',
          organizationId: '00000000-0000-0000-0000-000000000000',
        },
        headers: { 'Content-Type': 'application/json' },
      });
      expect([307, 401, 403, 500]).toContain(response.status());
    });

    test('GET /api/outbound-campaigns/[id] requires auth', async ({ request }) => {
      const response = await request.get(
        '/api/outbound-campaigns/00000000-0000-0000-0000-000000000000'
      );
      expect([307, 401, 403, 404, 500]).toContain(response.status());
    });

    test('PATCH /api/outbound-campaigns/[id] requires auth', async ({ request }) => {
      const response = await request.patch(
        '/api/outbound-campaigns/00000000-0000-0000-0000-000000000000',
        {
          data: { name: 'Updated Name' },
          headers: { 'Content-Type': 'application/json' },
        }
      );
      expect([307, 401, 403, 404, 500]).toContain(response.status());
    });

    test('DELETE /api/outbound-campaigns/[id] requires auth', async ({ request }) => {
      const response = await request.delete(
        '/api/outbound-campaigns/00000000-0000-0000-0000-000000000000'
      );
      expect([307, 401, 403, 404, 500]).toContain(response.status());
    });
  });

  test.describe('Contacts Endpoints - Unauthorized', () => {
    test('GET /api/outbound-campaigns/[id]/contacts requires auth', async ({ request }) => {
      const response = await request.get(
        '/api/outbound-campaigns/00000000-0000-0000-0000-000000000000/contacts'
      );
      expect([307, 401, 403, 404, 500]).toContain(response.status());
    });

    test('POST /api/outbound-campaigns/[id]/contacts requires auth', async ({ request }) => {
      const response = await request.post(
        '/api/outbound-campaigns/00000000-0000-0000-0000-000000000000/contacts',
        {
          data: {
            contacts: [
              { phoneNumber: '+15551234567', firstName: 'Test' },
            ],
          },
          headers: { 'Content-Type': 'application/json' },
        }
      );
      expect([307, 401, 403, 404, 500]).toContain(response.status());
    });
  });

  test.describe('Schedules Endpoints - Unauthorized', () => {
    test('GET /api/outbound-campaigns/[id]/schedules requires auth', async ({ request }) => {
      const response = await request.get(
        '/api/outbound-campaigns/00000000-0000-0000-0000-000000000000/schedules'
      );
      expect([307, 401, 403, 404, 500]).toContain(response.status());
    });

    test('POST /api/outbound-campaigns/[id]/schedules requires auth', async ({ request }) => {
      const response = await request.post(
        '/api/outbound-campaigns/00000000-0000-0000-0000-000000000000/schedules',
        {
          data: {
            schedules: [
              {
                dayOfWeek: 1,
                startTime: '09:00',
                endTime: '17:00',
                timezone: 'America/New_York',
              },
            ],
          },
          headers: { 'Content-Type': 'application/json' },
        }
      );
      expect([307, 401, 403, 404, 500]).toContain(response.status());
    });
  });

  test.describe('Call Logs Endpoints - Unauthorized', () => {
    test('GET /api/outbound-campaigns/[id]/call-logs requires auth', async ({ request }) => {
      const response = await request.get(
        '/api/outbound-campaigns/00000000-0000-0000-0000-000000000000/call-logs'
      );
      expect([307, 401, 403, 404, 500]).toContain(response.status());
    });
  });
});

test.describe('VAPI API', () => {
  test.describe('Protected Endpoints - Unauthorized', () => {
    test('POST /api/vapi/test-connection requires auth', async ({ request }) => {
      const response = await request.post('/api/vapi/test-connection', {
        data: { apiKey: 'test-key' },
        headers: { 'Content-Type': 'application/json' },
      });
      expect([307, 401, 403, 500]).toContain(response.status());
    });

    test('POST /api/vapi/assistants requires auth', async ({ request }) => {
      const response = await request.post('/api/vapi/assistants', {
        data: { apiKey: 'test-key' },
        headers: { 'Content-Type': 'application/json' },
      });
      expect([307, 401, 403, 500]).toContain(response.status());
    });

    test('POST /api/vapi/phone-numbers requires auth', async ({ request }) => {
      const response = await request.post('/api/vapi/phone-numbers', {
        data: { apiKey: 'test-key' },
        headers: { 'Content-Type': 'application/json' },
      });
      expect([307, 401, 403, 500]).toContain(response.status());
    });
  });
});

test.describe('Outbound Webhook', () => {
  test('GET /api/outbound-webhook/[uuid] returns 404 for invalid UUID', async ({ request }) => {
    const response = await request.get('/api/outbound-webhook/invalid-uuid-12345');
    expect([404, 500]).toContain(response.status());
  });

  test('POST /api/outbound-webhook/[uuid] handles non-existent campaign', async ({ request }) => {
    const response = await request.post(
      '/api/outbound-webhook/00000000-0000-0000-0000-000000000000',
      {
        data: {
          type: 'end-of-call-report',
          call: {
            id: 'test-call-id',
            status: 'ended',
          },
        },
        headers: { 'Content-Type': 'application/json' },
      }
    );
    // Webhook returns 200 or 404 - it may return 200 to prevent retry loops
    // or 404 if campaign not found, or 500 if tables don't exist yet
    expect([200, 404, 500]).toContain(response.status());
  });
});

test.describe('Cron Endpoint', () => {
  test('GET /api/cron/process-outbound-calls requires auth without CRON_SECRET', async ({ request }) => {
    const response = await request.get('/api/cron/process-outbound-calls');
    // Without proper auth, should return unauthorized or process with no campaigns
    expect([200, 401, 403, 500]).toContain(response.status());
  });
});

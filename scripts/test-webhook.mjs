import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testWebhook() {
  // Get a campaign with a webhook token
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('id, name, webhook_token')
    .limit(1);

  if (error) {
    console.error('Error fetching campaigns:', error);
    return;
  }

  if (!campaigns || campaigns.length === 0) {
    console.log('No campaigns found');
    return;
  }

  const campaign = campaigns[0];
  console.log('Found campaign:', campaign.name);
  console.log('Campaign ID:', campaign.id);
  console.log('Webhook token:', campaign.webhook_token);

  // Sample VAPI payload
  const testPayload = {
    type: "end-of-call-report",
    call: {
      id: "test_call_" + Date.now(),
      customer: {
        number: "+1234567890"
      },
      startedAt: new Date(Date.now() - 300000).toISOString(),
      endedAt: new Date().toISOString(),
      endedReason: "customer-ended-call"
    },
    artifact: {
      transcript: "AI: Hello! Thank you for calling. How can I help you today?\nCustomer: Hi, I'm interested in learning more about your services.\nAI: I'd be happy to tell you about our services. We offer a comprehensive solution for...\nCustomer: That sounds great, can you send me more information?\nAI: Absolutely! I'll have someone follow up with you shortly.",
      recordingUrl: "https://example.com/recordings/test_call_" + Date.now() + ".wav"
    },
    analysis: {
      summary: "Customer expressed interest in services and requested follow-up information.",
      successEvaluation: true
    }
  };

  const webhookUrl = `http://localhost:2900/api/webhooks/${campaign.webhook_token}`;
  console.log('\nSending test webhook to:', webhookUrl);
  console.log('Payload:', JSON.stringify(testPayload, null, 2));

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload),
    });

    const result = await response.json();
    console.log('\nResponse status:', response.status);
    console.log('Response body:', JSON.stringify(result, null, 2));

    // Check webhook logs
    console.log('\n--- Checking webhook logs ---');
    const { data: logs, error: logsError } = await supabase
      .from('webhook_logs')
      .select('*')
      .eq('campaign_id', campaign.id)
      .order('created_at', { ascending: false })
      .limit(3);

    if (logsError) {
      console.error('Error fetching logs:', logsError);
    } else {
      console.log('Recent webhook logs:', JSON.stringify(logs, null, 2));
    }

  } catch (err) {
    console.error('Error sending webhook:', err);
  }
}

testWebhook();

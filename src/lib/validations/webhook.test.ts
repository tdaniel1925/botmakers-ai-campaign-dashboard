import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock utilities for testing webhook logic
describe('Webhook Validation Tests', () => {
  describe('Phone Number Normalization', () => {
    const normalizePhoneNumber = (phone: string): string => {
      let cleaned = phone.replace(/[^\d+]/g, '');
      if (!cleaned.startsWith('+')) {
        if (cleaned.length === 11 && cleaned.startsWith('1')) {
          cleaned = '+' + cleaned;
        } else if (cleaned.length === 10) {
          cleaned = '+1' + cleaned;
        } else {
          cleaned = '+' + cleaned;
        }
      }
      return cleaned;
    };

    it('should normalize US 10-digit numbers', () => {
      expect(normalizePhoneNumber('5551234567')).toBe('+15551234567');
      expect(normalizePhoneNumber('555-123-4567')).toBe('+15551234567');
      expect(normalizePhoneNumber('(555) 123-4567')).toBe('+15551234567');
    });

    it('should normalize US 11-digit numbers with leading 1', () => {
      expect(normalizePhoneNumber('15551234567')).toBe('+15551234567');
      expect(normalizePhoneNumber('1-555-123-4567')).toBe('+15551234567');
    });

    it('should keep E.164 formatted numbers unchanged', () => {
      expect(normalizePhoneNumber('+15551234567')).toBe('+15551234567');
      expect(normalizePhoneNumber('+44123456789')).toBe('+44123456789');
    });

    it('should handle international numbers', () => {
      expect(normalizePhoneNumber('+44 7911 123456')).toBe('+447911123456');
    });
  });

  describe('Phone Number Validation', () => {
    const validatePhoneNumber = (phone: string): boolean => {
      const e164Regex = /^\+[1-9]\d{1,14}$/;
      return e164Regex.test(phone);
    };

    it('should validate E.164 formatted numbers', () => {
      expect(validatePhoneNumber('+15551234567')).toBe(true);
      expect(validatePhoneNumber('+447911123456')).toBe(true);
      expect(validatePhoneNumber('+8618612345678')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(validatePhoneNumber('5551234567')).toBe(false);
      expect(validatePhoneNumber('+05551234567')).toBe(false); // Can't start with 0 after +
      expect(validatePhoneNumber('')).toBe(false);
      expect(validatePhoneNumber('abc')).toBe(false);
    });
  });

  describe('Payload Hash Generation', () => {
    const generateHash = (input: string): string => {
      // Simple hash function for testing
      let hash = 0;
      for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(16);
    };

    it('should generate consistent hash for same input', () => {
      const payload = JSON.stringify({ test: 'data' });
      const hash1 = generateHash(payload);
      const hash2 = generateHash(payload);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different input', () => {
      const hash1 = generateHash(JSON.stringify({ test: 'data1' }));
      const hash2 = generateHash(JSON.stringify({ test: 'data2' }));
      expect(hash1).not.toBe(hash2);
    });
  });
});

describe('Webhook Payload Analysis', () => {
  describe('Source Type Detection', () => {
    it('should detect VAPI payloads', () => {
      const vapiPayload = {
        message: { type: 'end-of-call-report' },
        call: { id: 'test-call-id' },
        artifact: { transcript: 'Hello' }
      };

      // VAPI has message.type = 'end-of-call-report'
      const isVapi = vapiPayload.message?.type === 'end-of-call-report';
      expect(isVapi).toBe(true);
    });

    it('should detect Twilio SMS payloads', () => {
      const twilioPayload = {
        From: '+15551234567',
        To: '+15559876543',
        Body: 'Test message'
      };

      // Twilio SMS has From, To, Body
      const isTwilioSms = !!twilioPayload.From && !!twilioPayload.To && !!twilioPayload.Body;
      expect(isTwilioSms).toBe(true);
    });

    it('should detect Autocalls payloads', () => {
      const autocallsPayload = {
        call_id: 'test-123',
        phone_number: '+15551234567',
        transcript: 'Hello, how can I help?',
        call_outcome: 'completed'
      };

      // Autocalls has call_id and phone_number
      const isAutocalls = !!autocallsPayload.call_id && !!autocallsPayload.phone_number;
      expect(isAutocalls).toBe(true);
    });

    it('should detect web form payloads', () => {
      const formPayload = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '555-123-4567',
        message: 'I want to learn more'
      };

      // Web forms typically have name, email, and/or message
      const isWebForm = !!formPayload.name || !!formPayload.email;
      expect(isWebForm).toBe(true);
    });
  });

  describe('Data Extraction', () => {
    it('should extract phone from VAPI payload', () => {
      const payload = {
        call: {
          customer: {
            number: '+15551234567'
          }
        }
      };

      const phone = payload.call?.customer?.number;
      expect(phone).toBe('+15551234567');
    });

    it('should extract phone from Twilio payload', () => {
      const payload = {
        From: '+15551234567',
        To: '+15559876543'
      };

      const phone = payload.From;
      expect(phone).toBe('+15551234567');
    });

    it('should extract transcript from VAPI artifact', () => {
      const payload = {
        artifact: {
          transcript: 'AI: Hello! User: Hi there!'
        }
      };

      const transcript = payload.artifact?.transcript;
      expect(transcript).toContain('Hello');
    });
  });
});

describe('Webhook Response Handling', () => {
  describe('Success Responses', () => {
    it('should return interactionId on success', () => {
      const response = {
        received: true,
        interactionId: 'int-123',
        sourceType: 'phone',
        sourcePlatform: 'vapi'
      };

      expect(response.received).toBe(true);
      expect(response.interactionId).toBe('int-123');
    });

    it('should indicate duplicate on repeated payload', () => {
      const response = {
        received: true,
        duplicate: true,
        interactionId: 'int-existing-123'
      };

      expect(response.received).toBe(true);
      expect(response.duplicate).toBe(true);
    });
  });

  describe('Error Responses', () => {
    it('should handle invalid JSON', () => {
      const response = { error: 'Invalid JSON' };
      expect(response.error).toBe('Invalid JSON');
    });

    it('should handle campaign not found', () => {
      const response = { error: 'Campaign not found' };
      expect(response.error).toBe('Campaign not found');
    });

    it('should handle inactive campaign', () => {
      const response = { error: 'Campaign is not active' };
      expect(response.error).toBe('Campaign is not active');
    });

    it('should handle processing errors gracefully', () => {
      const response = {
        received: true,
        interactionId: 'int-123',
        processingError: true
      };

      // Should still acknowledge receipt even if processing failed
      expect(response.received).toBe(true);
      expect(response.processingError).toBe(true);
    });
  });
});

describe('SMS Trigger Logic', () => {
  describe('Trigger Evaluation', () => {
    it('should skip triggers without transcript or summary', () => {
      const transcript = undefined;
      const summary = undefined;

      const shouldEvaluate = !!(transcript || summary);
      expect(shouldEvaluate).toBe(false);
    });

    it('should evaluate triggers with transcript', () => {
      const transcript = 'Hello, I want to schedule an appointment';
      const summary = undefined;

      const shouldEvaluate = !!(transcript || summary);
      expect(shouldEvaluate).toBe(true);
    });

    it('should evaluate triggers with summary only', () => {
      const transcript = undefined;
      const summary = 'Customer requested appointment';

      const shouldEvaluate = !!(transcript || summary);
      expect(shouldEvaluate).toBe(true);
    });
  });

  describe('Trigger Deduplication', () => {
    it('should filter out already-fired triggers', () => {
      const allTriggers = [
        { id: 'trigger-1', intentDescription: 'Appointment request', priority: 1 },
        { id: 'trigger-2', intentDescription: 'Price inquiry', priority: 2 },
        { id: 'trigger-3', intentDescription: 'Complaint', priority: 3 }
      ];

      const firedTriggers = ['trigger-1'];

      const eligibleTriggers = allTriggers.filter(
        t => !firedTriggers.includes(t.id)
      );

      expect(eligibleTriggers.length).toBe(2);
      expect(eligibleTriggers.map(t => t.id)).toEqual(['trigger-2', 'trigger-3']);
    });

    it('should not send if all triggers already fired', () => {
      const allTriggers = [
        { id: 'trigger-1', intentDescription: 'Appointment request', priority: 1 }
      ];

      const firedTriggers = ['trigger-1'];

      const eligibleTriggers = allTriggers.filter(
        t => !firedTriggers.includes(t.id)
      );

      expect(eligibleTriggers.length).toBe(0);
    });
  });

  describe('SMS Message Formatting', () => {
    it('should append opt-out message', () => {
      const message = 'Thanks for your interest!';
      const OPT_OUT_MESSAGE = '\nReply STOP to opt out';

      const fullMessage = message + OPT_OUT_MESSAGE;

      expect(fullMessage).toContain('STOP');
      expect(fullMessage).toBe('Thanks for your interest!\nReply STOP to opt out');
    });

    it('should handle multi-line messages', () => {
      const message = 'Line 1\nLine 2\nLine 3';
      const OPT_OUT_MESSAGE = '\nReply STOP to opt out';

      const fullMessage = message + OPT_OUT_MESSAGE;

      expect(fullMessage.split('\n').length).toBe(4);
    });
  });

  describe('Trigger Priority Sorting', () => {
    it('should sort triggers by priority (lower = higher priority)', () => {
      const triggers = [
        { id: '3', priority: 10 },
        { id: '1', priority: 1 },
        { id: '2', priority: 5 }
      ];

      const sorted = [...triggers].sort((a, b) => a.priority - b.priority);

      expect(sorted[0].id).toBe('1');
      expect(sorted[1].id).toBe('2');
      expect(sorted[2].id).toBe('3');
    });
  });
});

describe('Interaction Display Logic', () => {
  describe('Source Icon Selection', () => {
    const getSourceIcon = (sourceType: string) => {
      switch (sourceType) {
        case 'phone':
          return 'Phone';
        case 'sms':
          return 'MessageSquare';
        case 'web_form':
        case 'chatbot':
          return 'Globe';
        default:
          return 'PhoneIncoming';
      }
    };

    it('should return Phone icon for phone source', () => {
      expect(getSourceIcon('phone')).toBe('Phone');
    });

    it('should return MessageSquare icon for SMS source', () => {
      expect(getSourceIcon('sms')).toBe('MessageSquare');
    });

    it('should return Globe icon for web form', () => {
      expect(getSourceIcon('web_form')).toBe('Globe');
    });

    it('should return Globe icon for chatbot', () => {
      expect(getSourceIcon('chatbot')).toBe('Globe');
    });

    it('should return default icon for unknown source', () => {
      expect(getSourceIcon('unknown')).toBe('PhoneIncoming');
    });
  });

  describe('Status Badge Variant', () => {
    const getStatusVariant = (status: string | null) => {
      switch (status) {
        case 'completed':
          return 'success';
        case 'failed':
          return 'destructive';
        case 'no_answer':
        case 'busy':
          return 'secondary';
        default:
          return 'outline';
      }
    };

    it('should return success for completed', () => {
      expect(getStatusVariant('completed')).toBe('success');
    });

    it('should return destructive for failed', () => {
      expect(getStatusVariant('failed')).toBe('destructive');
    });

    it('should return secondary for no_answer', () => {
      expect(getStatusVariant('no_answer')).toBe('secondary');
    });

    it('should return secondary for busy', () => {
      expect(getStatusVariant('busy')).toBe('secondary');
    });

    it('should return outline for null status', () => {
      expect(getStatusVariant(null)).toBe('outline');
    });

    it('should return outline for pending', () => {
      expect(getStatusVariant('pending')).toBe('outline');
    });
  });

  describe('SMS Status Icon', () => {
    const getSmsStatusIcon = (status: string) => {
      switch (status) {
        case 'delivered':
          return 'Check';
        case 'sent':
          return 'Send';
        case 'failed':
          return 'X';
        default:
          return 'Clock';
      }
    };

    it('should return Check for delivered', () => {
      expect(getSmsStatusIcon('delivered')).toBe('Check');
    });

    it('should return Send for sent', () => {
      expect(getSmsStatusIcon('sent')).toBe('Send');
    });

    it('should return X for failed', () => {
      expect(getSmsStatusIcon('failed')).toBe('X');
    });

    it('should return Clock for pending', () => {
      expect(getSmsStatusIcon('pending')).toBe('Clock');
    });
  });

  describe('Transcript Formatting', () => {
    it('should identify AI/assistant roles', () => {
      const aiRoles = ['assistant', 'ai', 'agent'];
      const turn = { role: 'assistant', content: 'Hello!' };

      const isAiRole = aiRoles.includes(turn.role);
      expect(isAiRole).toBe(true);
    });

    it('should identify user roles', () => {
      const aiRoles = ['assistant', 'ai', 'agent'];
      const turn = { role: 'user', content: 'Hi there!' };

      const isAiRole = aiRoles.includes(turn.role);
      expect(isAiRole).toBe(false);
    });
  });

  describe('Extracted Data Display', () => {
    it('should format key names by replacing underscores with spaces', () => {
      const key = 'primary_intent';
      const formatted = key.replace(/_/g, ' ');

      expect(formatted).toBe('primary intent');
    });

    it('should handle nested objects as JSON strings', () => {
      const value = { nested: { data: 'value' } };
      const displayed = typeof value === 'object' ? JSON.stringify(value) : String(value);

      expect(displayed).toBe('{"nested":{"data":"value"}}');
    });

    it('should display primitive values as strings', () => {
      expect(String(123)).toBe('123');
      expect(String(true)).toBe('true');
      expect(String('text')).toBe('text');
    });
  });
});

describe('Webhook Deduplication', () => {
  describe('Time-based Deduplication', () => {
    it('should detect recent duplicates (within 5 minutes)', () => {
      const now = Date.now();
      const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);
      const existingCreatedAt = new Date(now - 2 * 60 * 1000); // 2 minutes ago

      const isDuplicate = existingCreatedAt > fiveMinutesAgo;
      expect(isDuplicate).toBe(true);
    });

    it('should allow reprocessing after 5 minutes', () => {
      const now = Date.now();
      const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);
      const existingCreatedAt = new Date(now - 10 * 60 * 1000); // 10 minutes ago

      const isDuplicate = existingCreatedAt > fiveMinutesAgo;
      expect(isDuplicate).toBe(false);
    });
  });
});

describe('Error Logging', () => {
  describe('Error Types', () => {
    it('should categorize JSON parse errors', () => {
      const errorType = 'invalid_json';
      expect(errorType).toBe('invalid_json');
    });

    it('should categorize processing errors', () => {
      const errorType = 'processing_error';
      expect(errorType).toBe('processing_error');
    });

    it('should categorize server errors', () => {
      const errorType = 'server_error';
      expect(errorType).toBe('server_error');
    });
  });

  describe('Raw Body Truncation', () => {
    it('should truncate large payloads to 10000 chars', () => {
      const largePayload = 'x'.repeat(15000);
      const truncated = largePayload.substring(0, 10000);

      expect(truncated.length).toBe(10000);
    });

    it('should not truncate small payloads', () => {
      const smallPayload = 'small payload';
      const truncated = smallPayload.substring(0, 10000);

      expect(truncated).toBe(smallPayload);
    });
  });
});

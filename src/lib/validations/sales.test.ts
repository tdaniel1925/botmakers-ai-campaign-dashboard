import { describe, it, expect } from 'vitest';
import {
  createLeadSchema,
  updateLeadSchema,
  createActivitySchema,
  updateProfileSchema,
  enrollLeadsSchema,
  validateRequest,
} from './sales';

describe('Sales Validation Schemas', () => {
  describe('createLeadSchema', () => {
    it('should validate a valid lead', () => {
      const validLead = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '555-1234',
        company: 'Acme Inc',
      };

      const result = createLeadSchema.safeParse(validLead);
      expect(result.success).toBe(true);
    });

    it('should require firstName and lastName', () => {
      const invalidLead = {
        email: 'john@example.com',
      };

      const result = createLeadSchema.safeParse(invalidLead);
      expect(result.success).toBe(false);
    });

    it('should reject invalid email format', () => {
      const invalidLead = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'not-an-email',
      };

      const result = createLeadSchema.safeParse(invalidLead);
      expect(result.success).toBe(false);
    });

    it('should allow optional fields to be null', () => {
      const lead = {
        firstName: 'John',
        lastName: 'Doe',
        email: null,
        phone: null,
        company: null,
      };

      const result = createLeadSchema.safeParse(lead);
      expect(result.success).toBe(true);
    });

    it('should transform estimatedValue from string to number', () => {
      const lead = {
        firstName: 'John',
        lastName: 'Doe',
        estimatedValue: '5000',
      };

      const result = createLeadSchema.safeParse(lead);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.estimatedValue).toBe(5000);
      }
    });
  });

  describe('createActivitySchema', () => {
    it('should validate a valid activity', () => {
      const activity = {
        activityType: 'note',
        title: 'Follow up call',
        description: 'Discussed pricing',
      };

      const result = createActivitySchema.safeParse(activity);
      expect(result.success).toBe(true);
    });

    it('should reject invalid activity type', () => {
      const activity = {
        activityType: 'invalid-type',
        title: 'Test',
      };

      const result = createActivitySchema.safeParse(activity);
      expect(result.success).toBe(false);
    });

    it('should require title', () => {
      const activity = {
        activityType: 'note',
      };

      const result = createActivitySchema.safeParse(activity);
      expect(result.success).toBe(false);
    });
  });

  describe('updateProfileSchema', () => {
    it('should validate profile update', () => {
      const profile = {
        fullName: 'John Doe',
        phone: '555-1234',
        bio: 'Sales rep',
      };

      const result = updateProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
    });

    it('should allow partial updates', () => {
      const profile = {
        phone: '555-5678',
      };

      const result = updateProfileSchema.safeParse(profile);
      expect(result.success).toBe(true);
    });
  });

  describe('enrollLeadsSchema', () => {
    it('should validate valid UUIDs', () => {
      const data = {
        leadIds: ['123e4567-e89b-12d3-a456-426614174000'],
      };

      const result = enrollLeadsSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it('should reject empty array', () => {
      const data = {
        leadIds: [],
      };

      const result = enrollLeadsSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject invalid UUIDs', () => {
      const data = {
        leadIds: ['not-a-uuid'],
      };

      const result = enrollLeadsSchema.safeParse(data);
      expect(result.success).toBe(false);
    });
  });

  describe('validateRequest helper', () => {
    it('should return success with data on valid input', () => {
      const result = validateRequest(createLeadSchema, {
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.firstName).toBe('John');
      }
    });

    it('should return error details on invalid input', () => {
      const result = validateRequest(createLeadSchema, {
        firstName: '',
        lastName: '',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Validation failed');
        expect(result.details).toBeDefined();
      }
    });
  });
});

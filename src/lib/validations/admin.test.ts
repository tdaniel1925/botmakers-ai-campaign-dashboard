import { describe, it, expect } from 'vitest';
import {
  createSalesUserSchema,
  updateSalesUserSchema,
  createCommissionSchema,
  updateCommissionSchema,
  adminUpdateLeadSchema,
  createResourceSchema,
  createCategorySchema,
  sanitizeSearchInput,
  uuidSchema,
} from './admin';
import { validateRequest } from './sales';

describe('Admin Validation Schemas', () => {
  describe('uuidSchema', () => {
    it('should validate valid UUID', () => {
      const result = uuidSchema.safeParse('123e4567-e89b-12d3-a456-426614174000');
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = uuidSchema.safeParse('not-a-uuid');
      expect(result.success).toBe(false);
    });
  });

  describe('createSalesUserSchema', () => {
    it('should validate valid sales user', () => {
      const user = {
        email: 'sales@example.com',
        fullName: 'John Doe',
        password: 'securePassword123',
      };

      const result = createSalesUserSchema.safeParse(user);
      expect(result.success).toBe(true);
    });

    it('should require email', () => {
      const user = {
        fullName: 'John Doe',
        password: 'securePassword123',
      };

      const result = createSalesUserSchema.safeParse(user);
      expect(result.success).toBe(false);
    });

    it('should require password minimum length', () => {
      const user = {
        email: 'sales@example.com',
        fullName: 'John Doe',
        password: 'short',
      };

      const result = createSalesUserSchema.safeParse(user);
      expect(result.success).toBe(false);
    });

    it('should default commission rate to 18', () => {
      const user = {
        email: 'sales@example.com',
        fullName: 'John Doe',
        password: 'securePassword123',
      };

      const result = createSalesUserSchema.safeParse(user);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.commissionRate).toBe(18);
      }
    });

    it('should coerce commission rate from string', () => {
      const user = {
        email: 'sales@example.com',
        fullName: 'John Doe',
        password: 'securePassword123',
        commissionRate: '25',
      };

      const result = createSalesUserSchema.safeParse(user);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.commissionRate).toBe(25);
      }
    });
  });

  describe('updateSalesUserSchema', () => {
    it('should allow partial updates', () => {
      const update = { isActive: false };
      const result = updateSalesUserSchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it('should validate commission rate range', () => {
      const update = { commissionRate: 150 };
      const result = updateSalesUserSchema.safeParse(update);
      expect(result.success).toBe(false);
    });
  });

  describe('createCommissionSchema', () => {
    it('should validate valid commission', () => {
      const commission = {
        leadId: '123e4567-e89b-12d3-a456-426614174000',
        salesUserId: '123e4567-e89b-12d3-a456-426614174001',
        saleAmount: 10000,
        commissionRate: 18,
      };

      const result = createCommissionSchema.safeParse(commission);
      expect(result.success).toBe(true);
    });

    it('should require valid UUIDs', () => {
      const commission = {
        leadId: 'invalid-uuid',
        salesUserId: '123e4567-e89b-12d3-a456-426614174001',
        saleAmount: 10000,
        commissionRate: 18,
      };

      const result = createCommissionSchema.safeParse(commission);
      expect(result.success).toBe(false);
    });

    it('should reject negative sale amount', () => {
      const commission = {
        leadId: '123e4567-e89b-12d3-a456-426614174000',
        salesUserId: '123e4567-e89b-12d3-a456-426614174001',
        saleAmount: -100,
        commissionRate: 18,
      };

      const result = createCommissionSchema.safeParse(commission);
      expect(result.success).toBe(false);
    });

    it('should reject commission rate over 100', () => {
      const commission = {
        leadId: '123e4567-e89b-12d3-a456-426614174000',
        salesUserId: '123e4567-e89b-12d3-a456-426614174001',
        saleAmount: 10000,
        commissionRate: 150,
      };

      const result = createCommissionSchema.safeParse(commission);
      expect(result.success).toBe(false);
    });

    it('should default status to pending', () => {
      const commission = {
        leadId: '123e4567-e89b-12d3-a456-426614174000',
        salesUserId: '123e4567-e89b-12d3-a456-426614174001',
        saleAmount: 10000,
        commissionRate: 18,
      };

      const result = createCommissionSchema.safeParse(commission);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('pending');
      }
    });

    it('should coerce saleAmount from string', () => {
      const commission = {
        leadId: '123e4567-e89b-12d3-a456-426614174000',
        salesUserId: '123e4567-e89b-12d3-a456-426614174001',
        saleAmount: '15000',
        commissionRate: '20',
      };

      const result = createCommissionSchema.safeParse(commission);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.saleAmount).toBe(15000);
        expect(result.data.commissionRate).toBe(20);
      }
    });
  });

  describe('updateCommissionSchema', () => {
    it('should validate status update', () => {
      const update = { status: 'approved' as const };
      const result = updateCommissionSchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it('should allow cancelled status', () => {
      const update = { status: 'cancelled' as const };
      const result = updateCommissionSchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const update = { status: 'invalid' };
      const result = updateCommissionSchema.safeParse(update);
      expect(result.success).toBe(false);
    });

    it('should allow notes update', () => {
      const update = { notes: 'Payment sent via ACH' };
      const result = updateCommissionSchema.safeParse(update);
      expect(result.success).toBe(true);
    });
  });

  describe('adminUpdateLeadSchema', () => {
    it('should validate partial lead update', () => {
      const update = {
        status: 'qualified' as const,
        estimatedValue: 5000,
      };

      const result = adminUpdateLeadSchema.safeParse(update);
      expect(result.success).toBe(true);
    });

    it('should validate all lead statuses', () => {
      const statuses = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
      statuses.forEach(status => {
        const result = adminUpdateLeadSchema.safeParse({ status });
        expect(result.success).toBe(true);
      });
    });

    it('should reject invalid status', () => {
      const update = { status: 'invalid-status' };
      const result = adminUpdateLeadSchema.safeParse(update);
      expect(result.success).toBe(false);
    });
  });

  describe('createResourceSchema', () => {
    it('should validate valid resource', () => {
      const resource = {
        title: 'Product Guide',
        type: 'pdf' as const,
        url: 'https://example.com/guide.pdf',
      };

      const result = createResourceSchema.safeParse(resource);
      expect(result.success).toBe(true);
    });

    it('should reject invalid URL', () => {
      const resource = {
        title: 'Product Guide',
        type: 'pdf' as const,
        url: 'not-a-url',
      };

      const result = createResourceSchema.safeParse(resource);
      expect(result.success).toBe(false);
    });

    it('should validate all resource types', () => {
      const types = ['pdf', 'image', 'video', 'document', 'link', 'other'];
      types.forEach(type => {
        const result = createResourceSchema.safeParse({
          title: 'Test',
          type,
          url: 'https://example.com/resource',
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('createCategorySchema', () => {
    it('should validate valid category', () => {
      const category = {
        name: 'Sales Materials',
        description: 'Materials for sales team',
        color: '#FF5733',
      };

      const result = createCategorySchema.safeParse(category);
      expect(result.success).toBe(true);
    });

    it('should reject invalid hex color', () => {
      const category = {
        name: 'Test',
        color: 'red',
      };

      const result = createCategorySchema.safeParse(category);
      expect(result.success).toBe(false);
    });

    it('should accept valid hex colors', () => {
      const colors = ['#FF0000', '#00ff00', '#0000FF', '#aabbcc'];
      colors.forEach(color => {
        const result = createCategorySchema.safeParse({
          name: 'Test',
          color,
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('sanitizeSearchInput', () => {
    it('should remove SQL wildcards', () => {
      expect(sanitizeSearchInput('test%')).toBe('test');
      expect(sanitizeSearchInput('test_value')).toBe('testvalue');
    });

    it('should remove injection characters', () => {
      expect(sanitizeSearchInput('test<script>')).toBe('testscript');
      expect(sanitizeSearchInput("test'; DROP TABLE users;")).toBe('test DROP TABLE users');
    });

    it('should trim whitespace', () => {
      expect(sanitizeSearchInput('  test  ')).toBe('test');
    });

    it('should limit length to 200 characters', () => {
      const longInput = 'a'.repeat(300);
      expect(sanitizeSearchInput(longInput).length).toBe(200);
    });
  });
});

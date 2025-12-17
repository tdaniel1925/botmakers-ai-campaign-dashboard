import { z } from 'zod';

// UUID validation helper
export const uuidSchema = z.string().uuid('Invalid UUID format');

// Sales Team validation schemas
export const createSalesUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  fullName: z.string().min(1, 'Full name is required').max(100, 'Name too long'),
  phone: z.string().max(20, 'Phone number too long').optional().nullable(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  commissionRate: z.coerce.number().min(0).max(100).optional().default(18),
});

export const updateSalesUserSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(100, 'Name too long').optional(),
  phone: z.string().max(20, 'Phone number too long').optional().nullable(),
  commissionRate: z.coerce.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  bio: z.string().max(1000, 'Bio too long').optional().nullable(),
});

// Lead validation schemas (for admin)
export const adminUpdateLeadSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  company: z.string().max(200).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  jobTitle: z.string().max(100).optional().nullable(),
  status: z.enum(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost']).optional(),
  stageId: z.string().uuid().optional().nullable(),
  source: z.string().max(100).optional().nullable(),
  estimatedValue: z.coerce.number().int().min(0).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  nextFollowUpAt: z.string().datetime().optional().nullable(),
});

// Impersonate validation
export const impersonateSchema = z.object({
  userId: z.string().uuid('Invalid user ID').optional(),
  organizationId: z.string().uuid('Invalid organization ID').optional(),
}).refine(data => data.userId || data.organizationId, {
  message: 'Either userId or organizationId is required',
});

// Resource validation schemas
export const createResourceSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(2000, 'Description too long').optional().nullable(),
  type: z.enum(['pdf', 'image', 'video', 'document', 'link', 'other']),
  url: z.string().url('Invalid URL format'),
  fileSize: z.coerce.number().int().min(0).optional().nullable(),
  thumbnailUrl: z.string().url('Invalid thumbnail URL').optional().nullable(),
  categoryId: z.string().uuid('Invalid category ID').optional().nullable(),
});

export const updateResourceSchema = createResourceSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// Resource Category validation
export const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format (use hex like #FF0000)').optional().nullable(),
});

// Commission validation
export const createCommissionSchema = z.object({
  leadId: z.string().uuid('Invalid lead ID'),
  salesUserId: z.string().uuid('Invalid sales user ID'),
  saleAmount: z.coerce.number().int().min(0, 'Sale amount must be positive'),
  commissionRate: z.coerce.number().min(0).max(100, 'Commission rate must be between 0 and 100'),
  status: z.enum(['pending', 'approved', 'paid']).default('pending'),
  notes: z.string().max(2000, 'Notes too long').optional().nullable(),
});

export const updateCommissionSchema = z.object({
  status: z.enum(['pending', 'approved', 'paid', 'cancelled']).optional(),
  notes: z.string().max(2000, 'Notes too long').optional().nullable(),
});

// Search/filter validation for admin routes
export const adminSearchParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  status: z.string().optional(),
  salesUserId: z.string().uuid().optional().or(z.literal('all')).or(z.literal('')),
  stageId: z.string().uuid().optional().or(z.literal('all')).or(z.literal('unassigned')).or(z.literal('')),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Sanitize search input (SQL wildcard and injection protection)
export function sanitizeSearchInput(input: string): string {
  return input
    .replace(/[%_\\]/g, '') // Remove SQL wildcards
    .replace(/[<>'"`;]/g, '') // Remove potential injection characters
    .trim()
    .slice(0, 200); // Limit length
}

// Re-export validateRequest from sales for consistency
export { validateRequest } from './sales';

// Type exports
export type CreateSalesUserInput = z.infer<typeof createSalesUserSchema>;
export type UpdateSalesUserInput = z.infer<typeof updateSalesUserSchema>;
export type AdminUpdateLeadInput = z.infer<typeof adminUpdateLeadSchema>;
export type ImpersonateInput = z.infer<typeof impersonateSchema>;
export type CreateResourceInput = z.infer<typeof createResourceSchema>;
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateCommissionInput = z.infer<typeof createCommissionSchema>;
export type UpdateCommissionInput = z.infer<typeof updateCommissionSchema>;

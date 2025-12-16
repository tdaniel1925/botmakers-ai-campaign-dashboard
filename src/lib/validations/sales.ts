import { z } from 'zod';

// Lead validation schemas
export const createLeadSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100, 'First name too long'),
  lastName: z.string().min(1, 'Last name is required').max(100, 'Last name too long'),
  email: z.string().email('Invalid email format').optional().nullable(),
  phone: z.string().max(20, 'Phone number too long').optional().nullable(),
  company: z.string().max(200, 'Company name too long').optional().nullable(),
  jobTitle: z.string().max(100, 'Job title too long').optional().nullable(),
  estimatedValue: z.union([z.string(), z.number()]).optional().nullable().transform(val => {
    if (val === null || val === undefined || val === '') return null;
    const num = typeof val === 'string' ? parseInt(val, 10) : val;
    return isNaN(num) ? null : num;
  }),
  source: z.string().max(100, 'Source too long').optional().nullable(),
  notes: z.string().max(5000, 'Notes too long').optional().nullable(),
});

export const updateLeadSchema = createLeadSchema.partial().extend({
  status: z.enum(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost']).optional(),
  stageId: z.string().uuid('Invalid stage ID').optional().nullable(),
  nextFollowUpAt: z.string().datetime().optional().nullable(),
});

// Lead activity validation
export const createActivitySchema = z.object({
  activityType: z.enum(['note', 'call', 'email', 'meeting', 'task', 'other']),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(5000, 'Description too long').optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

// Profile update validation
export const updateProfileSchema = z.object({
  fullName: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  phone: z.string().max(20, 'Phone number too long').optional().nullable(),
  bio: z.string().max(1000, 'Bio too long').optional().nullable(),
});

// Campaign enrollment validation
export const enrollLeadsSchema = z.object({
  leadIds: z.array(z.string().uuid('Invalid lead ID')).min(1, 'At least one lead is required'),
});

// Search/filter validation
export const searchParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200, 'Search query too long').optional(),
  status: z.enum(['', 'new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost']).optional(),
  stageId: z.string().uuid('Invalid stage ID').optional().or(z.literal('')),
});

// Utility to safely parse and return validation result
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string; details: Record<string, string[]> } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const details: Record<string, string[]> = {};
  result.error.issues.forEach((issue) => {
    const path = issue.path.join('.') || 'root';
    if (!details[path]) details[path] = [];
    details[path].push(issue.message);
  });

  return {
    success: false,
    error: 'Validation failed',
    details,
  };
}

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type EnrollLeadsInput = z.infer<typeof enrollLeadsSchema>;

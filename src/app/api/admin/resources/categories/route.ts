import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/db';
import { resourceCategories } from '@/db/schema';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createApiLogger } from '@/lib/logger';
import { createCategorySchema, validateRequest } from '@/lib/validations/admin';

export async function GET(request: NextRequest) {
  const log = createApiLogger('/api/admin/resources/categories');
  try {
    const admin = await requireAdmin();
    log.info('Fetching categories', { userId: admin.id });

    // Rate limiting
    const rateLimit = withRateLimit(admin.id, 'admin-categories-get', RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      log.warn('Rate limit exceeded', { userId: admin.id });
      return rateLimit.response;
    }

    const categories = await db
      .select()
      .from(resourceCategories)
      .orderBy(resourceCategories.name);

    log.info('Categories fetched', { count: categories.length });
    return NextResponse.json(categories);
  } catch (error) {
    log.error('Failed to fetch categories', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const log = createApiLogger('/api/admin/resources/categories');
  try {
    const admin = await requireAdmin();
    log.info('Creating category', { userId: admin.id });

    // Rate limiting for write operations
    const rateLimit = withRateLimit(admin.id, 'admin-categories-post', RATE_LIMITS.write);
    if (!rateLimit.allowed) {
      log.warn('Rate limit exceeded', { userId: admin.id });
      return rateLimit.response;
    }

    const body = await request.json();

    // Validate input with Zod
    const validation = validateRequest(createCategorySchema, body);
    if (!validation.success) {
      log.warn('Validation failed', { details: validation.details });
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      );
    }

    const { name, description, color } = validation.data;

    const [category] = await db
      .insert(resourceCategories)
      .values({
        name,
        description: description || null,
        color: color || null,
        isActive: true,
      })
      .returning();

    log.info('Category created', { categoryId: category.id });
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    log.error('Failed to create category', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
}

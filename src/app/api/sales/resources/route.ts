import { NextRequest, NextResponse } from 'next/server';
import { requireSalesAuth } from '@/lib/auth';
import { db } from '@/db';
import { resources, resourceCategories } from '@/db/schema';
import { eq, desc, and, ilike, sql } from 'drizzle-orm';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createApiLogger } from '@/lib/logger';

// Sanitize search input
function sanitizeSearchInput(input: string): string {
  return input
    .replace(/[%_\\]/g, '')
    .replace(/[<>'"`;]/g, '')
    .trim()
    .slice(0, 200);
}

export async function GET(request: NextRequest) {
  const log = createApiLogger('/api/sales/resources');

  try {
    const salesUser = await requireSalesAuth();
    log.info('Fetching resources', { userId: salesUser.id });

    // Rate limiting
    const rateLimit = withRateLimit(salesUser.id, 'sales-resources-get', RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      return rateLimit.response;
    }

    const { searchParams } = new URL(request.url);

    const rawSearch = searchParams.get('search') || '';
    const search = sanitizeSearchInput(rawSearch);
    const categoryId = searchParams.get('categoryId');
    const type = searchParams.get('type');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    // Build conditions - only active resources
    const conditions = [eq(resources.isActive, true)];

    if (search) {
      conditions.push(ilike(resources.title, `%${search}%`));
    }

    if (categoryId && categoryId !== 'all') {
      conditions.push(eq(resources.categoryId, categoryId));
    }

    if (type && type !== 'all') {
      conditions.push(eq(resources.type, type as 'pdf' | 'image' | 'video' | 'document' | 'link' | 'other'));
    }

    // Get resources with category info
    const resourcesData = await db
      .select({
        id: resources.id,
        title: resources.title,
        description: resources.description,
        type: resources.type,
        url: resources.url,
        fileSize: resources.fileSize,
        thumbnailUrl: resources.thumbnailUrl,
        downloadCount: resources.downloadCount,
        createdAt: resources.createdAt,
        category: {
          id: resourceCategories.id,
          name: resourceCategories.name,
          color: resourceCategories.color,
        },
      })
      .from(resources)
      .leftJoin(resourceCategories, eq(resources.categoryId, resourceCategories.id))
      .where(and(...conditions))
      .orderBy(desc(resources.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(resources)
      .where(and(...conditions));

    // Get categories for filters
    const categories = await db
      .select()
      .from(resourceCategories)
      .where(eq(resourceCategories.isActive, true))
      .orderBy(resourceCategories.name);

    log.info('Resources fetched', { userId: salesUser.id, count: resourcesData.length });

    const response = NextResponse.json({
      resources: resourcesData,
      categories,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });

    Object.entries(rateLimit.headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  } catch (error) {
    log.error('Failed to fetch resources', error);
    return NextResponse.json(
      { error: 'Failed to fetch resources' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/db';
import { resources, resourceCategories } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createApiLogger } from '@/lib/logger';
import { createResourceSchema, validateRequest } from '@/lib/validations/admin';

export async function GET(request: NextRequest) {
  const log = createApiLogger('/api/admin/resources');
  try {
    const admin = await requireAdmin();
    log.info('Fetching resources', { userId: admin.id });

    // Rate limiting
    const rateLimit = withRateLimit(admin.id, 'admin-resources-get', RATE_LIMITS.standard);
    if (!rateLimit.allowed) {
      log.warn('Rate limit exceeded', { userId: admin.id });
      return rateLimit.response;
    }

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
        isActive: resources.isActive,
        createdAt: resources.createdAt,
        category: {
          id: resourceCategories.id,
          name: resourceCategories.name,
          color: resourceCategories.color,
        },
      })
      .from(resources)
      .leftJoin(resourceCategories, eq(resources.categoryId, resourceCategories.id))
      .orderBy(desc(resources.createdAt));

    const categories = await db
      .select()
      .from(resourceCategories)
      .orderBy(resourceCategories.name);

    log.info('Resources fetched', { count: resourcesData.length });
    return NextResponse.json({ resources: resourcesData, categories });
  } catch (error) {
    log.error('Failed to fetch resources', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to fetch resources' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const log = createApiLogger('/api/admin/resources');
  try {
    const admin = await requireAdmin();
    log.info('Creating resource', { userId: admin.id });

    // Rate limiting for write operations
    const rateLimit = withRateLimit(admin.id, 'admin-resources-post', RATE_LIMITS.write);
    if (!rateLimit.allowed) {
      log.warn('Rate limit exceeded', { userId: admin.id });
      return rateLimit.response;
    }

    const body = await request.json();

    // Validate input with Zod
    const validation = validateRequest(createResourceSchema, body);
    if (!validation.success) {
      log.warn('Validation failed', { details: validation.details });
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      );
    }

    const { title, description, type, url, fileSize, thumbnailUrl, categoryId } = validation.data;

    const [resource] = await db
      .insert(resources)
      .values({
        title,
        description: description || null,
        type,
        url,
        fileSize: fileSize || null,
        thumbnailUrl: thumbnailUrl || null,
        categoryId: categoryId || null,
        isActive: true,
        downloadCount: 0,
      })
      .returning();

    log.info('Resource created', { resourceId: resource.id });
    return NextResponse.json(resource, { status: 201 });
  } catch (error) {
    log.error('Failed to create resource', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to create resource' },
      { status: 500 }
    );
  }
}

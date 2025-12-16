import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/db';
import { resources } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { withRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createApiLogger } from '@/lib/logger';
import { updateResourceSchema, validateRequest, uuidSchema } from '@/lib/validations/admin';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = createApiLogger('/api/admin/resources/[id]');
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    // Validate UUID format
    if (!uuidSchema.safeParse(id).success) {
      log.warn('Invalid UUID format', { id });
      return NextResponse.json({ error: 'Invalid resource ID format' }, { status: 400 });
    }

    log.info('Updating resource', { userId: admin.id, resourceId: id });

    // Rate limiting for write operations
    const rateLimit = withRateLimit(admin.id, 'admin-resource-put', RATE_LIMITS.write);
    if (!rateLimit.allowed) {
      log.warn('Rate limit exceeded', { userId: admin.id });
      return rateLimit.response;
    }

    const body = await request.json();

    // Validate input with Zod
    const validation = validateRequest(updateResourceSchema, body);
    if (!validation.success) {
      log.warn('Validation failed', { details: validation.details });
      return NextResponse.json(
        { error: validation.error, details: validation.details },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select()
      .from(resources)
      .where(eq(resources.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    const { title, description, type, url, fileSize, thumbnailUrl, categoryId, isActive } = validation.data;

    const [updated] = await db
      .update(resources)
      .set({
        title: title !== undefined ? title : existing.title,
        description: description !== undefined ? description : existing.description,
        type: type !== undefined ? type : existing.type,
        url: url !== undefined ? url : existing.url,
        fileSize: fileSize !== undefined ? fileSize : existing.fileSize,
        thumbnailUrl: thumbnailUrl !== undefined ? thumbnailUrl : existing.thumbnailUrl,
        categoryId: categoryId !== undefined ? categoryId : existing.categoryId,
        isActive: isActive !== undefined ? isActive : existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(resources.id, id))
      .returning();

    log.info('Resource updated', { resourceId: id });
    return NextResponse.json(updated);
  } catch (error) {
    log.error('Failed to update resource', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to update resource' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = createApiLogger('/api/admin/resources/[id]');
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    // Validate UUID format
    if (!uuidSchema.safeParse(id).success) {
      log.warn('Invalid UUID format', { id });
      return NextResponse.json({ error: 'Invalid resource ID format' }, { status: 400 });
    }

    log.info('Deleting resource', { userId: admin.id, resourceId: id });

    // Rate limiting for write operations
    const rateLimit = withRateLimit(admin.id, 'admin-resource-delete', RATE_LIMITS.write);
    if (!rateLimit.allowed) {
      log.warn('Rate limit exceeded', { userId: admin.id });
      return rateLimit.response;
    }

    await db.delete(resources).where(eq(resources.id, id));

    log.info('Resource deleted', { resourceId: id });
    return NextResponse.json({ message: 'Resource deleted' });
  } catch (error) {
    log.error('Failed to delete resource', { error: error instanceof Error ? error.message : 'Unknown error' });
    return NextResponse.json(
      { error: 'Failed to delete resource' },
      { status: 500 }
    );
  }
}

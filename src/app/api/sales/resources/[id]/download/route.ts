import { NextRequest, NextResponse } from 'next/server';
import { requireSalesAuth } from '@/lib/auth';
import { db } from '@/db';
import { resources } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSalesAuth();
    const { id } = await params;

    // Get resource
    const [resource] = await db
      .select()
      .from(resources)
      .where(eq(resources.id, id))
      .limit(1);

    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    // Increment download count
    await db
      .update(resources)
      .set({
        downloadCount: sql`${resources.downloadCount} + 1`,
      })
      .where(eq(resources.id, id));

    return NextResponse.json({ success: true, url: resource.url });
  } catch (error) {
    console.error('Failed to track download:', error);
    return NextResponse.json(
      { error: 'Failed to track download' },
      { status: 500 }
    );
  }
}

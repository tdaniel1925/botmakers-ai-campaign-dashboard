import { NextResponse } from 'next/server';
import { db } from '@/db';
import { leadStages } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { requireSalesAuth } from '@/lib/auth';

// GET /api/sales/stages - Get all lead stages
export async function GET() {
  try {
    await requireSalesAuth();

    const stages = await db
      .select()
      .from(leadStages)
      .orderBy(asc(leadStages.order));

    return NextResponse.json(stages);
  } catch (error) {
    console.error('[Sales Stages API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch stages' },
      { status: 500 }
    );
  }
}

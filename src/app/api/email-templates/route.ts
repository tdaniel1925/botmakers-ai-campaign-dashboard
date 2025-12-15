import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { emailTemplates, auditLogs } from '@/db/schema';
import { eq, ilike, desc, or, and } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth';

// GET /api/email-templates - List email templates
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const type = searchParams.get('type');

    const conditions = [];

    if (search) {
      conditions.push(
        or(
          ilike(emailTemplates.name, `%${search}%`),
          ilike(emailTemplates.subject, `%${search}%`)
        )
      );
    }

    if (type) {
      conditions.push(eq(emailTemplates.type, type as any));
    }

    const templates = await db
      .select()
      .from(emailTemplates)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(emailTemplates.type, desc(emailTemplates.isDefault), desc(emailTemplates.createdAt));

    return NextResponse.json({ data: templates });
  } catch (error) {
    console.error('[Email Templates API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// POST /api/email-templates - Create a new template
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();

    const { name, type, subject, htmlContent, isDefault } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
    }
    if (!type) {
      return NextResponse.json({ error: 'Template type is required' }, { status: 400 });
    }
    if (!subject?.trim()) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }
    if (!htmlContent?.trim()) {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
    }

    // If setting as default, unset other defaults of same type
    if (isDefault) {
      await db
        .update(emailTemplates)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(emailTemplates.type, type),
            eq(emailTemplates.isDefault, true)
          )
        );
    }

    // Create template
    const [newTemplate] = await db
      .insert(emailTemplates)
      .values({
        name: name.trim(),
        type,
        subject: subject.trim(),
        htmlContent: htmlContent.trim(),
        isDefault: isDefault || false,
      })
      .returning();

    // Log the action
    await db.insert(auditLogs).values({
      userId: admin.id,
      action: 'create',
      entityType: 'email_template',
      entityId: newTemplate.id,
      details: { name, type },
    });

    return NextResponse.json({ data: newTemplate }, { status: 201 });
  } catch (error) {
    console.error('[Email Templates API] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create template' },
      { status: 500 }
    );
  }
}

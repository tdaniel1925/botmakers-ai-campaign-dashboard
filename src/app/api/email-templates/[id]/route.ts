import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { emailTemplates, auditLogs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/email-templates/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { id } = await params;

    const [template] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, id))
      .limit(1);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ data: template });
  } catch (error) {
    console.error('[Email Templates API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

// PATCH /api/email-templates/[id]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();

    // Check if template exists
    const [existingTemplate] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, id))
      .limit(1);

    if (!existingTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const { name, type, subject, htmlContent, isDefault } = body;

    // If setting as default, unset other defaults of same type
    const templateType = type || existingTemplate.type;
    if (isDefault) {
      await db
        .update(emailTemplates)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(
          and(
            eq(emailTemplates.type, templateType),
            eq(emailTemplates.isDefault, true)
          )
        );
    }

    // Build update object
    const updateData: Partial<typeof emailTemplates.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (type !== undefined) updateData.type = type;
    if (subject !== undefined) updateData.subject = subject.trim();
    if (htmlContent !== undefined) updateData.htmlContent = htmlContent.trim();
    if (isDefault !== undefined) updateData.isDefault = isDefault;

    // Update template
    const [updatedTemplate] = await db
      .update(emailTemplates)
      .set(updateData)
      .where(eq(emailTemplates.id, id))
      .returning();

    // Log the action
    await db.insert(auditLogs).values({
      userId: admin.id,
      action: 'update',
      entityType: 'email_template',
      entityId: id,
      details: { changes: body },
    });

    return NextResponse.json({ data: updatedTemplate });
  } catch (error) {
    console.error('[Email Templates API] PATCH error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update template' },
      { status: 500 }
    );
  }
}

// DELETE /api/email-templates/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    // Check if template exists
    const [existingTemplate] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, id))
      .limit(1);

    if (!existingTemplate) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Don't allow deleting the default template
    if (existingTemplate.isDefault) {
      return NextResponse.json(
        { error: 'Cannot delete the default template. Set another template as default first.' },
        { status: 400 }
      );
    }

    // Delete template
    await db.delete(emailTemplates).where(eq(emailTemplates.id, id));

    // Log the action
    await db.insert(auditLogs).values({
      userId: admin.id,
      action: 'delete',
      entityType: 'email_template',
      entityId: id,
      details: { name: existingTemplate.name },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Email Templates API] DELETE error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete template' },
      { status: 500 }
    );
  }
}

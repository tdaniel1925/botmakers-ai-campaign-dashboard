import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVapiPhoneNumbers } from '@/services/vapi-service';

// POST - Get VAPI phone numbers (POST to avoid API key in URL)
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { apiKey } = body;

    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    const phoneNumbers = await getVapiPhoneNumbers(apiKey);

    return NextResponse.json({
      phoneNumbers: phoneNumbers.map((p) => ({
        id: p.id,
        number: p.number,
        name: p.name,
        provider: p.provider,
        assistantId: p.assistantId,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    console.error('VAPI get phone numbers error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get phone numbers' },
      { status: 500 }
    );
  }
}

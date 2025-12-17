import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getVapiAssistants } from '@/services/vapi-service';

// POST - Get VAPI assistants (POST to avoid API key in URL)
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

    const assistants = await getVapiAssistants(apiKey);

    return NextResponse.json({
      assistants: assistants.map((a) => ({
        id: a.id,
        name: a.name,
        model: a.model,
        voice: a.voice,
        firstMessage: a.firstMessage,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    console.error('VAPI get assistants error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get assistants' },
      { status: 500 }
    );
  }
}

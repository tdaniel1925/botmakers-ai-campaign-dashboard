import { NextResponse } from "next/server";
import { getAIClient, getModelName } from "@/lib/ai/deepseek";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { payload } = body;

    if (!payload) {
      return NextResponse.json(
        { error: "Payload is required" },
        { status: 400 }
      );
    }

    // If no AI API key configured, try to infer mappings automatically
    const hasAIKey = !!process.env.OPENAI_API_KEY || !!process.env.DEEPSEEK_API_KEY;
    if (!hasAIKey) {
      const parsedPayload = JSON.parse(payload);
      const mapping = inferMappings(parsedPayload);
      return NextResponse.json({ mapping });
    }

    const aiClient = getAIClient();
    const model = getModelName();

    const response = await aiClient.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: `You analyze webhook payload JSON and identify field mappings. Return only valid JSON with no markdown.`,
        },
        {
          role: "user",
          content: `Analyze this webhook payload JSON and identify the following fields:
1. transcript - The call transcript text
2. audio_url - URL to the call recording
3. caller_phone - The caller's phone number
4. call_duration - Duration of the call (in seconds)
5. timestamp - When the call occurred
6. recording_id - Any unique identifier for the call

Use dot notation for nested paths (e.g., "data.transcript" or "call.recording_url").
If a field is not found, set it to null.

Respond ONLY with a JSON object like this:
{
  "transcript": "path.to.transcript",
  "audio_url": "path.to.audio",
  "caller_phone": "path.to.phone",
  "call_duration": "path.to.duration",
  "timestamp": "path.to.timestamp",
  "recording_id": "path.to.id"
}

Payload:
${payload}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const mapping = JSON.parse(content);

    return NextResponse.json({ mapping });
  } catch (error) {
    console.error("Error analyzing payload:", error);

    // Fallback to automatic inference
    try {
      const body = await request.clone().json();
      const parsedPayload = JSON.parse(body.payload);
      const mapping = inferMappings(parsedPayload);
      return NextResponse.json({ mapping });
    } catch {
      return NextResponse.json(
        { error: "Failed to analyze payload" },
        { status: 500 }
      );
    }
  }
}

function inferMappings(
  obj: Record<string, unknown>,
  prefix = ""
): Record<string, string | null> {
  const mapping: Record<string, string | null> = {
    transcript: null,
    audio_url: null,
    caller_phone: null,
    call_duration: null,
    timestamp: null,
    recording_id: null,
  };

  const transcriptKeys = ["transcript", "transcription", "text", "message", "content"];
  const audioKeys = ["audio_url", "recording_url", "audio", "recording", "media_url", "url"];
  const phoneKeys = ["phone", "from", "caller", "phone_number", "caller_phone", "from_number"];
  const durationKeys = ["duration", "call_duration", "length", "duration_seconds"];
  const timestampKeys = ["timestamp", "created_at", "started_at", "date", "time", "call_time"];
  const idKeys = ["id", "call_id", "recording_id", "external_id", "uuid"];

  function findPath(o: unknown, currentPath: string = ""): void {
    if (o === null || o === undefined) return;

    if (typeof o === "object" && !Array.isArray(o)) {
      for (const [key, value] of Object.entries(o as Record<string, unknown>)) {
        const path = currentPath ? `${currentPath}.${key}` : key;
        const lowerKey = key.toLowerCase();

        if (!mapping.transcript && transcriptKeys.some((k) => lowerKey.includes(k))) {
          if (typeof value === "string" && value.length > 50) {
            mapping.transcript = path;
          }
        }
        if (!mapping.audio_url && audioKeys.some((k) => lowerKey.includes(k))) {
          if (typeof value === "string" && (value.startsWith("http") || value.includes("."))) {
            mapping.audio_url = path;
          }
        }
        if (!mapping.caller_phone && phoneKeys.some((k) => lowerKey.includes(k))) {
          if (typeof value === "string" && /[\d\+\-\(\)]{7,}/.test(value)) {
            mapping.caller_phone = path;
          }
        }
        if (!mapping.call_duration && durationKeys.some((k) => lowerKey.includes(k))) {
          if (typeof value === "number" || (typeof value === "string" && !isNaN(Number(value)))) {
            mapping.call_duration = path;
          }
        }
        if (!mapping.timestamp && timestampKeys.some((k) => lowerKey.includes(k))) {
          mapping.timestamp = path;
        }
        if (!mapping.recording_id && idKeys.some((k) => lowerKey === k)) {
          mapping.recording_id = path;
        }

        findPath(value, path);
      }
    }
  }

  findPath(obj, prefix);

  return mapping;
}

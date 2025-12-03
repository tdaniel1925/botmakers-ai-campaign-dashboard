import OpenAI from "openai";
import { getApiKeys, type OpenAIKeys } from "@/lib/api-keys";

// Field mapping types
export interface FieldMapping {
  transcript: string | null;
  audioUrl: string | null;
  callerPhone: string | null;
  callDuration: string | null;
  timestamp: string | null;
  externalCallId: string | null;
  callStatus: string | null;
}

export interface ExtractedFields {
  transcript: string | null;
  audioUrl: string | null;
  callerPhone: string | null;
  callDuration: number | null;
  timestamp: string | null;
  externalCallId: string | null;
  callStatus: string | null;
}

export interface AIExtractionResult {
  fields: ExtractedFields;
  suggestedMappings: FieldMapping;
  confidence: number;
}

// Helper to get value from JSON path
export function getValueByPath(obj: unknown, path: string): unknown {
  if (!path || !obj) return undefined;

  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;

    // Handle array indexing like "items[0]"
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, index] = arrayMatch;
      const record = current as Record<string, unknown>;
      const arr = record[key];
      if (Array.isArray(arr)) {
        current = arr[parseInt(index)];
      } else {
        return undefined;
      }
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current;
}

// Helper to flatten JSON into path -> value map for display
export function flattenJson(obj: unknown, prefix = ""): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (obj === null || obj === undefined) return result;

  if (typeof obj !== "object") {
    if (prefix) result[prefix] = obj;
    return result;
  }

  if (Array.isArray(obj)) {
    // Only show first 3 items of arrays
    obj.slice(0, 3).forEach((item, i) => {
      const newPrefix = prefix ? `${prefix}[${i}]` : `[${i}]`;
      Object.assign(result, flattenJson(item, newPrefix));
    });
    if (obj.length > 3) {
      result[`${prefix}[...]`] = `(${obj.length - 3} more items)`;
    }
    return result;
  }

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const newPrefix = prefix ? `${prefix}.${key}` : key;

    if (value === null || value === undefined) {
      result[newPrefix] = value;
    } else if (typeof value === "object") {
      Object.assign(result, flattenJson(value, newPrefix));
    } else {
      result[newPrefix] = value;
    }
  }

  return result;
}

// Use AI to intelligently extract fields from any JSON payload
export async function extractFieldsWithAI(
  payload: Record<string, unknown>
): Promise<AIExtractionResult> {
  const openaiKeys = await getApiKeys("openai");

  if (!openaiKeys?.apiKey) {
    // Fallback to rule-based extraction if no API key
    return fallbackExtraction(payload);
  }

  const openai = new OpenAI({ apiKey: openaiKeys.apiKey });

  const prompt = `You are analyzing a webhook payload from a voice AI calling platform. Extract the following fields and provide the JSON path to each.

The payload is:
${JSON.stringify(payload, null, 2)}

Extract these fields (provide the exact JSON path like "message.content" or "data.call.transcript"):
1. transcript - The call transcript/conversation text (could be a string or array of messages)
2. audioUrl - URL to the call recording audio file
3. callerPhone - The caller's phone number
4. callDuration - Duration of the call in seconds
5. timestamp - When the call occurred
6. externalCallId - Unique identifier for the call from the source system
7. callStatus - The call outcome/status/disposition

Respond with a JSON object with these exact fields. For each field, provide:
- "path": the JSON path to the value (e.g., "artifact.transcript" or "call.customer.phone")
- "value": the extracted value (convert arrays to readable text if needed for transcript)

If a field cannot be found, set path to null and value to null.

Important: For transcript, if it's an array of message objects, combine them into a readable conversation format.

JSON Response:`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You extract structured data from JSON payloads. Always respond with valid JSON only." },
        { role: "user", content: prompt }
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    // Parse the AI response into our format
    const fields: ExtractedFields = {
      transcript: result.transcript?.value || null,
      audioUrl: result.audioUrl?.value || null,
      callerPhone: result.callerPhone?.value || null,
      callDuration: parseNumber(result.callDuration?.value),
      timestamp: result.timestamp?.value || null,
      externalCallId: result.externalCallId?.value || null,
      callStatus: result.callStatus?.value || null,
    };

    const suggestedMappings: FieldMapping = {
      transcript: result.transcript?.path || null,
      audioUrl: result.audioUrl?.path || null,
      callerPhone: result.callerPhone?.path || null,
      callDuration: result.callDuration?.path || null,
      timestamp: result.timestamp?.path || null,
      externalCallId: result.externalCallId?.path || null,
      callStatus: result.callStatus?.path || null,
    };

    // Calculate confidence based on how many fields were found
    const foundFields = Object.values(suggestedMappings).filter(v => v !== null).length;
    const confidence = Math.round((foundFields / 7) * 100);

    return { fields, suggestedMappings, confidence };
  } catch (error) {
    console.error("AI extraction failed:", error);
    return fallbackExtraction(payload);
  }
}

// Fallback extraction using rule-based approach
function fallbackExtraction(payload: Record<string, unknown>): AIExtractionResult {
  const flattened = flattenJson(payload);
  const fields: ExtractedFields = {
    transcript: null,
    audioUrl: null,
    callerPhone: null,
    callDuration: null,
    timestamp: null,
    externalCallId: null,
    callStatus: null,
  };
  const suggestedMappings: FieldMapping = {
    transcript: null,
    audioUrl: null,
    callerPhone: null,
    callDuration: null,
    timestamp: null,
    externalCallId: null,
    callStatus: null,
  };

  // Search patterns for each field
  const patterns: Record<keyof FieldMapping, RegExp[]> = {
    transcript: [/transcript/i, /transcription/i, /text/i, /content/i, /message/i, /conversation/i],
    audioUrl: [/recording.*url/i, /audio.*url/i, /media.*url/i, /recording_url/i, /recordingUrl/i],
    callerPhone: [/phone/i, /caller/i, /from/i, /number/i, /customer.*phone/i],
    callDuration: [/duration/i, /length/i, /time/i],
    timestamp: [/timestamp/i, /created/i, /started/i, /date/i, /time/i],
    externalCallId: [/\bid\b/i, /call.*id/i, /uuid/i, /reference/i],
    callStatus: [/status/i, /outcome/i, /result/i, /disposition/i, /ended.*reason/i],
  };

  for (const [field, regexes] of Object.entries(patterns)) {
    for (const [path, value] of Object.entries(flattened)) {
      if (value === null || value === undefined) continue;

      for (const regex of regexes) {
        if (regex.test(path)) {
          const fieldKey = field as keyof FieldMapping;

          // Skip if already found a more specific match
          if (suggestedMappings[fieldKey] !== null) continue;

          suggestedMappings[fieldKey] = path;

          // Convert value appropriately
          if (fieldKey === "callDuration") {
            fields[fieldKey] = parseNumber(value);
          } else if (fieldKey === "transcript" && typeof value === "object") {
            fields[fieldKey] = JSON.stringify(value);
          } else {
            fields[fieldKey] = String(value);
          }
          break;
        }
      }
    }
  }

  const foundFields = Object.values(suggestedMappings).filter(v => v !== null).length;
  const confidence = Math.round((foundFields / 7) * 100);

  return { fields, suggestedMappings, confidence };
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

// Apply custom mappings to extract fields from payload
export function applyMappings(
  payload: Record<string, unknown>,
  mappings: FieldMapping
): ExtractedFields {
  const fields: ExtractedFields = {
    transcript: null,
    audioUrl: null,
    callerPhone: null,
    callDuration: null,
    timestamp: null,
    externalCallId: null,
    callStatus: null,
  };

  for (const [field, path] of Object.entries(mappings)) {
    if (!path) continue;

    const value = getValueByPath(payload, path);
    if (value === undefined || value === null) continue;

    const fieldKey = field as keyof ExtractedFields;

    if (fieldKey === "callDuration") {
      fields[fieldKey] = parseNumber(value);
    } else if (fieldKey === "transcript") {
      // Handle array transcripts
      if (Array.isArray(value)) {
        fields[fieldKey] = value
          .map((item: { text?: string; content?: string; sender?: string; role?: string }) => {
            const speaker = item.sender || item.role || "Unknown";
            const text = item.text || item.content || "";
            return `${speaker}: ${text}`;
          })
          .join("\n");
      } else {
        fields[fieldKey] = String(value);
      }
    } else {
      fields[fieldKey] = String(value);
    }
  }

  return fields;
}

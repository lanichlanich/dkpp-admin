import "server-only";
import { z } from "zod";

export type OpenAiPart =
  | { type: "input_text"; text: string }
  | { type: "input_file"; filename: string; file_data: string; detail: "high" }
  | { type: "input_image"; image_url: string; detail: "high" };

type OpenAiResponse = {
  status?: string;
  model?: string;
  output?: { type: string; role?: string; content?: { type: string; text?: string }[] }[];
};

export class OpenAiApiError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

export function openAiFile(name: string, mimeType: string, bytes: Buffer): OpenAiPart {
  const dataUrl = `data:${mimeType};base64,${bytes.toString("base64")}`;
  return mimeType === "application/pdf"
    ? { type: "input_file", filename: name, file_data: dataUrl, detail: "high" }
    : { type: "input_image", image_url: dataUrl, detail: "high" };
}

function strictResponseSchema(schema: z.core.JSONSchema._JSONSchema): object {
  if (typeof schema !== "object" || !schema.type || Array.isArray(schema.items)) {
    throw new OpenAiApiError("Skema respons OpenAI tidak didukung.", 503);
  }
  const { type, properties, items, enum: values, minItems, maxItems } = schema;
  // Keep the model schema structural. Application-specific constraints remain in Zod.
  return {
    type, enum: values, minItems, maxItems,
    ...(properties && {
      properties: Object.fromEntries(Object.entries(properties).map(([name, schema]) => [name, strictResponseSchema(schema)])),
      required: Object.keys(properties),
      additionalProperties: false,
    }),
    ...(items && { items: strictResponseSchema(items) }),
  };
}

export async function requestOpenAiJson(instructions: string, content: OpenAiPart[], schema: z.ZodType) {
  const key = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini";
  if (!key) throw new OpenAiApiError("API key OpenAI belum dikonfigurasi di server.", 503);
  const format = { type: "json_schema", name: "result", strict: true, schema: strictResponseSchema(z.toJSONSchema(schema)) };

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
      body: JSON.stringify({
        model,
        instructions,
        input: [{ role: "user", content }],
        store: false,
        max_output_tokens: 8192,
        text: { format },
      }),
    });
  } catch {
    throw new OpenAiApiError("OpenAI tidak dapat dihubungi atau waktu tunggu habis. Silakan coba kembali.", 504);
  }

  if (!response.ok) {
    if (response.status === 429) throw new OpenAiApiError("Kuota atau batas permintaan OpenAI tercapai. Periksa kuota proyek atau coba lagi nanti.", 429);
    if ([401, 403].includes(response.status)) throw new OpenAiApiError("OpenAI menolak akses. Periksa API key dan izin proyek di server.", 503);
    if (response.status === 404) throw new OpenAiApiError("Model OpenAI tidak tersedia. Periksa OPENAI_MODEL dan akses proyek.", 503);
    if ([400, 413, 422].includes(response.status)) throw new OpenAiApiError("OpenAI menolak permintaan. Periksa format dokumen dan konfigurasi model di server.");
    throw new OpenAiApiError("Layanan OpenAI sedang bermasalah. Silakan coba kembali.");
  }

  const invalidResponse = "Jawaban OpenAI tidak lengkap atau tidak sesuai format. Silakan coba kembali.";
  try {
    const body: OpenAiResponse = await response.json();
    if (body?.status !== "completed") throw new OpenAiApiError(invalidResponse);
    const parts = body.output?.filter(item => item.type === "message" && item.role === "assistant").flatMap(item => item.content ?? []) ?? [];
    if (parts.some(part => part.type === "refusal")) throw new OpenAiApiError("OpenAI tidak dapat memproses permintaan ini. Lengkapi isian secara manual atau periksa dokumen.", 422);
    const value: unknown = JSON.parse(parts.filter(part => part.type === "output_text").map(part => part.text ?? "").join(""));
    return { value, model: body.model || model };
  } catch (error) {
    if (error instanceof OpenAiApiError) throw error;
    throw new OpenAiApiError(invalidResponse);
  }
}

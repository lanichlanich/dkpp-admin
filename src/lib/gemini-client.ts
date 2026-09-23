import "server-only";
export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };
export class GeminiApiError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}
export async function requestGeminiJson(instructions: string, parts: GeminiPart[], schema: object) {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  if (!key) throw new GeminiApiError("API key Gemini belum dikonfigurasi di server.", 503);
  if (!/^gemini-[a-z0-9.-]+$/.test(model)) throw new GeminiApiError("Konfigurasi model Gemini tidak valid.", 503);
  let response: Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      cache: "no-store", signal: AbortSignal.timeout(120000),
      body: JSON.stringify({ systemInstruction: { parts: [{ text: instructions }] }, contents: [{ role: "user", parts }], generationConfig: { temperature: 0.1, maxOutputTokens: 8192, responseMimeType: "application/json", responseJsonSchema: schema } }),
    });
  } catch { throw new GeminiApiError("Gemini tidak dapat dihubungi atau waktu tunggu habis. Silakan coba kembali.", 504); }
  if (!response.ok) {
    if (response.status === 429) throw new GeminiApiError("Kuota atau batas permintaan Gemini tercapai. Periksa kuota proyek atau coba lagi nanti.", 429);
    if ([400, 401, 403].includes(response.status)) throw new GeminiApiError("Gemini menolak permintaan. Periksa API key, izin API, dan konfigurasi model di server.", 503);
    if (response.status === 404) throw new GeminiApiError("Model Gemini tidak tersedia. Periksa GEMINI_MODEL di server.", 503);
    throw new GeminiApiError("Layanan Gemini sedang bermasalah. Silakan coba kembali.");
  }
  try {
    const body = await response.json();
    const candidate = body.candidates?.[0];
    if (candidate?.finishReason !== "STOP") throw new Error("Incomplete response");
    const value: unknown = JSON.parse(candidate.content.parts.filter((part: { thought?: boolean }) => !part.thought).map((part: { text?: string }) => part.text || "").join(""));
    return { value, model };
  } catch { throw new GeminiApiError("Jawaban Gemini tidak lengkap atau tidak sesuai format. Silakan coba kembali."); }
}

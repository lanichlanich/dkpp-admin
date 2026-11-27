import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { checkApiAccess } from "@/lib/authorization";

export const runtime = "nodejs";
const assets = {
  "pdf.min.mjs": { path: "build/pdf.min.mjs", type: "text/javascript; charset=utf-8" },
  "pdf.worker.min.mjs": { path: "build/pdf.worker.min.mjs", type: "text/javascript; charset=utf-8" },
  "jbig2.wasm": { path: "wasm/jbig2.wasm", type: "application/wasm" },
  "openjpeg.wasm": { path: "wasm/openjpeg.wasm", type: "application/wasm" },
} as const;

export async function GET(_request: Request, { params }: { params: Promise<{ asset: string }> }) {
  const denied = await checkApiAccess(["merge-pdf", "split-pdf"]);
  if (denied) return denied;
  const { asset } = await params;
  if (!Object.hasOwn(assets, asset)) return new Response(null, { status: 404 });
  const { path, type } = assets[asset as keyof typeof assets];
  try {
    const bytes = await readFile(join(process.cwd(), "node_modules", "pdfjs-dist", path));
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": type, "Cache-Control": "private, no-cache", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response(null, { status: 503 });
  }
}

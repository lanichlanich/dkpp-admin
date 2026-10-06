import { listAuditLogs } from "@/lib/audit-logs";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });
  const query = new URL(request.url).searchParams;
  const parsedOffset = Number(query.get("offset") ?? 0);
  if (!Number.isSafeInteger(parsedOffset) || parsedOffset < 0) {
    return Response.json({ message: "Posisi halaman tidak valid." }, { status: 400 });
  }
  return Response.json(await listAuditLogs(parsedOffset));
}

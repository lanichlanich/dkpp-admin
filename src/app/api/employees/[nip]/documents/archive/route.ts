import PizZip from "pizzip";
import { db } from "@/lib/db";
import { getEmployeeDocumentsForArchive } from "@/lib/employee-documents";
import { getCurrentUser } from "@/lib/session";

export const runtime = "nodejs";

function safeFileNamePart(value: string, fallback: string) {
  const sanitized = value
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 120);
  return sanitized || fallback;
}

function contentDisposition(fileName: string) {
  const fallback = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function uniqueFileName(fileName: string, usedNames: Set<string>) {
  const safeName = safeFileNamePart(fileName, "dokumen");
  const dotIndex = safeName.lastIndexOf(".");
  const baseName = dotIndex > 0 ? safeName.slice(0, dotIndex) : safeName;
  const extension = dotIndex > 0 ? safeName.slice(dotIndex) : "";
  let candidate = safeName;
  let sequence = 2;
  while (usedNames.has(candidate.toLocaleLowerCase("id-ID"))) {
    candidate = `${baseName}-${sequence}${extension}`;
    sequence += 1;
  }
  usedNames.add(candidate.toLocaleLowerCase("id-ID"));
  return candidate;
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/employees/[nip]/documents/archive">,
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });

  const { nip } = await context.params;
  const employee = db.prepare("SELECT nip, name FROM employees WHERE nip = ?").get(nip) as {
    nip: string;
    name: string;
  } | undefined;
  if (!employee) return Response.json({ message: "Pegawai tidak ditemukan." }, { status: 404 });

  try {
    const documents = await getEmployeeDocumentsForArchive(employee.nip);
    if (documents.length === 0) {
      return Response.json({ message: "Pegawai belum memiliki dokumen untuk diunduh." }, { status: 404 });
    }

    const zip = new PizZip();
    const usedNames = new Set<string>();
    for (const document of documents) {
      zip.file(uniqueFileName(document.fileName, usedNames), document.file);
    }
    const archive = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
    const archiveName = `${safeFileNamePart(employee.nip, "NIP")}_${safeFileNamePart(employee.name, "Pegawai")}.zip`;

    return new Response(new Uint8Array(archive), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": contentDisposition(archiveName),
        "Content-Length": String(archive.length),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Employee document archive download failed", error);
    return Response.json({ message: "Satu atau lebih file dokumen tidak tersedia." }, { status: 404 });
  }
}

import { z } from "zod";
import { createNotification } from "@/lib/notifications";
import { db } from "@/lib/db";
import {
  EMPLOYEE_DOCUMENT_TYPE_LABELS,
  EMPLOYEE_DOCUMENT_TYPES,
  SKP_ASSESSMENT_VALUES,
  SKP_PREDICATE_VALUES,
  employeeDocumentIsSkp,
  employeeDocumentNeedsServicePeriod,
  getAllowedEmployeeDocumentTypes,
  type SkpAssessment,
  type SkpPredicate,
} from "@/lib/employee-document-types";
import {
  getEmployeeDocuments,
  saveEmployeeDocument,
  validateEmployeeDocumentFile,
} from "@/lib/employee-documents";
import { getCurrentUser } from "@/lib/session";
import { MAX_MULTIPART_REQUEST_SIZE_BYTES, MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from "@/lib/upload-limits";

export const runtime = "nodejs";

const dateText = z.string().trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Tanggal tidak valid.");
const standardUploadSchema = z.object({
  nomorSurat: z.string().trim().min(1, "Nomor surat wajib diisi.").max(200, "Nomor surat terlalu panjang."),
  tglSurat: dateText,
  tmtSurat: dateText,
  masaKerja: z.string().trim().max(100, "Masa kerja terlalu panjang."),
});
const skpUploadSchema = z.object({
  tahun: z.string().trim()
    .regex(/^\d{4}$/, "Tahun harus terdiri dari 4 angka.")
    .transform(Number)
    .refine((value) => value >= 1900 && value <= 2100, "Tahun harus antara 1900 dan 2100."),
  penilaianKinerja: z.enum(SKP_ASSESSMENT_VALUES, { error: "Pilih penilaian kinerja." }),
  penilaianPerilaku: z.enum(SKP_ASSESSMENT_VALUES, { error: "Pilih penilaian perilaku." }),
  predikatSkp: z.enum(SKP_PREDICATE_VALUES, { error: "Pilih predikat SKP." }),
});

type EmployeeRow = { nip: string; name: string; asn_type: string };

function getEmployee(nip: string) {
  return db.prepare("SELECT nip, name, asn_type FROM employees WHERE nip = ?").get(nip) as EmployeeRow | undefined;
}

export async function GET(_request: Request, context: RouteContext<"/api/employees/[nip]/documents">) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });

  const { nip } = await context.params;
  const employee = getEmployee(nip);
  if (!employee) return Response.json({ message: "Pegawai tidak ditemukan." }, { status: 404 });
  return Response.json({ documents: getEmployeeDocuments(employee.nip) });
}

export async function POST(request: Request, context: RouteContext<"/api/employees/[nip]/documents">) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_MULTIPART_REQUEST_SIZE_BYTES) {
    return Response.json({ message: `Ukuran unggahan melebihi batas ${MAX_UPLOAD_SIZE_MB} MB.` }, { status: 413 });
  }

  const { nip } = await context.params;
  const employee = getEmployee(nip);
  if (!employee) return Response.json({ message: "Pegawai tidak ditemukan." }, { status: 404 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ message: "Data unggahan tidak valid." }, { status: 400 });
  }

  const documentTypeResult = z.enum(EMPLOYEE_DOCUMENT_TYPES).safeParse(formData.get("documentType"));
  if (!documentTypeResult.success) {
    return Response.json({ message: "Pilih jenis dokumen yang valid.", errors: { documentType: ["Jenis dokumen tidak valid."] } }, { status: 422 });
  }
  const documentType = documentTypeResult.data;

  const allowedTypes = getAllowedEmployeeDocumentTypes(employee.asn_type);
  if (!allowedTypes.includes(documentType)) {
    return Response.json({ message: `Jenis dokumen tidak sesuai untuk ASN ${employee.asn_type}.` }, { status: 422 });
  }

  let nomorSurat = "";
  let tglSurat = "";
  let tmtSurat = "";
  let masaKerja: string | null = null;
  let tahun: number | null = null;
  let penilaianKinerja: SkpAssessment | null = null;
  let penilaianPerilaku: SkpAssessment | null = null;
  let predikatSkp: SkpPredicate | null = null;

  if (employeeDocumentIsSkp(documentType)) {
    const result = skpUploadSchema.safeParse({
      tahun: formData.get("tahun"),
      penilaianKinerja: formData.get("penilaianKinerja"),
      penilaianPerilaku: formData.get("penilaianPerilaku"),
      predikatSkp: formData.get("predikatSkp"),
    });
    if (!result.success) {
      return Response.json({ message: "Periksa kembali penilaian SKP.", errors: result.error.flatten().fieldErrors }, { status: 422 });
    }
    tahun = result.data.tahun;
    penilaianKinerja = result.data.penilaianKinerja;
    penilaianPerilaku = result.data.penilaianPerilaku;
    predikatSkp = result.data.predikatSkp;
  } else {
    const result = standardUploadSchema.safeParse({
      nomorSurat: formData.get("nomorSurat"),
      tglSurat: formData.get("tglSurat"),
      tmtSurat: formData.get("tmtSurat"),
      masaKerja: formData.get("masaKerja") ?? "",
    });
    if (!result.success) {
      return Response.json({ message: "Periksa kembali isian dokumen.", errors: result.error.flatten().fieldErrors }, { status: 422 });
    }
    nomorSurat = result.data.nomorSurat;
    tglSurat = result.data.tglSurat;
    tmtSurat = result.data.tmtSurat;
    masaKerja = employeeDocumentNeedsServicePeriod(documentType) ? result.data.masaKerja : null;
    if (employeeDocumentNeedsServicePeriod(documentType) && !masaKerja) {
      return Response.json({ message: "Masa kerja wajib diisi untuk dokumen PNS.", errors: { masaKerja: ["Masa kerja wajib diisi."] } }, { status: 422 });
    }
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ message: "Pilih file dokumen yang akan diunggah.", errors: { file: ["File wajib dipilih."] } }, { status: 422 });
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    const message = `Ukuran file maksimal ${MAX_UPLOAD_SIZE_MB} MB.`;
    return Response.json({ message, errors: { file: [message] } }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const fileError = validateEmployeeDocumentFile(file, bytes);
  if (fileError) return Response.json({ message: fileError, errors: { file: [fileError] } }, { status: 422 });

  try {
    const document = await saveEmployeeDocument({
      userId: user.id,
      employeeNip: employee.nip,
      documentType,
      nomorSurat,
      tglSurat,
      tmtSurat,
      masaKerja,
      tahun,
      penilaianKinerja,
      penilaianPerilaku,
      predikatSkp,
      file,
      bytes,
    });
    createNotification(user.id, "success", "Dokumen pegawai diunggah", `${EMPLOYEE_DOCUMENT_TYPE_LABELS[documentType]} ${employee.name} berhasil disimpan.`);
    return Response.json({ document }, { status: 201 });
  } catch (error) {
    console.error("Employee document upload failed", error);
    createNotification(user.id, "error", "Unggah dokumen gagal", `Dokumen ${employee.name} gagal disimpan.`);
    return Response.json({ message: "Dokumen gagal disimpan. Silakan coba kembali." }, { status: 500 });
  }
}

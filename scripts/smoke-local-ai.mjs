import { createHash, randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import Database from "better-sqlite3";
import PizZip from "pizzip";
import { readFileSync } from "node:fs";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const database = new Database(path.join(process.cwd(), "data", "admin.db"));
const userId = `local-ai-smoke-${randomUUID()}`;
const token = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(token).digest("hex");
const now = new Date();
const expiresAt = new Date(now.getTime() + 5 * 60_000);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sampleDocument() {
  const canvas = createCanvas(1500, 560);
  const context = canvas.getContext("2d");
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "black";
  context.font = "42px Arial";
  [
    "KEPUTUSAN BUPATI INDRAMAYU",
    "Nomor: 800.1.11.13/3023/Sekret tanggal 8 September 2026",
    "Nama: PEGAWAI UJI LOKAL",
    "NIP: 197105212009011002",
    "Terhitung mulai tanggal 1 Oktober 2026",
    "Masa kerja golongan: 14 Tahun 2 Bulan",
  ].forEach((line, index) => context.fillText(line, 45, 75 + index * 80));
  return canvas.toBuffer("image/png");
}

function samplePdf() {
  const lines = ["KEPUTUSAN UJI", "Nama: PEGAWAI UJI LOKAL", "NIP: 197105212009011002", "Nomor: 800/TEST/2026", "Tanggal penetapan: 8 September 2026", "Terhitung mulai tanggal 1 Oktober 2026", "Masa kerja golongan: 14 Tahun 2 Bulan"];
  const stream = "BT /F1 12 Tf 40 790 Td 20 TL " + lines.map((s,i)=>(i?"T* ":"")+"("+s+") Tj").join(" ") + " ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Length "+Buffer.byteLength(stream)+" >>\nstream\n"+stream+"\nendstream"
  ];
  let pdf = "%PDF-1.4\n";
  const offsets=[0];
  objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=(i+1)+" 0 obj\n"+o+"\nendobj\n";});
  const start=Buffer.byteLength(pdf);
  pdf+="xref\n0 6\n0000000000 65535 f \n"+offsets.slice(1).map(n=>String(n).padStart(10,"0")+" 00000 n \n").join("")+"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n"+start+"\n%%EOF";
  return Buffer.from(pdf);
}

try {
  database.prepare(
    `INSERT INTO users (id, name, username, email, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(userId, "Local AI Smoke Test", userId, `${userId}@example.test`, "not-used", now.toISOString(), now.toISOString());
  database.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
  ).run(tokenHash, userId, expiresAt.toISOString(), now.toISOString());

  const formData = new FormData();
  formData.set("kind", "employee-document");
  formData.set("employeeName", "PEGAWAI UJI LOKAL");
  formData.set("employeeNip", "197105212009011002");
  formData.set("documentType", "SK PNS Pertama");
  formData.set("file", new File([sampleDocument()], "sk-pns-smoke.png", { type: "image/png" }));

  const send = (form, endpoint = "/api/document-ai/extract", authenticated = true) => fetch(baseUrl + endpoint, { method: "POST", headers: authenticated ? { Cookie: `admin_session=${token}` } : {}, body: form });
  assert((await send(formData, "/api/document-ai/extract", false)).status === 401, "Extraction requires authentication");
  const invalid = new FormData();
  invalid.set("kind", "dpcp");
  invalid.set("file", new File(["not a PDF"], "invalid.pdf"));
  assert((await send(invalid)).status === 422, "Invalid PDF must be rejected");
  const response = await fetch(`${baseUrl}/api/document-ai/extract`, {
    method: "POST",
    headers: { Cookie: `admin_session=${token}` },
    body: formData,
  });
  const payload = await response.json();
  assert(response.status === 200, `Pembacaan Gemini gagal (${response.status}): ${payload.message ?? ""}`);
  assert(payload.localOnly === false, "Respons tidak ditandai sebagai pemrosesan Gemini.");
  assert(payload.values.nomorSurat === "800.1.11.13/3023/Sekret", `Nomor surat tidak tepat: ${payload.values.nomorSurat}`);
  assert(payload.values.tglSurat === "2026-09-08", `Tanggal surat tidak tepat: ${payload.values.tglSurat}`);
  assert(payload.values.tmtSurat === "2026-10-01", `TMT tidak tepat: ${payload.values.tmtSurat}`);
  assert(payload.values.masaKerja === "14 Tahun 2 Bulan", `Masa kerja tidak tepat: ${payload.values.masaKerja}`);
  assert(payload.sources.some((source) => source.method === "gemini"), "Sumber tidak tercatat sebagai Gemini.");
  formData.set("file",new File([samplePdf()],"synthetic.pdf",{type:"application/pdf"}));
  const pdfResponse = await send(formData);
  const pdf = await pdfResponse.json();
  assert(pdfResponse.ok && pdf.values.nomorSurat === "800/TEST/2026", "Native PDF extraction failed: "+JSON.stringify(pdf));
  const doc = new PizZip(readFileSync("src/templates/template-wfh-report.docx"));
  const lines = ["DOKUMEN UJI SINTETIS", "Nama: PEGAWAI UJI LOKAL", "NIP: 197105212009011002", "Tempat lahir: INDRAMAYU", "Gaji pokok: Rp 3.456.700", "TMT PNS: 1 Januari 2009", "Masa kerja golongan: 14 Tahun 2 Bulan", "Alamat pensiun: Jalan Uji Nomor 1"];
  doc.file("word/document.xml", '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + lines.map(line=>"<w:p><w:r><w:t>"+line+"</w:t></w:r></w:p>").join("") + "</w:body></w:document>");
  const dpcp = new FormData();
  dpcp.set("kind","dpcp");
  dpcp.set("employeeName","PEGAWAI UJI LOKAL");
  dpcp.set("employeeNip","197105212009011002");
  dpcp.set("files", new File([doc.generate({type:"nodebuffer"})],"synthetic-dpcp.docx"));
  const dpcpResponse = await send(dpcp, "/api/local-ai/extract");
  const extracted = await dpcpResponse.json();
  assert(dpcpResponse.ok, "DOCX/DPCP extraction failed: "+JSON.stringify(extracted));
  assert(extracted.localOnly === false, "Legacy endpoint must use Gemini");
  assert(extracted.values.gaji === "3456700", "Salary parsing failed");
  assert(extracted.values.tmtpns === "2009-01-01", "PNS date failed");
  assert(extracted.values.namaPasangan === "", "Missing facts must stay empty");
  dpcp.set("employeeName","ORANG LAIN");
  dpcp.set("employeeNip","199001012020011001");
  const mismatchResponse = await send(dpcp);
  const mismatch = await mismatchResponse.json();
  assert(mismatchResponse.ok, "Mismatch check request failed");
  assert(Object.values(mismatch.values).every(v=>v === ""), "Mismatched identity must not fill fields");
  assert(mismatch.warnings.length > 0, "Mismatch warning required");
  console.log(`Smoke test berhasil: Gemini + ${payload.model} mengisi empat metadata dokumen dengan tepat.`);
  console.log("PDF, DOCX/DPCP, legacy alias, identity mismatch, missing facts, file validation and authentication passed.");
} finally {
  database.prepare("DELETE FROM users WHERE id = ?").run(userId);
  database.close();
}

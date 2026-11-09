import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import Module, { createRequire } from "node:module";
import path from "node:path";
import Database from "better-sqlite3";
import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import ts from "typescript";

const require = createRequire(import.meta.url);
const db = new Database(":memory:");
const cache = new Map();
const today = "2026-11-09";
let actor = null;
let reads = 0;
db.pragma("foreign_keys=ON");
db.exec("CREATE TABLE users(id TEXT PRIMARY KEY)");

function load(file) {
  const filename = path.resolve(file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename);
  cache.set(filename, mod);
  mod.require = name => {
    if (name === "server-only" || name === "next/cache") return {};
    if (name === "next/navigation") return { redirect: () => { throw Error("Unexpected redirect"); } };
    if (name === "@/lib/session") return { getCurrentUser: async () => actor, requireUser: async () => actor };
    if (name === "@/lib/plt-dates") return { jakartaToday: () => today };
    if (name === "@/lib/database") return { database: { prepare: sql => ({
      all: async (...values) => { reads++; return db.prepare(sql).all(...values); },
    }) } };
    if (name.startsWith("@/")) return load(`src/${name.slice(2)}.ts`);
    return require(name);
  };
  const source = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  mod._compile(source, filename);
  return mod.exports;
}

const request = (report, query) => api.GET(new Request(`http://localhost/api/library/reports/${report}?${query}`),
  { params: Promise.resolve({ report }) });
const actorWith = (...menuPermissions) => ({ id: "tester", isAdministrator: false, menuPermissions });
const api = load("src/app/api/library/reports/[report]/route.ts");
db.exec(load("src/lib/library-schema.ts").LIBRARY_SCHEMA);

try {
  for (const [kind, menu] of [["books", "buku"], ["visitors", "pengunjung"], ["loans", "peminjaman"]]) {
    actor = null;
    assert.equal((await request(kind, "format=pdf&month=2025-12")).status, 401);
    actor = actorWith("perpustakaan-statistik");
    assert.equal((await request(kind, "format=xlsx&month=2025-12")).status, 403);
    actor = actorWith(`perpustakaan-${menu}`);
    assert.equal((await request(kind, "format=csv&month=2025-12")).status, 400);
  }
  actor = actorWith("perpustakaan-peminjaman");
  for (const month of ["", "2025-13", "2025-2", "2025-12-01", "2025-12' OR 1=1"]) {
    assert.equal((await request("loans", `format=pdf&month=${encodeURIComponent(month)}`)).status, 400);
  }
  assert.equal(reads, 0, "Denied or invalid exports must not read the database");

  const book = db.prepare(`INSERT INTO library_books(id,inventory_code,title,publication_year,publication_place,publisher,isbn,category,copies,shelf,notes,is_active,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (let i = 1; i <= 55; i++) {
    book.run(`book${i}`, String(i).padStart(5, "0"), i === 1 ? "Budidaya Padi di Kabupaten Indramayu" : `Buku Pertanian ${String(i).padStart(2, "0")}`,
      "2024", "Indramayu", "Penerbit Contoh", i === 1 ? "0001234567890" : "", "Pertanian", 5, "Rak A",
      "Rujukan untuk penyuluh dan pengelola koleksi.", i === 2 ? 0 : 1, today, today);
  }
  const visitor = db.prepare(`INSERT INTO library_visitors(id,card_number,employee_nip,name,organization,phone,address,is_active,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?)`);
  visitor.run("v1", "DKPP-0000000000000001", "199001012020121001", "Pengunjung Contoh", "Unit Pelayanan Umum", "081234567890",
    "Jl. Contoh Nomor 23, Kecamatan Indramayu", 1, today, today);
  visitor.run("v2", "DKPP-0000000000000002", null, "=1+1", "", "0010001000", "", 0, today, today);
  const loan = db.prepare(`INSERT INTO library_loans(id,book_id,visitor_id,quantity,loan_date,due_date,return_date,notes,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?)`);
  loan.run("before", "book1", "v1", 1, "2025-11-30", "2025-12-10", "2025-12-01", "Di luar bulan awal", today, today);
  loan.run("first", "book1", "v1", 1, "2025-12-01", "2025-12-10", "2026-01-05", "Kembali di bulan berikutnya", today, today);
  loan.run("middle", "book2", "v1", 2, "2025-12-20", "2025-12-29", null, "Belum kembali", today, today);
  loan.run("last", "book3", "v1", 3, "2025-12-31", today, null, "", today, today);
  loan.run("after", "book4", "v1", 1, "2026-01-01", "2026-01-10", null, "Di luar bulan akhir", today, today);

  const sampleDirectory = process.env.SMOKE_LIBRARY_REPORT_DIR;
  if (sampleDirectory) await mkdir(sampleDirectory, { recursive: true });
  const sheets = {};
  for (const [kind, menu, count] of [["books", "buku", 55], ["visitors", "pengunjung", 2], ["loans", "peminjaman", 3]]) {
    actor = actorWith(`perpustakaan-${menu}`);
    for (const format of ["pdf", "xlsx"]) {
      const response = await request(kind, `format=${format}&month=2025-12`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.match(response.headers.get("content-disposition"), /^attachment; filename=/);
      if (kind === "loans") assert(response.headers.get("content-disposition").includes("2025-12"));
      const bytes = Buffer.from(await response.arrayBuffer());
      if (sampleDirectory) await writeFile(path.join(sampleDirectory, `${kind}.${format}`), bytes);
      if (format === "pdf") {
        assert.equal(response.headers.get("content-type"), "application/pdf");
        const document = await PDFDocument.load(bytes);
        assert(document.getPage(0).getWidth() > document.getPage(0).getHeight());
        assert(kind === "books" ? document.getPageCount() > 1 : document.getPageCount() === 1);
      } else {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(bytes);
        const sheet = workbook.worksheets[0];
        assert.equal(sheet.actualRowCount, count + 4);
        assert.equal(sheet.views[0].ySplit, 4);
        assert(sheet.autoFilter);
        sheets[kind] = sheet;
      }
    }
  }
  const firstBook = sheets.books.getRows(5, 55).find(row => row.getCell(2).value === "00001");
  assert.equal(firstBook.getCell(4).value, "0001234567890");
  assert.equal(firstBook.getCell(10).value, 5);
  assert(sheets.books.getRows(5, 55).some(row => row.getCell(13).value === "Nonaktif"));
  const employee = sheets.visitors.getRows(5, 2).find(row => row.getCell(4).value === "Pegawai");
  assert.equal(employee.getCell(5).value, "199001012020121001");
  assert.equal(employee.getCell(7).value, "081234567890");
  assert(sheets.visitors.getRows(5, 2).some(row => row.getCell(3).value === "=1+1" && row.getCell(3).type === ExcelJS.ValueType.String));
  assert.deepEqual(sheets.loans.getRows(5, 3).map(row => row.getCell(7).value.toISOString().slice(0, 10)),
    ["2025-12-31", "2025-12-20", "2025-12-01"]);
  assert.deepEqual(sheets.loans.getRows(5, 3).map(row => row.getCell(10).value), ["Dipinjam", "Terlambat", "Dikembalikan"]);
  assert.equal(sheets.loans.getCell("I7").value.toISOString().slice(0, 10), "2026-01-05");
  assert.match(sheets.loans.getCell("A3").value, /3 transaksi \| 6 eksemplar/);

  const empty = await request("loans", "format=xlsx&month=2024-02");
  assert.equal(empty.status, 200);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await empty.arrayBuffer()));
  assert.match(workbook.worksheets[0].getCell("A5").value, /Tidak ada transaksi/);
  console.log("PASS library reports: private menu permissions, period validation, PDF pagination, XLSX text identifiers and native dates, month boundaries, cross-month returns, current status, and empty reports.");
} finally {
  db.close();
}

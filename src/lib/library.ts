import "server-only";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { database as db } from "@/lib/database";
import { requireMenuAccess } from "@/lib/authorization";
import { jakartaToday } from "@/lib/plt-dates";
import { bookSchema, visitorSchema, visitSchema, loanSchema, returnSchema, libraryCardsSchema, type LibraryBook, type PublicLibraryBook, type LibraryVisitor, type LibraryCardVisitor, type LibraryVisit, type LibraryLoan, type LibraryEmployee } from "@/lib/library-types";

export class LibraryError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const borrowed = `(SELECT COALESCE(SUM(l.quantity), 0) FROM library_loans l WHERE l.book_id = b.id AND l.return_date IS NULL)`;
const booksSelect = `SELECT b.id, b.inventory_code AS inventoryCode, b.title, b.publication_year AS publicationYear,
  b.publication_place AS publicationPlace, b.publisher, b.isbn, b.category, b.copies, b.shelf, b.notes,
  b.is_active AS isActive, b.updated_at AS updatedAt, ${borrowed} AS borrowed, b.copies - ${borrowed} AS available FROM library_books b`;
const visitorsSelect = `SELECT id, card_number AS cardNumber, employee_nip AS employeeNip, name, organization, phone, address,
  is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt FROM library_visitors`;
function refresh() {
  revalidatePath("/perpustakaan");
  for (const path of ["buku", "pengunjung", "peminjaman"]) revalidatePath(`/dashboard/perpustakaan/${path}`);
}
export async function getPublicLibraryBooks(): Promise<PublicLibraryBook[]> {
  // Deliberate allowlist: this public query never reads visitors, employees, or loan identities.
  const rows = await db.prepare(`SELECT b.id, b.inventory_code AS inventoryCode, b.title, b.publication_year AS publicationYear,
    b.publication_place AS publicationPlace, b.publisher, b.isbn, b.category, b.copies, b.shelf,
    ${borrowed} AS borrowed, b.copies - ${borrowed} AS available FROM library_books b WHERE b.is_active = 1 ORDER BY b.title COLLATE NOCASE`).all<PublicLibraryBook>();
  return rows;
}
export async function getLibraryBooks() {
  await requireMenuAccess("perpustakaan-buku");
  return db.prepare(`${booksSelect} ORDER BY b.title COLLATE NOCASE`).all<LibraryBook>();
}
export async function getLibraryVisitors() {
  await requireMenuAccess("perpustakaan-pengunjung");
  return db.prepare(`${visitorsSelect} ORDER BY name COLLATE NOCASE`).all<LibraryVisitor>();
}
export async function getLibraryVisitor(id: string) {
  await requireMenuAccess("perpustakaan-pengunjung");
  const row = await db.prepare(`${visitorsSelect} WHERE id = ?`).get<LibraryVisitor>(id);
  if (!row) throw new LibraryError("Pengunjung tidak ditemukan.", 404);
  return row;
}
export async function getLibraryCardVisitors(input: unknown) {
  await requireMenuAccess("perpustakaan-pengunjung");
  const { visitorIds } = libraryCardsSchema.parse(input);
  const rows = await db.prepare(`SELECT id, card_number AS cardNumber, name, organization FROM library_visitors
    WHERE id IN (${visitorIds.map(() => "?").join(", ")})`).all<LibraryCardVisitor>(...visitorIds);
  if (rows.length !== visitorIds.length) throw new LibraryError("Sebagian pengunjung yang dipilih sudah tidak tersedia. Muat ulang daftar, lalu pilih kembali.", 409);
  const byId = new Map(rows.map(row => [row.id, row]));
  return visitorIds.map(id => byId.get(id)!);
}
export async function getLibraryVisits() {
  await requireMenuAccess("perpustakaan-pengunjung");
  return db.prepare(`SELECT v.id, v.visitor_id AS visitorId, p.name, p.card_number AS cardNumber, v.visit_date AS visitDate, v.purpose
    FROM library_visits v JOIN library_visitors p ON p.id = v.visitor_id ORDER BY v.visit_date DESC, v.created_at DESC`).all<LibraryVisit>();
}
export async function getLibraryEmployees() {
  await requireMenuAccess("perpustakaan-pengunjung");
  return db.prepare("SELECT nip, name, unit FROM employees WHERE status = 'Aktif' ORDER BY name COLLATE NOCASE").all<LibraryEmployee>();
}
export async function getLibraryLoans() {
  await requireMenuAccess("perpustakaan-peminjaman");
  return db.prepare(`SELECT l.id, l.book_id AS bookId, l.visitor_id AS visitorId, b.title, b.inventory_code AS inventoryCode,
    v.name, v.card_number AS cardNumber, l.quantity, l.loan_date AS loanDate, l.due_date AS dueDate,
    l.return_date AS returnDate, l.notes FROM library_loans l JOIN library_books b ON b.id = l.book_id
    JOIN library_visitors v ON v.id = l.visitor_id ORDER BY l.loan_date DESC, l.created_at DESC`).all<LibraryLoan>();
}
export async function getLibraryLoanOptions() {
  await requireMenuAccess("perpustakaan-peminjaman");
  const [books, visitors] = await Promise.all([
    db.prepare(`${booksSelect} WHERE b.is_active = 1 ORDER BY b.title COLLATE NOCASE`).all<LibraryBook>(),
    db.prepare("SELECT id, card_number AS cardNumber, name FROM library_visitors WHERE is_active = 1 ORDER BY name COLLATE NOCASE").all<Pick<LibraryVisitor, "id" | "cardNumber" | "name">>(),
  ]);
  return { books, visitors };
}
function version(input: unknown) {
  const value = (input as { updatedAt?: unknown })?.updatedAt;
  if (typeof value !== "string" || !value) throw new LibraryError("Versi data tidak tersedia. Muat ulang halaman.", 409);
  return value;
}
export async function saveLibraryBook(input: unknown, id?: string) {
  await requireMenuAccess("perpustakaan-buku");
  const d = bookSchema.parse(input), now = new Date().toISOString(), bookId = id ?? randomUUID();
  const values = [d.inventoryCode, d.title, d.publicationYear, d.publicationPlace, d.publisher, d.isbn, d.category, d.copies, d.shelf, d.notes, Number(d.isActive), now];
  const result = id ? await db.prepare(`UPDATE library_books SET inventory_code = ?, title = ?, publication_year = ?, publication_place = ?,
    publisher = ?, isbn = ?, category = ?, copies = ?, shelf = ?, notes = ?, is_active = ?, updated_at = ? WHERE id = ? AND updated_at = ?
    AND ? >= (SELECT COALESCE(SUM(quantity),0) FROM library_loans WHERE book_id = ? AND return_date IS NULL)`)
    .run(...values, id, version(input), d.copies, id)
    : await db.prepare(`INSERT INTO library_books (inventory_code, title, publication_year, publication_place, publisher, isbn, category, copies,
      shelf, notes, is_active, updated_at, id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(...values, bookId, now);
  if (!result.changes) throw new LibraryError("Data berubah atau jumlah eksemplar lebih kecil daripada buku yang sedang dipinjam. Muat ulang daftar.", 409);
  refresh(); return bookId;
}
export async function deleteLibraryBook(id: string, input: unknown) {
  await requireMenuAccess("perpustakaan-buku");
  if ((input as { confirmed?: unknown })?.confirmed !== true) throw new LibraryError("Konfirmasi penghapusan diperlukan.");
  const result = await db.prepare(`DELETE FROM library_books WHERE id = ? AND updated_at = ?
    AND NOT EXISTS (SELECT 1 FROM library_loans WHERE book_id = ?)`).run(id, version(input), id);
  if (!result.changes) throw new LibraryError("Buku berubah atau memiliki riwayat peminjaman. Nonaktifkan buku melalui Edit untuk menyimpan riwayat.", 409);
  refresh();
}
export async function saveLibraryVisitor(input: unknown, id?: string) {
  await requireMenuAccess("perpustakaan-pengunjung");
  const d = visitorSchema.parse(input), now = new Date().toISOString();
  let name = d.name, organization = d.organization;
  if (id) {
    const old = await getLibraryVisitor(id);
    if ((old.employeeNip ?? "") !== d.employeeNip) throw new LibraryError("Pegawai pada kartu yang sudah terdaftar tidak dapat diganti.");
  }
  if (d.employeeNip) {
    const e = await db.prepare("SELECT name, unit, status FROM employees WHERE nip = ?").get<{ name: string; unit: string; status: string }>(d.employeeNip);
    if (!e || (!id && e.status !== "Aktif")) throw new LibraryError("Pilih pegawai aktif yang terdaftar.");
    name = e.name; organization = e.unit;
  }
  const visitorId = id ?? randomUUID();
  const card = `DKPP-${visitorId.replaceAll("-", "").slice(0, 16).toUpperCase()}`;
  const result = id ? await db.prepare(`UPDATE library_visitors SET name = ?, organization = ?, phone = ?, address = ?, is_active = ?, updated_at = ? WHERE id = ? AND updated_at = ?`)
    .run(name, organization, d.phone, d.address, Number(d.isActive), now, id, version(input))
    : await db.prepare(`INSERT INTO library_visitors (id, card_number, employee_nip, name, organization, phone, address, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(visitorId, card, d.employeeNip || null, name, organization, d.phone, d.address, Number(d.isActive), now, now);
  if (!result.changes) throw new LibraryError("Data pengunjung berubah. Muat ulang daftar.", 409);
  refresh(); return visitorId;
}
export async function addLibraryVisit(input: unknown) {
  const user = await requireMenuAccess("perpustakaan-pengunjung");
  const d = visitSchema.parse(input);
  if (d.visitDate > jakartaToday()) throw new LibraryError("Tanggal kunjungan tidak boleh di masa depan.");
  const id = randomUUID();
  const result = await db.prepare(`INSERT INTO library_visits (id, visitor_id, visit_date, purpose, created_by, created_at)
    SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM library_visitors WHERE id = ? AND is_active = 1)`)
    .run(id, d.visitorId, d.visitDate, d.purpose, user.id, new Date().toISOString(), d.visitorId);
  if (!result.changes) throw new LibraryError("Pengunjung tidak ditemukan atau sudah nonaktif.", 409);
  refresh(); return id;
}
export async function addLibraryLoan(input: unknown) {
  const user = await requireMenuAccess("perpustakaan-peminjaman");
  const d = loanSchema.parse(input), now = new Date().toISOString(), id = randomUUID();
  if (d.loanDate > jakartaToday()) throw new LibraryError("Tanggal pinjam tidak boleh di masa depan.");
  // The database adapter serializes book/loan/visitor writes on PostgreSQL. This
  // single conditional statement is also atomic on SQLite, preventing overselling.
  const result = await db.prepare(`INSERT INTO library_loans (id, book_id, visitor_id, quantity, loan_date, due_date, notes, created_by, created_at, updated_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS
      (SELECT 1 FROM library_books b WHERE b.id = ? AND b.is_active = 1 AND b.copies - ${borrowed} >= ?)
    AND EXISTS (SELECT 1 FROM library_visitors WHERE id = ? AND is_active = 1)`)
    .run(id, d.bookId, d.visitorId, d.quantity, d.loanDate, d.dueDate, d.notes, user.id, now, now, d.bookId, d.quantity, d.visitorId);
  if (!result.changes) throw new LibraryError("Stok buku tidak cukup, atau buku/pengunjung sudah nonaktif. Muat ulang daftar.", 409);
  refresh(); return id;
}
export async function returnLibraryLoan(id: string, input: unknown) {
  await requireMenuAccess("perpustakaan-peminjaman");
  const d = returnSchema.parse(input);
  if (d.returnDate > jakartaToday()) throw new LibraryError("Tanggal kembali tidak boleh di masa depan.");
  const result = await db.prepare(`UPDATE library_loans SET return_date = ?, updated_at = ? WHERE id = ? AND return_date IS NULL AND loan_date <= ?`)
    .run(d.returnDate, new Date().toISOString(), id, d.returnDate);
  if (!result.changes) throw new LibraryError("Peminjaman tidak ditemukan, sudah dikembalikan, atau tanggal kembali sebelum tanggal pinjam.", 409);
  refresh();
}

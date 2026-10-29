import { z } from "zod";

export type LibraryBook = { id: string; inventoryCode: string; title: string; publicationYear: string; publicationPlace: string; publisher: string; isbn: string; category: string; copies: number; borrowed: number; available: number; shelf: string; notes: string; isActive: number; updatedAt: string };
export type PublicLibraryBook = Omit<LibraryBook, "notes" | "isActive" | "updatedAt">;
export type LibraryVisitor = { id: string; cardNumber: string; employeeNip: string | null; name: string; organization: string; phone: string; address: string; isActive: number; createdAt: string; updatedAt: string };
export type LibraryCardVisitor = Pick<LibraryVisitor, "id" | "cardNumber" | "name" | "organization">;
export const LIBRARY_CARDS_PER_PAGE = 6;
export const LIBRARY_CARD_BATCH_LIMIT = 1000;
export const libraryCardsSchema = z.object({
  visitorIds: z.array(z.string().uuid()).min(1, "Pilih minimal satu pengunjung.").max(LIBRARY_CARD_BATCH_LIMIT, "Maksimal 1.000 kartu per unduhan.")
    .refine(ids => new Set(ids).size === ids.length, "Pengunjung yang dipilih tidak boleh berulang."),
});
export type LibraryVisit = { id: string; visitorId: string; name: string; cardNumber: string; visitDate: string; purpose: string };
export type LibraryLoan = { id: string; bookId: string; visitorId: string; title: string; inventoryCode: string; name: string; cardNumber: string; quantity: number; loanDate: string; dueDate: string; returnDate: string | null; notes: string };
export type LibraryEmployee = { nip: string; name: string; unit: string };
const text = (max: number) => z.string().trim().max(max).refine(v => !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v), "Teks tidak valid.");
const required = (max: number) => text(max).refine(v => v.length > 0, "Wajib diisi.");
export function libraryDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01" || value > "2199-12-31") return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
const date = z.string().refine(libraryDate, "Tanggal tidak valid.");
export const bookSchema = z.object({
  inventoryCode: required(80), title: required(500), publicationYear: text(20), publicationPlace: text(200),
  publisher: text(500), isbn: text(100), category: text(100), copies: z.number().int().min(0).max(100000),
  shelf: text(100), notes: text(1000), isActive: z.boolean(),
});
export const visitorSchema = z.object({
  employeeNip: z.union([z.string().regex(/^\d{18}$/), z.literal("")]),
  name: text(200), organization: text(300), phone: text(50), address: text(500), isActive: z.boolean(),
}).refine(v => Boolean(v.employeeNip || v.name), { message: "Nama atau pegawai wajib dipilih.", path: ["name"] });
export const visitSchema = z.object({ visitorId: z.string().uuid(), visitDate: date, purpose: text(500) });
export const loanSchema = z.object({ bookId: required(80), visitorId: z.string().uuid(), quantity: z.number().int().min(1).max(100000), loanDate: date, dueDate: date, notes: text(1000) })
  .refine(v => v.dueDate >= v.loanDate, { message: "Jatuh tempo harus pada/setelah tanggal pinjam.", path: ["dueDate"] });
export const returnSchema = z.object({ returnDate: date });
export type BookInput = z.infer<typeof bookSchema>;
export type VisitorInput = z.infer<typeof visitorSchema>;
export function loanStatus(loan: Pick<LibraryLoan, "returnDate" | "dueDate">, today: string) {
  return loan.returnDate ? "Dikembalikan" : loan.dueDate < today ? "Terlambat" : "Dipinjam";
}

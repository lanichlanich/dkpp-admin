import type { Metadata } from "next";
import { getLibraryVisitors, getLibraryVisits, getLibraryEmployees } from "@/lib/library";
import { requireMenuAccess } from "@/lib/authorization";
import { jakartaToday } from "@/lib/plt-dates";
import { VisitorsAdmin } from "@/components/library/visitors-admin";
import { LibraryAdminHeader } from "@/components/library/admin-shared";
export const metadata: Metadata = { title: "Daftar Pengunjung Perpustakaan" };
export default async function VisitorsPage() {
  await requireMenuAccess("perpustakaan-pengunjung");
  const [visitors, visits, employees] = await Promise.all([getLibraryVisitors(),getLibraryVisits(),getLibraryEmployees()]);
  return <div className="mx-auto max-w-7xl space-y-6"><LibraryAdminHeader title="Daftar Pengunjung" description="Daftarkan pengunjung umum atau pegawai, unduh kartu pengunjung, dan catat riwayat kunjungan perpustakaan." /><VisitorsAdmin visitors={visitors} visits={visits} employees={employees} today={jakartaToday()} /></div>;
}

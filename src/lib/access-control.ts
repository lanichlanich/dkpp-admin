import { PDF_DOCUMENTS_MENU, PDF_DOCUMENTS_PATH, pdfTools } from "@/lib/pdf-tools-config";

export const MENU_CATALOG = [
  { id: "dashboard", label: "Dashboard", group: "Utama", path: "/dashboard" },
  { id: "berita", label: "Berita", group: "Utama", path: "/dashboard/berita" },
  ...[
    ["pegawai", "Daftar Pegawai"], ["profil-kepegawaian", "Profil Kepegawaian Dinas"], ["unit-organisasi", "Daftar Unit Organisasi"], ["jabatan", "Daftar Jabatan"], ["peta-jabatan", "Peta Jabatan"], ["proyeksi-pensiun", "Proyeksi Pensiun"], ["anjab-abk", "Anjab-ABK"], ["daftar-plt", "Daftar Plt."],
    ["hukdis", "Daftar Hukdis"], ["penjatuhan-hukdis", "Penjatuhan Hukuman Disiplin"], ["surat-hukdis-hukda", "Surat HUKDIS & HUKDA"], ["dpcp", "DPCP"],
    ["pak", "PAK"], ["kgb", "SK KGB"], ["pembukaan-kerjaku", "Pembukaan Kerjaku"],
  ].map(([id, label]) => ({ id, label, group: "Kepegawaian", path: `/dashboard/${id}` })),
  ...[["daftar-wfh", "Daftar WFH/WFO"], ["laporan-pegawai-wfh-wfo", "Laporan Pegawai WFH/WFO"], ["wfh", "Surat Tugas WFH"], ["laporan-wfh", "Laporan WFH"], ["spj-pelayanan-umum", "SPJ Pelayanan Umum Kantor"]]
    .map(([id, label]) => ({ id, label, group: "Umum", path: `/dashboard/${id}` })),
  ...[["klasifikasi-surat", "Klasifikasi Surat"], ["arsip-dinas", "Arsip Dinas"], ["surat-pengantar", "Surat Pengantar"], ["surat-tugas", "Surat Tugas"], ["surat-perbantuan", "Surat Perbantuan"], ["surat-lupa-absen-pulang", "Surat Lupa Absen Pulang"]]
    .map(([id, label]) => ({ id, label, group: "Persuratan", path: `/dashboard/${id}` })),
  { id: "pembuatan-kak", label: "Pembuatan PO dan KAK", group: "Perencanaan", path: "/dashboard/pembuatan-kak" },
  { id: "pagu-target-realisasi", label: "Pagu, Target & Realisasi", group: "Perencanaan", path: "/dashboard/pagu-target-realisasi" },
  { id: "simulasi-gaji-pns", label: "Simulasi Gaji PNS", group: "Keuangan", path: "/dashboard/simulasi-gaji-pns" },
  ...[["statistik", "Dashboard Statistik"], ["buku", "Daftar Buku"], ["pengunjung", "Daftar Pengunjung"], ["peminjaman", "Daftar Peminjaman"]]
    .map(([id, label]) => ({ id: `perpustakaan-${id}`, label, group: "Perpustakaan", path: `/dashboard/perpustakaan/${id}` })),
  ...pdfTools.map(tool => ({ id: tool.slug, label: tool.label, group: "Tools", path: `/dashboard/tools/${tool.slug}` })),
  { id: PDF_DOCUMENTS_MENU, label: "Daftar Dokumen", group: "Tools", path: PDF_DOCUMENTS_PATH },
  { id: "backup-lokal", label: "Backup ke Lokal", group: "Sistem", path: "/dashboard/backup-lokal" },
  { id: "backup", label: "Backup Google Drive", group: "Sistem", path: "/dashboard/backup" },
  { id: "log-audit", label: "Log Audit Perubahan Data", group: "Sistem", path: "/dashboard/log-audit" },
];
export type AccessUser = { isAdministrator: boolean; menuPermissions: string[]; roleName?: string };
export function canViewLibraryStatistics(user: AccessUser) {
  // roleName comes from app_roles through the server session, never profile input.
  return user.isAdministrator || user.roleName?.trim().toLocaleLowerCase("id-ID") === "perpustakaan";
}
export function parseMenuPermissions(value: string | null | undefined): string[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? [...new Set(parsed.filter((id): id is string => typeof id === "string" && MENU_CATALOG.some(menu => menu.id === id)))] : [];
  } catch { return []; }
}
export function canAccessMenu(user: AccessUser, menu: string) {
  if (menu === "perpustakaan-statistik") return canViewLibraryStatistics(user);
  return MENU_CATALOG.some(item => item.id === menu) && (user.isAdministrator || user.menuPermissions.includes(menu));
}
export function canAccessPath(user: AccessUser, path: string) {
  if (path === "/dashboard/profile" || path === "/dashboard/akses") return true;
  if (path === "/dashboard/manajemen-user") return user.isAdministrator;
  const menu = MENU_CATALOG.find(item => path === item.path || (item.id !== "dashboard" && path.startsWith(`${item.path}/`)));
  return Boolean(menu && canAccessMenu(user, menu.id));
}
export function landingPath(user: AccessUser) {
  return MENU_CATALOG.find(menu => canAccessMenu(user, menu.id))?.path ?? "/dashboard/akses";
}

# Administrasi penjatuhan hukuman disiplin PNS

Menu **Kepegawaian → Penjatuhan Hukuman Disiplin** menyimpan perkara ketidakhadiran dan menyiapkan draf Word. Masukkan jumlah hari kerja tanpa alasan yang sah secara kumulatif dalam satu tahun berjalan. Jika ada rangkaian sedikitnya 10 hari kerja berturut-turut, centang pilihan yang muncul. Tingkat dan dasar pasal dihitung dari data tersebut. Pada langkah berikutnya, cari PNS aktif yang diperiksa, atasan, tim, dan pejabat berdasarkan nama, NIP, atau jabatan. Data pejabat di luar daftar bisa diisi manual.

## Dasar dan alur

- **Dugaan dan bukti.** Gunakan Pasal 4 huruf f dan ambang Pasal 9–11. Jumlah 1–2 hari kerja berada di bawah ambang hukuman. Untuk hukuman sedang, form membatasi pilihan sesuai rentang hari serta memasangkan jenis menurut Pasal 8 dengan jenis peralihan menurut Pasal 42 PP 94/2021 dan Pasal 62 Peraturan BKN 6/2022. Petugas memeriksa dasar yang berlaku sebelum memilih.
- **Kewenangan.** Periksa Pasal 16–25 dan penunjukan yang berlaku di instansi. Jika pejabat yang memeriksa tidak berwenang menjatuhkan hukuman, sampaikan BAP dan laporan hasil pemeriksaan melalui jalur hierarki.
- **Panggilan.** Menurut Pasal 26 dan Pasal 34 Peraturan BKN, panggilan tertulis dilakukan paling lambat tujuh hari kerja sebelum pemeriksaan. Ketidakhadiran pada jadwal pertama diikuti Panggilan II paling lambat tujuh hari kerja sejak jadwal pertama. Jika dua panggilan tidak dihadiri, catat alat bukti dan keterangan yang menjadi dasar.
- **Pemeriksaan.** Pemeriksaan tertutup dapat dilakukan tatap muka atau virtual. Untuk dugaan hukuman berat, bentuk tim dengan unsur atasan langsung, pengawasan, dan kepegawaian. Tim untuk dugaan hukuman sedang bersifat pilihan. Catat hasil dan penandatanganan BAP, termasuk bila PNS menolak menandatangani. PNS berhak memperoleh salinan BAP.
- **Keputusan dan tindak lanjut.** Catat satu jenis hukuman per perkara setelah hasil dan dasar pemeriksaan jelas. Sampaikan keputusan paling lambat 14 hari kerja sejak penetapan. Berdasarkan Pasal 50 Peraturan BKN, keberlakuan normal dihitung pada hari kerja ke-15 sejak keputusan diterima. Jika ada upaya administratif, keberlakuan mengikuti keputusannya. Gunakan kalender kerja instansi dan masukkan tanggal yang sudah diverifikasi. Simpan keputusan dan bukti pemeriksaan untuk pencatatan pada I’DIS BKN oleh petugas berwenang.

[PP 94 Tahun 2021](https://peraturan.bpk.go.id/Details/177031/pp-no-94-tahun-2021) · [Peraturan BKN 6 Tahun 2022](https://peraturan.bpk.go.id/Details/225406/peraturan-bkn-no-6-tahun-2022) · [PP 79 Tahun 2021](https://peraturan.bpk.go.id/Details/175828/pp-no-79-tahun-2021)

## Format Word

Delapan format dari `format2 hukdis.docx` memakai kop dan logo `kop surat dkpp.docx`. Surat Panggilan I dan II berbagi satu format. Format lain meliputi pembentukan tim, BAP, laporan hasil pemeriksaan, panggilan untuk menerima keputusan, dan tiga keputusan hukuman ringan. Hukuman sedang dan berat dapat dicatat di register berdasarkan keputusan pejabat berwenang. Form memberi nama berkas dengan awalan **Draf** untuk pemeriksaan sebelum penetapan.

Susunan lampiran dipertahankan. Pada draf keputusan sejak 31 Oktober 2023, dasar UU ASN memakai UU 20 Tahun 2023. Klausul tanggal berlaku memuat ketentuan bila ada upaya administratif. [UU 20 Tahun 2023](https://peraturan.bpk.go.id/Details/269470/uu-no-20-tahun-2023)

## Akses dan verifikasi

Akses diberikan lewat izin **Penjatuhan Hukuman Disiplin**. Perkara termasuk backup kategori Kepegawaian dan mutasi tercatat dalam audit. Unduhan draf memakai sesi aplikasi. Perubahan menggunakan versi perkara untuk mencegah penimpaan. Perkara lama tetap memakai data arsipnya saat mengunduh draf.

Migrasi PostgreSQL ada di `supabase/migrations/20261110075939_add_discipline_cases.sql`. Tabel privat memakai RLS dan menolak peran Data API publik. SQLite membuat tabel yang setara saat inisialisasi.

`npm.cmd run smoke:discipline-cases` memeriksa izin, validasi dan semua unduhan. Tambahkan `-- --render-fixtures` untuk menghasilkan draf sintetis di direktori sementara untuk pemeriksaan Word.

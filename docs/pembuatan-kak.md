# Pembuatan KAK

Menu **Perencanaan → Pembuatan KAK** menerima satu RKA rincian sub kegiatan dalam format PDF (maksimal 2 MB). Klik **Generate dan unduh draft KAK** untuk membaca RKA dengan Gemini, mengisi template, menyimpan arsip, dan mengunduh Word. Arsip menyediakan unduh ulang DOCX serta PDF RKA melalui sesi login aplikasi.

Template `src/templates/template-kak.docx` adalah salinan template pengguna. Pengisian mencakup identitas kegiatan, tahun anggaran, 19 tag `<generate dengan ai>`, tiga baris risiko, tanggal, dan penandatangan. Petunjuk penulisan pada sel isian dihapus. Tinggi minimum baris isian menyesuaikan isi dan dua kolom tanda tangan dibuat dapat membungkus jabatan panjang. Bagian ZIP selain `word/document.xml`, bagian A–G, ukuran halaman, dan pengaturan section tetap dipertahankan.

Gemini menghasilkan draft. Pagu memakai tahun anggaran utama, rincian memakai item belanja tanpa menggandakan subtotal, dan jumlah rincian dibandingkan dengan pagu. Dasar hukum dan identitas yang tidak ada tidak dikarang. Nama/NIP PPTK bisa diisi opsional; penandatangan mengikuti RKA atau dipilih manual (termasuk Plt.). Lengkapi penanda kosong dan periksa narasi, dasar hukum, strategi, serta kewenangan penandatangan sebelum penetapan.

Konfigurasi menggunakan `GEMINI_API_KEY` dan `GEMINI_MODEL` yang sudah digunakan fitur AI aplikasi. Database produksi memakai migrasi `20261008051326_add_kak_documents.sql`. RKA dan DOCX memakai bucket Supabase aplikasi; keduanya dimasukkan dalam kategori backup **Perencanaan**. Pada mode SQLite lokal, file berada di `data/kak-documents` (diabaikan Git).

Pemeriksaan:

- `npm run smoke:kak-template`: validasi, 19 isian, risiko, identitas, escaping XML, bagian ZIP dan section template, batas 2 MB.
- Jalankan aplikasi lokal pada port 3100 lalu `npm run smoke:kak`: autentikasi, validasi upload, unduh tidak ditemukan, menu/form.
- `npm run smoke:kak -- "<path RKA contoh pengguna>"`: juga menguji Gemini langsung, pagu contoh Rp29.359.021,00 TA 2027, delapan rincian belanja, arsip, dan unduh ulang RKA/DOCX. Hanya data akun/arsip sementara pengujian yang dihapus.
- Render `.tmp/kak/http-sample.docx` dengan Word/LibreOffice untuk memeriksa seluruh halaman hasil. XML yang valid saja tidak menjamin tata letak.

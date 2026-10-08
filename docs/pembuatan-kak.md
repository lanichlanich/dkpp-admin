# Pembuatan KAK

Menu **Perencanaan → Pembuatan KAK** menerima satu RKA rincian sub kegiatan dalam format PDF (maksimal 2 MB). Klik **Generate dan unduh draft KAK** untuk membaca RKA dengan Gemini, mengisi template, menyimpan arsip, dan mengunduh Word. Arsip menyediakan unduh ulang DOCX serta PDF RKA melalui sesi login aplikasi.

Template `src/templates/template-kak.docx` adalah salinan template pengguna. Pengisian mencakup identitas kegiatan, tahun anggaran, 19 tag `<generate dengan ai>`, tiga baris risiko, tanggal, dan penandatangan. Petunjuk penulisan pada sel isian dihapus. Tinggi minimum baris isian menyesuaikan isi dan dua kolom tanda tangan dibuat dapat membungkus jabatan panjang. Bagian ZIP selain `word/document.xml`, bagian A–G, ukuran halaman, dan pengaturan section tetap dipertahankan.

Gemini menghasilkan draft. Pagu memakai tahun anggaran utama, rincian memakai item belanja tanpa menggandakan subtotal, dan jumlah rincian dibandingkan dengan pagu. Nama/NIP PPTK bisa diisi opsional; penandatangan mengikuti RKA atau dipilih manual (termasuk Plt.). Lengkapi penanda kosong dan periksa narasi, dasar hukum, strategi, serta kewenangan penandatangan sebelum penetapan.

Referensi tetap adalah Renstra DKPP 2025–2029 dan Rancangan Akhir Renja DKPP 2027 yang dilampirkan pengguna. Teks sumber, tabel, nomor paragraf/halaman PDF dan checksum tersimpan di `src/data/kak-references` dan hanya dibaca di server. Pengguna tidak perlu mengunggah ulang referensi. Gemini terlebih dahulu mengekstrak fakta RKA, lalu menyusun narasi dengan bagian tujuan/sasaran dan program yang cocok. Renja 2027 hanya digunakan untuk TA 2027, Renstra untuk TA 2025–2029, dan referensi DKPP tidak diterapkan pada perangkat daerah berbeda.

RKA menjadi sumber angka KAK. Pagu/target Renja atau Renstra yang berbeda menghasilkan catatan pemeriksaan; angka indikatif tidak menggantikan RKA. Untuk contoh cetakan, Renstra memuat 2 paket/Rp120.000.000 pada 2027, sedangkan RKA/Renja memuat 1 paket/Rp29.359.021. Pemilihan dasar hukum dibatasi ID katalog yang benar-benar tercantum pada sumber. Teks peraturan dicetak dari katalog secara deterministik dan Renstra/Renja disebut sebagai acuan perencanaan. Ini tidak menyatakan semua peraturan dalam referensi masih berlaku; status, perubahan, dan relevansinya harus ditinjau sebelum penetapan. Entri Renja mengenai Keputusan Bupati 10/2023 serta kutipan Renstra yang menyebut UU 11/2020 sebagai perubahan terakhir memerlukan verifikasi dan tidak masuk pilihan otomatis. Kutipan sumber asli tetap disimpan; sistem tidak mengarang redaksi penggantinya. Identitas versi referensi, lokasi kutipan dan ID hukum terpilih ikut disimpan dalam arsip draft, sehingga arsip lama tetap dapat diunduh.

Untuk memperbarui sumber, periksa struktur dokumen, jalankan `scripts/import-kak-references.py` dengan runtime Python yang menyediakan pypdf/lxml dan kedua path lampiran, lalu tinjau hasil ekstraksi dan uji referensinya. Impor dibatasi pada struktur lampiran ini; perubahan tahun/struktur memerlukan penyesuaian importer setelah audit dokumen.

Konfigurasi menggunakan `GEMINI_API_KEY` dan `GEMINI_MODEL` yang sudah digunakan fitur AI aplikasi. Database produksi memakai migrasi `20261008051326_add_kak_documents.sql`. RKA dan DOCX memakai bucket Supabase aplikasi; keduanya dimasukkan dalam kategori backup **Perencanaan**. Pada mode SQLite lokal, file berada di `data/kak-documents` (diabaikan Git).

Pemeriksaan:

- `npm run smoke:kak-template`: validasi, 19 isian, risiko, identitas, escaping XML, bagian ZIP dan section template, batas 2 MB.
- Jalankan aplikasi lokal pada port 3100 lalu `npm run smoke:kak`: autentikasi, validasi upload, unduh tidak ditemukan, menu/form.
- `npm run smoke:kak -- "<path RKA contoh pengguna>"`: juga menguji Gemini langsung, pagu contoh Rp29.359.021,00 TA 2027, delapan rincian belanja, arsip, dan unduh ulang RKA/DOCX. Hanya data akun/arsip sementara pengujian yang dihapus.
- Render `.tmp/kak/http-sample.docx` dengan Word/LibreOffice untuk memeriksa seluruh halaman hasil. XML yang valid saja tidak menjamin tata letak.

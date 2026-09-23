"""Distill the supplied PAK into a template, preserving all other ZIP parts.
Usage: bundled-python scripts/prepare-pak-template.py path/to/reference.docx
"""
import copy
import hashlib
import html
import json
import re
import sys
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

source = Path(sys.argv[1]).resolve()
target = Path('src/templates/template-pak.docx')
qa = Path('.tmp/pak')
qa.mkdir(parents=True, exist_ok=True)
paragraph_re = re.compile(r'<w:p(?=[\s>])[^>]*>[\s\S]*?</w:p>')
text_re = re.compile(r'(<w:t(?:\s[^>]*)?>)([\s\S]*?)(</w:t>)')

def replace_text(xml, old, new):
    matches = list(text_re.finditer(xml))
    texts = [html.unescape(m[2]) for m in matches]
    joined = ''.join(texts)
    start = joined.find(old)
    if start < 0:
        raise ValueError(f'Slot missing: {old}')
    end = start + len(old)
    cursor = 0
    inserted = False
    for i, s in enumerate(texts):
        a, b = max(0, start-cursor), min(len(s), end-cursor)
        if a < b:
            texts[i] = s[:a] + (new if not inserted else '') + s[b:]
            inserted = True
        cursor += len(s)
    it = iter(texts)
    return text_re.sub(lambda m: m[1]+html.escape(next(it), quote=False)+m[3], xml)

slots = {
  12:'nama',16:'nip',20:'kartu_asn',24:'ttl',28:'jenis_kelamin',32:'pangkat_tmt',36:'jabatan_tmt',40:'unit_kerja',44:'instansi',
  57:'predikat',58:'persentase',59:'koefisien',60:'ak_baru',
  90:'nama',95:'nip',100:'kartu_asn',105:'ttl',110:'jenis_kelamin',115:'pangkat_tmt',120:'jabatan_tmt',125:'unit_kerja',
  149:'#riwayat}{tahun',150:'periode',151:'predikat',152:'persentase',153:'koefisien',154:'ak}{/riwayat',162:'ak_konversi_total',
  191:'nama',195:'nip',199:'kartu_asn',203:'ttl',207:'jenis_kelamin',211:'pangkat_tmt',215:'jabatan_tmt',219:'unit_kerja',
  257:'ak_lama',258:'ak_baru',259:'ak_konversi_total',276:'total_lama',277:'total_baru',278:'total',284:'minimal_pangkat',285:'minimal_jenjang',289:'selisih_pangkat',292:'selisih_jenjang',
}
for key, indexes in {'dasar':[236,237,238,239], 'jfLama':[243,244,245,246], 'penyesuaian':[250,251,252,253], 'pendidikan':[264,265,266,267], 'lainnya':[271,272,273,274]}.items():
    for suffix, index in zip(['lama','baru','jumlah','catatan'], indexes):
        slots[index] = f'{key}_{suffix}'

with ZipFile(source) as package:
    raw = package.read('word/document.xml').decode('utf-8')
    paragraphs = list(paragraph_re.finditer(raw))
    assert len(paragraphs) == 313, 'Reference structure changed; inspect before editing.'
    replacements = {}
    for i, m in enumerate(paragraphs):
        p = m[0]
        if i in slots:
            original = ''.join(html.unescape(t[2]) for t in text_re.finditer(p))
            p = replace_text(p, original, '{'+slots[i]+'}')
        for old, new in [
            ('1393/KEP/6115/SK/PAK/2026','{nomor}'),
            ('Pemerintah Kab. Indramayu','{instansi}'),
            ('Januari – Desember 2025','{periode_penilaian}'),
            ('Januari - Desember 2025','{periode_penilaian}'),
            ('Ditetapkan di Indramayu','Ditetapkan di {tempat}'),
            ('5 Januari 2026','{tanggal}'),
            ('Drs SUGENG HERYANTO, M.Si','{penilai_nama}'),
            ('196609231987091001','{penilai_nip}'),
        ]:
            if old in ''.join(html.unescape(t[2]) for t in text_re.finditer(p)):
                p = replace_text(p, old, new)
        if i == 52: p = replace_text(p, '(Kolom 2 x kolom 3)', '{rumus}')
        if i == 286: p = replace_text(p, 'Kelebihan Angka Kredit yang harus dicapai untuk kenaikan pangkat', 'Selisih Angka Kredit terhadap kebutuhan')
        if i == 293: p = replace_text(p, 'Kekurangan Angka Kredit yang harus dicapai untuk kenaikan jenjang', '(+ kelebihan / - kekurangan)')
        replacements[m.start()] = p
    xml = paragraph_re.sub(lambda m: replacements[m.start()], raw)
    # Use the existing six-column row as a repeating record, preserving its grid.
    tables = list(re.finditer(r'<w:tbl[\s>][\s\S]*?</w:tbl>', xml))
    table = tables[1][0]
    rows = list(re.finditer(r'<w:tr[\s>][\s\S]*?</w:tr>', table))
    for index in [14, 12]:
        row = rows[index]
        table = table[:row.start()] + table[row.end():]
    xml = xml[:tables[1].start()] + table + xml[tables[1].end():]
    target.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(target, 'w', ZIP_DEFLATED) as output:
        for part in package.infolist():
            output.writestr(copy.copy(part), xml.encode('utf-8') if part.filename == 'word/document.xml' else package.read(part.filename))
    inventory = [{ 'part': p.filename, 'size': p.file_size, 'sha256': hashlib.sha256(package.read(p.filename)).hexdigest(), 'policy': 'editable' if p.filename == 'word/document.xml' else 'preserve-only' } for p in package.infolist()]
    (qa/'package-inventory.json').write_text(json.dumps(inventory, indent=2))

(qa/'artifact.md').write_text(f'''# PAK template contract
Reference: {source}
SHA256: {hashlib.sha256(source.read_bytes()).hexdigest()}
Reference render: reference-render/reference.pdf and page-1.png through page-3.png (Word PDF export; packaged renderer could not locate bundled LibreOffice).
Three A4 portrait pages, four section properties. Page size 11910 x 16840 twips; margins top 1920, right 1133, bottom 280, left 1275; header/footer 720. Final continuous section has two columns 4069 and 3867 with 1566 gap. Preserve all section XML.
The first-page letterhead is a header relationship to header1.xml and image1.jpg; preserve all header, image, style, numbering, relationship and other package parts byte-for-byte. Full package inventory: package-inventory.json.
Body Arial with inherited Normal formatting; titles centered, identity cells left-aligned, numeric columns centered, black ruled tables and gray column-number rows. Exact run properties, table grids, cell margins, heights and paragraph properties are retained in-place rather than restyled.
Page 1: letterhead, conversion title/number, agency/period, identity table, predicate/percentage/coefficient/credit, assessor and four recipients.
Page 2: accumulation title/number, agency/period, identity and six-column history table; repeat original row 13 of table 1 for each integration/conversion record and current period, then total, assessor and recipients. Additional rows may flow onto additional pages.
Page 3: determination title, identity, six component rows with old/new/total/note, cumulative total, thresholds/differences and two-column recipients/assessor.
Slot locators: zero-based word/document.xml paragraph indices recorded in scripts/prepare-pak-template.py; dynamic history is table 1, original row 13. Identity, dates, assessor and document number are repeated consistently. No source personal/credit data may remain outside populated slots. No body fields/content controls require refresh.
Intentional corrections: signed differences replace misleading excess/shortfall row labels; partial-year conversion formula displays month proration. No other source geometry changes.
Fidelity gates: all preserve-only parts identical; no unresolved tokens or sample identities; source SHA unchanged; sample remains three pages; inspect every generated page for clipping and flow.
''', encoding='utf-8')
print(target)

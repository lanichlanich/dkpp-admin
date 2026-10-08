"""Turn the user's corrected KAK into a reusable template without rebuilding ZIP parts."""
import copy
import hashlib
import pathlib
import sys
import zipfile
from lxml import etree

if len(sys.argv) != 2:
    raise SystemExit('Usage: python scripts/import-kak-layout.py "corrected KAK.docx"')
source = pathlib.Path(sys.argv[1])
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
w = '{' + ns['w'] + '}'
archive = zipfile.ZipFile(source)
root = etree.fromstring(archive.read('word/document.xml'))
body = root.find('w:body', ns)
tables = body.findall('w:tbl', ns)
if len(tables) != 6 or [len(t.findall('w:tr', ns)) for t in tables] != [6, 9, 11, 18, 9, 3]:
    raise SystemExit('Corrected KAK structure changed; inspect its slots before importing.')

def text(element):
    return ''.join(element.xpath('.//w:t/text()', namespaces=ns))

def fill_paragraph(paragraph, value):
    run = next((r for r in paragraph.findall('w:r', ns) if r.find('w:t', ns) is not None), None)
    run_properties = copy.deepcopy(run.find('w:rPr', ns)) if run is not None and run.find('w:rPr', ns) is not None else None
    for child in list(paragraph):
        if child.tag != w + 'pPr':
            paragraph.remove(child)
    new_run = etree.SubElement(paragraph, w + 'r')
    if run_properties is not None:
        new_run.append(run_properties)
    new_text = etree.SubElement(new_run, w + 't')
    new_text.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    new_text.text = value

def cell(ti, ri, ci=2):
    return tables[ti].findall('w:tr', ns)[ri].findall('w:tc', ns)[ci]

for ri, key in enumerate(['perangkatDaerah', 'urusanPemerintahan', 'bidangUrusan', 'program', 'kegiatan', 'subKegiatan']):
    fill_paragraph(cell(0, ri).find('w:p', ns), '${kak.' + key + '}')

slots = {
    1: {1: 'latarBelakang', 3: 'dasarHukum', 5: 'gambaranUmum', 8: 'maksudTujuan'},
    2: {1: 'maksud', 3: 'tujuan', 6: 'strategiPelaksanaan', 8: 'metodePelaksanaan', 10: 'tahapanPelaksanaan'},
    3: {1: 'tempatPelaksanaan', 4: 'pelaksanaPenanggungJawab', 6: 'pelaksanaSubKegiatan', 8: 'penanggungJawab', 10: 'penerimaManfaat', 13: 'jadwalRencana', 15: 'waktuPelaksanaan', 17: 'totalBiaya'},
    4: {1: 'identifikasiRisiko', 8: 'penutup'},
}
for ti, rows in slots.items():
    for ri, key in rows.items():
        target = cell(ti, ri)
        paragraphs = target.findall('w:p', ns)
        fill_paragraph(paragraphs[0], '<generate ai:' + key + '>')
        for pi, paragraph in enumerate(paragraphs[1:], 1):
            if key in ['tahapanPelaksanaan', 'totalBiaya'] and pi == 1:
                fill_paragraph(paragraph, '${kak.listPrototype}')
            elif text(paragraph).strip():
                target.remove(paragraph)

for ri in range(3, 6):
    for ci, key in enumerate(['number', 'subKegiatan', 'risiko', 'penyebab', 'mitigasi'], 3):
        fill_paragraph(cell(4, ri, ci).find('w:p', ns), '${kak.risk.' + str(ri - 3) + '.' + key + '}')
for ri, keys in [(1, ['signerName', 'pptkNama']), (2, ['signerNip', 'pptkNip'])]:
    for ci, key in enumerate(keys):
        fill_paragraph(cell(5, ri, ci).find('w:p', ns), '${kak.' + key + '}')

paragraphs = body.findall('w:p', ns)
for paragraph in paragraphs:
    value = text(paragraph).strip()
    if value.startswith('Rencana Sub Kegiatan '):
        fill_paragraph(paragraph, '${kak.title}')
    elif value == 'Tahun Anggaran 2027':
        fill_paragraph(paragraph, '${kak.year}')
    elif 'Indramayu,' in value:
        # The supplied date uses leading spaces in addition to its indent.
        fill_paragraph(paragraph, text(paragraph).split('Indramayu,', 1)[0] + '${kak.date}')

output = pathlib.Path('src/templates/template-kak.docx')
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as destination:
    for entry in archive.infolist():
        destination.writestr(entry, etree.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True) if entry.filename == 'word/document.xml' else archive.read(entry))
print(f'Imported corrected KAK layout, 19 sections, source SHA256 {hashlib.sha256(source.read_bytes()).hexdigest()}')

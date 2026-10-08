"""Extract the supplied planning documents into versioned, server-only reference text."""
import hashlib
import json
import pathlib
import re
import sys
import zipfile
from lxml import etree
from pypdf import PdfReader

if len(sys.argv) != 3:
    raise SystemExit('Usage: python scripts/import-kak-references.py "Renja 2027.docx" "Renstra 2025-2029.pdf"')
renja_path, renstra_path = map(pathlib.Path, sys.argv[1:])
out = pathlib.Path('src/data/kak-references')
out.mkdir(parents=True, exist_ok=True)
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
root = etree.fromstring(zipfile.ZipFile(renja_path).read('word/document.xml'))
paragraphs = []
for i, p in enumerate(root.findall('.//w:p', ns)):
    value = ''.join(p.xpath('.//w:t/text()', namespaces=ns)).strip()
    if value:
        paragraphs.append({'index': i, 'text': value})
chunks = []
for start, end, role in [(53, 59, 'background'), (60, 74, 'legal'), (76, 80, 'background'), (273, 295, 'goals'), (351, 380, 'strategy')]:
    chunks.append({'id': f'renja-p{start}-{end}', 'locator': f'Paragraf sumber {start}-{end}', 'role': role, 'text': '\n'.join(p['text'] for p in paragraphs if start <= p['index'] <= end)})
legal = [{'id': f'renja-p{p["index"]}', 'locator': f'Bagian 1.2, paragraf sumber {p["index"]}', 'text': p['text'], 'needsVerification': p['index'] == 72} for p in paragraphs if 62 <= p['index'] <= 74]
for ti, table in enumerate(root.findall('.//w:tbl', ns)):
    rows = table.findall('w:tr', ns)
    for ri, row in enumerate(rows):
        cells = [' | '.join(''.join(p.xpath('.//w:t/text()', namespaces=ns)) for p in c.findall('w:p', ns)).strip() for c in row.findall('w:tc', ns)]
        if ti in [5, 6, 7, 8, 9]:
            chunk = {'id': f'renja-t{ti}-r{ri}', 'locator': f'Tabel sumber {ti + 1}, baris {ri + 1}', 'role': 'program' if ti == 7 else 'goals', 'code': cells[0] if ti == 7 else '', 'text': ' | '.join(cells)}
            if ti == 7 and len(cells) == 10 and re.fullmatch(r'[\d.]+', cells[5]) and cells[4]:
                chunk['figures'] = [{'year': 2027, 'target': cells[4], 'budget': cells[5].replace('.', '')}]
            chunks.append(chunk)
renja = {'id': 'renja-dkpp-2027', 'title': 'Rancangan Akhir Renja DKPP Tahun 2027', 'fileName': renja_path.name, 'startYear': 2027, 'endYear': 2027, 'sha256': hashlib.sha256(renja_path.read_bytes()).hexdigest(), 'chunks': chunks, 'legal': legal}
pages = [{'id': f'renstra-p{i + 1}', 'locator': f'Halaman PDF {i + 1}', 'role': 'page', 'text': p.extract_text() or ''} for i, p in enumerate(PdfReader(renstra_path).pages)]
if len(pages) != 163 or 'Landasan Hukum' not in pages[10]['text'] or 'Penggandaan' not in ' '.join(c['text'] for c in chunks):
    raise SystemExit('Source structure changed: inspect planning documents before updating this importer.')
law_text = '\n'.join(p['text'] for p in pages[10:14])
law_text = re.sub(r'RENSTRA DINAS KETAHANAN PANGAN DAN PERTANIAN 2025-2029\s+\d+', '', law_text)
laws = []
for match in re.finditer(r'(?:^|\n)\s*(\d{1,2})\.\s+((?:Undang|Peraturan|Keputusan)[\s\S]*?)(?=\n\s*\d{1,2}\.\s+(?:Undang|Peraturan|Keputusan)|\Z)', law_text):
    text = re.sub(r'\s+', ' ', match[2]).strip().replace('No. 1 60 Tahun 202 4', 'No. 160 Tahun 2024')
    # Source law 8 calls UU 11/2020 the latest amendment, while this same
    # document also lists UU 6/2023. Preserve the source, exclude the disputed
    # wording from automatic citations pending a legal review.
    laws.append({'id': f'renstra-law{match[1]}', 'locator': 'Bagian 1.2, halaman PDF 11-14', 'text': text, 'needsVerification': match[1] == '8'})
if len(laws) != 33:
    raise SystemExit(f'Expected 33 numbered Renstra laws, found {len(laws)}; inspect extraction.')
program_chunks = []
for page in pages:
    # Only the explicit five-year target/budget table has this column order.
    if 'BASELINE' not in page['text'] or not re.search(r'2026\s+2027\s+2028\s+2029\s+2030', page['text']):
        continue
    for match in re.finditer(r'(\d\.\d{2}\.\d{2}\.2\.\d{2}\.\d{4})\s*-([\s\S]*?)(?=\d\.\d{2}\.\d{2}\.2\.\d{2}\.\d{4}\s*-|\Z)', page['text']):
        tail = re.search(r'((?:\d[\d.,]*\s+){10}\d[\d.,]*)\s*$', match[2].strip())
        if not tail:
            continue
        values = tail[1].split()
        figures = [{'year': 2026 + i, 'target': values[1 + 2 * i], 'budget': values[2 + 2 * i].replace('.', '')} for i in range(5)]
        program_chunks.append({'id': f'{page["id"]}-{match[1]}', 'locator': page['locator'], 'role': 'program', 'code': match[1], 'text': match[0].strip(), 'figures': figures})
renstra = {'id': 'renstra-dkpp-2025-2029', 'title': 'Renstra DKPP Tahun 2025-2029', 'fileName': renstra_path.name, 'startYear': 2025, 'endYear': 2029, 'sha256': hashlib.sha256(renstra_path.read_bytes()).hexdigest(), 'chunks': pages + program_chunks, 'legal': laws}
for reference in [renja, renstra]:
    target = out / f'{reference["id"]}.json'
    target.write_text(json.dumps(reference, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(f'{reference["id"]}: {len(reference["chunks"])} passages, {len(reference["legal"])} laws, {target.stat().st_size} bytes')

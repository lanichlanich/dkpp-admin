"""Prepend the supplied cover to the body template, keeping each visual system scoped."""
import copy
import hashlib
import pathlib
import re
import sys
import zipfile
from lxml import etree

if len(sys.argv) != 2:
    raise SystemExit('Usage: python scripts/import-kak-cover.py "cover KAK.docx" (after importing the body layout)')
source = pathlib.Path(sys.argv[1])
output = pathlib.Path('src/templates/template-kak.docx')
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
w = '{' + ns['w'] + '}'
r = '{' + ns['r'] + '}'
rel = 'http://schemas.openxmlformats.org/package/2006/relationships'
ct = 'http://schemas.openxmlformats.org/package/2006/content-types'
cover = zipfile.ZipFile(source)
base = zipfile.ZipFile(output)
base_parts = {entry.filename: base.read(entry) for entry in base.infolist()}
cover_root = etree.fromstring(cover.read('word/document.xml'))
base_root = etree.fromstring(base_parts['word/document.xml'])
body = cover_root.find('w:body', ns)
tables = body.findall('w:tbl', ns)
if len(tables) != 1 or len(tables[0].findall('w:tr', ns)) != 5 or len(base_root.findall('w:body/w:tbl', ns)) != 6:
    raise SystemExit('Inspect the cover first; this importer expects its five-row cover and a six-table KAK body.')
if body.findall('.//w:numPr', ns):
    raise SystemExit('Cover now uses numbering; inspect and import its numbering before proceeding.')

def fill_paragraph(p, value):
    text_run = next((x for x in p.findall('w:r', ns) if x.find('w:t', ns) is not None), None)
    rp = text_run.find('w:rPr', ns) if text_run is not None else p.find('w:pPr/w:rPr', ns)
    rp = copy.deepcopy(rp) if rp is not None else etree.fromstring(
        f'<w:rPr xmlns:w="{ns["w"]}"><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="20"/></w:rPr>')
    for child in list(p):
        if child.tag != w + 'pPr':
            p.remove(child)
    run = etree.SubElement(p, w + 'r')
    run.append(rp)
    text = etree.SubElement(run, w + 't')
    text.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    text.text = value

for ri, key in enumerate(['program', 'kegiatan', 'subKegiatan', 'paguAnggaran', 'lokasi']):
    p = tables[0].findall('w:tr', ns)[ri].findall('w:tc', ns)[2].find('w:p', ns)
    fill_paragraph(p, '${kak.cover.' + key + '}')
year = [p for p in body.findall('w:p', ns) if ''.join(p.xpath('.//w:t/text()', namespaces=ns)).startswith('TAHUN ANGGARAN ')]
if len(year) != 1:
    raise SystemExit('Cover year slot changed.')
fill_paragraph(year[0], '${kak.cover.year}')
title = [p for p in body.findall('w:p', ns) if ''.join(p.xpath('.//w:t/text()', namespaces=ns)) in ['PETUNJUK OPERASIONAL', 'KERANGKA ACUAN KERJA']]
if len(title) != 1:
    raise SystemExit('Cover title slot changed.')
fill_paragraph(title[0], 'KERANGKA ACUAN KERJA')
header = etree.fromstring(cover.read('word/header1.xml'))
if len(header.findall('w:p', ns)) != 1:
    raise SystemExit('Cover header slot changed.')
fill_paragraph(header.find('w:p', ns), '${kak.cover.sequence}')

# Scope cover styles rather than replacing the corrected body's Normal/NoSpacing.
styles = etree.fromstring(cover.read('word/styles.xml'))
style_map = {s.get(w + 'styleId'): s for s in styles.findall('w:style', ns)}
required = {'Normal', 'Header', 'TableNormal'}
required.update(body.xpath('.//w:pStyle/@w:val|.//w:rStyle/@w:val|.//w:tblStyle/@w:val', namespaces=ns))
while True:
    dependencies = {x.get(w + 'val') for key in required for x in style_map[key]
                    if x.tag in [w + 'basedOn', w + 'link', w + 'next']}
    if dependencies <= required:
        break
    required.update(dependencies)
for scope in [body, header]:
    for p in scope.findall('.//w:p', ns):
        pp = p.find('w:pPr', ns)
        if pp is None:
            pp = etree.Element(w + 'pPr'); p.insert(0, pp)
        if pp.find('w:pStyle', ns) is None:
            ps = etree.Element(w + 'pStyle'); ps.set(w + 'val', 'Normal'); pp.insert(0, ps)
    for table in scope.findall('.//w:tbl', ns):
        tp = table.find('w:tblPr', ns)
        if tp.find('w:tblStyle', ns) is None:
            ts = etree.Element(w + 'tblStyle'); ts.set(w + 'val', 'TableNormal'); tp.insert(0, ts)
    for x in scope.iter():
        if x.tag in [w + 'pStyle', w + 'rStyle', w + 'tblStyle']:
            x.set(w + 'val', 'KakCover' + x.get(w + 'val'))
imported_styles = []
for key in sorted(required):
    s = copy.deepcopy(style_map[key]); s.set(w + 'styleId', 'KakCover' + key); s.attrib.pop(w + 'default', None)
    s.find('w:name', ns).set(w + 'val', 'KAK Cover ' + key)
    for x in s:
        if x.tag in [w + 'basedOn', w + 'link', w + 'next']:
            x.set(w + 'val', 'KakCover' + x.get(w + 'val'))
    imported_styles.append(etree.tostring(s, encoding='unicode'))

relations = etree.fromstring(base_parts['word/_rels/document.xml.rels'])
new_relations = [('rIdKakCoverLogo', 'image', 'media/kak-cover-logo.wmf'),
                 ('rIdKakCoverHeader', 'header', 'header-kak-cover.xml'),
                 ('rIdKakBodyHeader', 'header', 'header-kak-body.xml')]
if any(relations.find(f'{{{rel}}}Relationship[@Id="{key}"]') is not None for key, _, _ in new_relations):
    raise SystemExit('Cover relationships already present; reimport the body layout before the cover.')
for key, kind, target in new_relations:
    etree.SubElement(relations, '{' + rel + '}Relationship', Id=key,
                     Type=ns['r'] + '/' + kind, Target=target)
for x in body.iter():
    for attr in [r + 'embed', r + 'id']:
        if x.get(attr) == 'rId8':
            x.set(attr, 'rIdKakCoverLogo')
        elif x.get(attr) == 'rId9':
            x.set(attr, 'rIdKakCoverHeader')
        elif x.get(attr):
            raise SystemExit('Unknown cover relationship: ' + x.get(attr))
section = body.find('w:sectPr', ns); body.remove(section)
kind = etree.Element(w + 'type'); kind.set(w + 'val', 'nextPage'); section.insert(1, kind)
boundary = body.findall('w:p', ns)[-1]
boundary.find('w:pPr', ns).append(section)

def serialize(node):
    return etree.tostring(node, xml_declaration=True, encoding='UTF-8', standalone=True)

# Retain the original body XML verbatim except for its explicit empty header.
document = base_parts['word/document.xml'].decode('utf-8')
opening = re.search(r'<w:document\b[^>]*>', document).group()
extra_ns = ''.join(f' xmlns:{key}="{value}"' for key, value in cover_root.nsmap.items() if key and key not in base_root.nsmap)
for key, value in cover_root.nsmap.items():
    if key in base_root.nsmap and base_root.nsmap[key] != value:
        raise SystemExit('Namespace conflict: ' + key)
document = document.replace(opening, opening[:-1] + extra_ns + '>', 1)
document = re.sub(r'(<w:sectPr\b[^>]*>)', r'\1<w:headerReference w:type="default" r:id="rIdKakBodyHeader"/>', document, count=1)
prefix = ''.join(etree.tostring(x, encoding='unicode') for x in body)
document = re.sub(r'(<w:body\b[^>]*>)', lambda m: m[1] + prefix, document, count=1)
base_parts['word/document.xml'] = document.encode('utf-8')
base_parts['word/styles.xml'] = base_parts['word/styles.xml'].replace(b'</w:styles>', ''.join(imported_styles).encode('utf-8') + b'</w:styles>')
base_parts['word/_rels/document.xml.rels'] = serialize(relations)
base_parts['word/header-kak-cover.xml'] = serialize(header)
base_parts['word/header-kak-body.xml'] = f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="{ns["w"]}"><w:p/></w:hdr>'.encode()
base_parts['word/media/kak-cover-logo.wmf'] = cover.read('word/media/image1.wmf')
types = etree.fromstring(base_parts['[Content_Types].xml'])
if types.find(f'{{{ct}}}Default[@Extension="wmf"]') is None:
    etree.SubElement(types, '{' + ct + '}Default', Extension='wmf', ContentType='image/x-wmf')
for name in ['header-kak-cover.xml', 'header-kak-body.xml']:
    etree.SubElement(types, '{' + ct + '}Override', PartName='/word/' + name,
                     ContentType='application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml')
base_parts['[Content_Types].xml'] = serialize(types)
base.close()
with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as result:
    for name, value in base_parts.items():
        result.writestr(name, value)
print(f'Imported cover, scoped styles and logo; source SHA256 {hashlib.sha256(source.read_bytes()).hexdigest()}')

"""Import the supplied PO layout, changing only audited text slots in document.xml."""
import copy
import hashlib
import json
import sys
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from lxml import etree as E

source = Path(sys.argv[1])
ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
w = "{" + ns["w"] + "}"

def fill(p, value):
    run = next((r for r in p.findall("w:r", ns) if r.find("w:t", ns) is not None), None)
    props = copy.deepcopy(run.find("w:rPr", ns)) if run is not None else None
    for child in list(p):
        if child.tag != w + "pPr":
            p.remove(child)
    run = E.SubElement(p, w + "r")
    if props is not None:
        run.append(props)
    E.SubElement(run, w + "t").text = "${po." + value + "}"

with ZipFile(source) as z:
    root = E.fromstring(z.read("word/document.xml"))
    body = root.find("w:body", ns)
    tables = body.findall("w:tbl", ns)
    if [len(t.findall("w:tr", ns)) for t in tables] != [5, 2, 5, 12]:
        raise ValueError("Struktur PO berubah; inspeksi ulang sebelum impor.")
    paragraphs = {25: "year", 28: "organization", 32: "description", 35: "location", 44: "time", 47: "procurement", 49: "date", 51: "signerTitle", 56: "signerName", 57: "signerRank", 58: "signerNip"}
    for index, key in paragraphs.items():
        if body[index].tag != w + "p":
            raise ValueError(f"Slot PO {index} berubah.")
        fill(body[index], key)
    for ti, keys in [(0, ["program", "activity", "subActivity", "budgetWords", "location"]), (1, ["activity", "subActivity"])]:
        for ri, key in enumerate(keys):
            fill(tables[ti].findall("w:tr", ns)[ri].findall("w:tc", ns)[2].find("w:p", ns), key)
    for ri, key in enumerate(["funding", "budget", "output", "outcome"], 1):
        fill(tables[2].findall("w:tr", ns)[ri].findall("w:tc", ns)[2].find("w:p", ns), key)
    for ri in range(1, 11):
        row = tables[3].findall("w:tr", ns)[ri]
        fill(row.findall("w:tc", ns)[0].find("w:p", ns), "costLabel")
        fill(row.findall("w:tc", ns)[2].find("w:p", ns), "costAmount")
    fill(tables[3].findall("w:tr", ns)[11].findall("w:tc", ns)[2].find("w:p", ns), "budget")
    output = Path("src/templates/template-po.docx")
    with ZipFile(output, "w", compression=ZIP_DEFLATED) as target:
        for item in z.infolist():
            target.writestr(copy.copy(item), E.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True) if item.filename == "word/document.xml" else z.read(item))
    audit = {"reference": str(source), "sha256": hashlib.sha256(source.read_bytes()).hexdigest(), "pages": 3, "parts": [{"name": item.filename, "sha256": hashlib.sha256(z.read(item)).hexdigest(), "size": item.file_size, "editable": item.filename == "word/document.xml"} for item in z.infolist() if not item.is_dir()]}
    audit_path = Path(".tmp/po-kak/reference-audit.json")
    audit_path.parent.mkdir(parents=True, exist_ok=True)
    audit_path.write_text(json.dumps(audit, indent=2), encoding="utf-8")
print("Imported PO template; preserved all package parts except audited document text slots")

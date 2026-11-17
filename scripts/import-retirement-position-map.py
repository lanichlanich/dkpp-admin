"""Extract the approved DKPP map without treating required headcount as occupancy.

Usage: python scripts/import-retirement-position-map.py <source.pdf>
Requires pdfplumber. Pages and original row labels are retained for audit.
"""
import hashlib
import json
import re
import sys
from pathlib import Path

import pdfplumber

source = Path(sys.argv[1])
rows = []
unit = "DINAS KETAHANAN PANGAN DAN PERTANIAN"
uptd = ""
header_uptd = ""
main_units = {
    7: "SEKRETARIAT DINAS KETAHANAN PANGAN DAN PERTANIAN",
    20: "SUB BAGIAN UMUM DAN KEPEGAWAIAN",
    31: "SUB BAGIAN KEUANGAN",
    36: "BIDANG KETERSEDIAAN DAN DISTRIBUSI PANGAN",
    45: "BIDANG KONSUMSI DAN KEAMANAN PANGAN",
    55: "BIDANG TANAMAN PANGAN",
    64: "BIDANG HORTIKULTURA, PERKEBUNAN DAN PENYULUHAN",
    74: "BIDANG PRODUKSI PETERNAKAN",
    84: "BIDANG KESEHATAN HEWAN DAN KESEHATAN MASYARAKAT VETERINER",
}
with pdfplumber.open(source) as pdf:
    assert len(pdf.pages) == 18, "Unexpected source edition"
    for page_no, page in enumerate(pdf.pages[6:], 7):
        for table in page.extract_tables():
            for raw in table:
                cells = [re.sub(r"\s+", " ", cell or "").strip() for cell in raw]
                if cells and not cells[0].isdigit():
                    heading = next((cell for cell in cells if cell.startswith("UPTD ")), None)
                    if heading:
                        header_uptd = heading
                if len(cells) != 6 or not cells[-1].isdigit():
                    continue
                label, name, echelon, rank, education, required = cells
                if "TOTAL KEBUTUHAN" in " ".join(cells):
                    continue
                # The bottom-row text crosses the detected cell boundary on p10.
                if page_no == 10 and label == "71" and not name:
                    name = "JF Analis Prasarana Dan Sarana Pertanian Ahli Pertama"
                    assert name in page.extract_text()
                if not name:
                    continue
                number = int(label) if label.isdigit() else None
                if number in main_units:
                    unit = main_units[number]
                if name.startswith("KEPALA UPTD "):
                    # Some long names cross the right cell border (rows 100/108).
                    # The full section heading in the same source is authoritative.
                    if header_uptd:
                        name = "KEPALA " + header_uptd
                    uptd = name.removeprefix("KEPALA ")
                    unit = uptd
                elif name == "KEPALA SUB BAGIAN TATA USAHA" and uptd:
                    unit = f"SUB BAGIAN TATA USAHA {uptd}"
                kind = "Fungsional" if name.startswith("JF ") else (
                    "Struktural" if name.startswith("KEPALA ") or name == "SEKRETARIS DINAS" else "Pelaksana"
                )
                if kind == "Struktural":
                    roman = re.search(r"(IV|III|II|I)$", echelon)
                    assert roman, f"Invalid echelon at row {label}: {cells}"
                    echelon = roman.group(1)
                rows.append(dict(id=f"peta-2026-{len(rows)+1:03}", sourceRow=label or "Tanpa nomor",
                                 page=page_no, name=name, unit=unit, kind=kind, echelon=echelon,
                                 rank=rank, education=education, required=int(required)))
assert len(rows) == 179
assert sum(row["required"] for row in rows) == 253
assert {kind: sum(r["required"] for r in rows if r["kind"] == kind)
        for kind in ["Fungsional", "Pelaksana", "Struktural"]} == {
            "Fungsional": 108, "Pelaksana": 97, "Struktural": 48}
output = Path("src/data/retirement-position-map-2026.json")
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(dict(sourceFile=source.name, sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                                 decree="100.3.3.2/Kep.197/Org/2026", decreeDate="2026-03-30",
                                 requiredTotal=253, positions=rows), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Extracted {len(rows)} placements; required headcount 253 -> {output}")

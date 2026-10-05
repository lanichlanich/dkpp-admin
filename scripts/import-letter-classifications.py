"""Rebuild the classification catalog from the supplied Indramayu regulation PDF."""
import argparse
import hashlib
import json
import re
from pathlib import Path

import pdfplumber

parser = argparse.ArgumentParser()
parser.add_argument("pdf", type=Path)
args = parser.parse_args()
rows = []
current = None
with pdfplumber.open(args.pdf) as pdf:
    for page_number, page in enumerate(pdf.pages, 1):
        if page_number < 6:
            continue
        for line in (page.extract_text() or "").splitlines():
            line = line.strip()
            if line == "BUPATI INDRAMAYU,":
                current = None
                break
            # Two-digit text such as "10 Tahun" is a description continuation,
            # not a code. The source uses three-digit roots and dotted 00.x codes.
            match = re.fullmatch(r"((?:[0-9]{3}|00\.[0-9]+)(?:\.[0-9]+)*)\s+(.+)", line)
            if match:
                current = {"code": match[1], "label": match[2], "page": page_number}
                rows.append(current)
            elif current:
                current["label"] += " " + line
    pages = len(pdf.pages)

assert len(rows) == 2940, f"Unexpected catalog size: {len(rows)}"
assert len({row["code"] for row in rows}) == len(rows), "Duplicate classification codes"
catalog = {
    "source": {"title": "Peraturan Bupati Indramayu Nomor 17 Tahun 2023", "date": "2023-02-02",
               "pages": pages, "sha256": hashlib.sha256(args.pdf.read_bytes()).hexdigest()},
    "entries": rows,
}
target = Path("src/data/letter-classifications.json")
target.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Imported {len(rows)} codes from {pages} pages into {target}")

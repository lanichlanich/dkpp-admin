"""Snapshot the supplied Excel print layout; run with Python/openpyxl and source directory."""
from pathlib import Path
import json, sys, colorsys
from xml.etree import ElementTree
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

source = Path(sys.argv[1])
catalog = json.loads(Path('src/data/anjab-abk.json').read_text(encoding='utf-8'))
styles, sheets = [], []

theme_colors = []
def color(c, default='000000'):
    if c is None: return default
    if c.type == 'rgb': return str(c.rgb)[-6:]
    if c.type == 'indexed':
        from openpyxl.styles.colors import COLOR_INDEXED
        if c.indexed < len(COLOR_INDEXED): return COLOR_INDEXED[c.indexed][-6:]
    if c.type == 'theme' and c.theme < len(theme_colors):
        value = theme_colors[c.theme]
        if c.tint:
            rgb = [int(value[i:i+2],16)/255 for i in (0,2,4)]
            h,l,s = colorsys.rgb_to_hls(*rgb)
            l = l * (1+c.tint) if c.tint < 0 else l * (1-c.tint) + c.tint
            return ''.join(f'{round(x*255):02X}' for x in colorsys.hls_to_rgb(h,l,s))
        return value
    return default

for item in catalog['sources']:
    book = load_workbook(source / item['file'], data_only=True)
    scheme = ElementTree.fromstring(book.loaded_theme).find('.//{http://schemas.openxmlformats.org/drawingml/2006/main}clrScheme')
    by_name = {c.tag.rsplit('}',1)[-1]:list(c)[0].get('lastClr') or list(c)[0].get('val') for c in scheme}
    # Spreadsheet theme indices start with light1/dark1, unlike DrawingML XML order.
    theme_colors = [by_name[n] for n in ['lt1','dk1','lt2','dk2','accent1','accent2','accent3','accent4','accent5','accent6','hlink','folHlink']]
    for sheet in book:
        detail = next((l for f in catalog['families'] if f['sourceFile'] == item['file'] for l in f['levels'] if l['sheet'] == sheet.title), None)
        last_col = 6 if detail else {'PERHITUNGAN':13,'Usulan':8,'Penempatan':16}[sheet.title]
        last_row = max(c.row for row in sheet for c in row if c.column <= last_col and c.value is not None and str(c.value).strip())
        widths = []
        for i in range(1, last_col + 1):
            dim = next((d for d in sheet.column_dimensions.values() if d.min <= i <= d.max), None)
            width = dim.width if dim else sheet.sheet_format.defaultColWidth or 8.43
            widths.append(round((width * 7 + 5) * .75, 3))
        merges = [list(r.bounds) for r in sheet.merged_cells.ranges if r.max_col <= last_col]
        cells = []
        for row in sheet.iter_rows(max_row=last_row,max_col=last_col):
            for c in row:
                if c.value is None and not c.has_style: continue
                a, f, b = c.alignment, c.font, c.border
                style = {'size':f.sz or 11,'narrow':'Narrow' in (f.name or ''),'bold':bool(f.b),'italic':bool(f.i),'underline':bool(f.u),'color':color(f.color),
                         'align':a.horizontal or ('right' if isinstance(c.value,(int,float)) else 'left'),
                         'vertical':a.vertical or 'bottom','indent':a.indent or 0,'format':c.number_format,
                         'fill':color(c.fill.fgColor,'FFFFFF') if c.fill.patternType == 'solid' else None,
                         'border':[getattr(b, side).style if getattr(b,side) else None for side in ['top','right','bottom','left']]}
                if style not in styles: styles.append(style)
                cells.append([c.row,c.column,c.value,styles.index(style)])
        sheets.append({'id':detail['id'] if detail else sheet.title.lower(),'name':sheet.title,'file':item['file'],'sha256':item['sha256'],
                       'widths':widths,'heights':[sheet.row_dimensions[r].height or sheet.sheet_format.defaultRowHeight or 15 for r in range(1,last_row+1)],
                       'merges':merges,'cells':cells,'landscape':not detail and sheet.title != 'Usulan'})
assert len(sheets)==26
Path('src/data/anjab-abk-pdf-template.json').write_text(json.dumps({'styles':styles,'sheets':sheets},ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
print(json.dumps({'sheets':len(sheets),'styles':len(styles),'cells':sum(len(s['cells']) for s in sheets)}))

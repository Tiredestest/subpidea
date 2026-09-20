"""Read-only source audit. Writes JSON reports, never changes the workbook."""
import hashlib
import json
from collections import Counter
from pathlib import Path
import openpyxl
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / 'data/reports'
REPORTS.mkdir(parents=True, exist_ok=True)

def audit(path):
    values = openpyxl.load_workbook(path, data_only=True)
    formulas = openpyxl.load_workbook(path, data_only=False)
    sheets = {}
    for sheet in values:
        rows = []
        for row in sheet:
            if any(c.value is not None for c in row):
                rows.append({'row': row[0].row, 'values': [c.value for c in row]})
        formula_cells = []
        for row in formulas[sheet.title]:
            for cell in row:
                if cell.data_type == 'f':
                    formula_cells.append({'cell': cell.coordinate, 'formula': cell.value,
                                          'cached': sheet[cell.coordinate].value})
        sheets[sheet.title] = {'rows': rows, 'formulas': formula_cells}
    return {'path': path.relative_to(ROOT).as_posix(),
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'sheets': sheets}

books = [audit(p) for p in sorted((ROOT / 'data/raw/excel').rglob('*.xlsx')) if not p.name.startswith('~$')]
images = []
for path in sorted((ROOT / 'data/raw/images').rglob('*')):
    if not path.is_file():
        continue
    entry = {'path': path.relative_to(ROOT).as_posix(), 'stem': path.stem,
             'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    try:
        with Image.open(path) as im:
            entry.update(width=im.width, height=im.height, format=im.format, mode=im.mode,
                         frames=getattr(im, 'n_frames', 1))
            im.verify()
    except Exception as ex:
        entry['error'] = str(ex)
    images.append(entry)

(REPORTS / 'source-audit.json').write_text(json.dumps({'workbooks': books, 'images': images}, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
for book in books:
    print(book['path'])
    for name, sheet in book['sheets'].items():
        print(name, 'nonempty_rows=', len(sheet['rows']), 'header=', sheet['rows'][0],
              'formulas=', len(sheet['formulas']), 'missing_cache=', sum(f['cached'] is None for f in sheet['formulas']))
print('Images:', len(images), 'bytes:', sum(i['bytes'] for i in images))
print('Sizes:', Counter((i.get('width'), i.get('height')) for i in images))

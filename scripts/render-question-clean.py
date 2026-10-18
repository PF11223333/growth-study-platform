"""Render scanned printing separately from handwritten PDF drawing overlays.

Source PDF and the existing full-page ink-preserving previews are never changed.
For this scanned upper book the full printed page is the largest raster image;
handwritten PDF drawing overlays are omitted in the practice copy only.
"""
import hashlib
import json
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'tmp/pdf-ocr-env'))
from PIL import Image
import fitz

db = json.loads((root / 'data/platform.json').read_text(encoding='utf-8'))
pages = set()
for record in db['records']:
    question = record.get('details', {}).get('question', {})
    if not isinstance(question, dict):
        continue
    for item in question.get('originalPages', []) + question.get('contextPages', []):
        pages.add((item['sourceId'], item['page']))

rebuild_file = root / 'data/question-clean-preview-work.json'
rebuild = {(r['sourceId'], r['page']) for r in json.loads(rebuild_file.read_text(encoding='utf-8'))} if any(flag in sys.argv for flag in ['--rebuild-work', '--repair-overlays']) else set()
created = []
documents = {}
for sid, number in sorted(pages):
    original = root / 'data/previews' / sid / f'{number}-hd.webp'
    target = original.with_name(f'{number}-clean.webp')
    if target.exists() and (sid, number) not in rebuild:
        continue
    before = hashlib.sha256(original.read_bytes()).hexdigest()
    if sid not in documents:
        source = next(s for s in db['sources'] if s['id'] == sid)
        documents[sid] = fitz.open(root / 'data/originals' / source['filename'])
    document = documents[sid]
    page = document[number - 1]
    # Refuse to guess for text PDFs or unusual composites.
    assert not page.get_text().strip(), f'{sid}/{number}: not a scanned page'
    images = page.get_images()
    # A full-page transparent handwriting raster can be larger than the scan.
    # Soft-mask images are overlays, never the printed source page.
    largest_any = max(images, key=lambda item: item[2] * item[3])
    if '--repair-overlays' in sys.argv and not largest_any[1]:
        continue
    printed = [item for item in images if item[1] == 0]
    assert printed, f'{sid}/{number}: no opaque printed scan'
    largest = max(printed, key=lambda item: item[2] * item[3])
    placements = page.get_image_rects(largest[0])
    assert len(placements) == 1
    rect = placements[0]
    assert rect.width >= page.rect.width * .8 and rect.height >= page.rect.height * .8
    with Image.open(original) as image:
        clean_document = fitz.open()
        clean_page = clean_document.new_page(width=page.rect.width, height=page.rect.height)
        clean_page.insert_image(rect, stream=document.extract_image(largest[0])['image'])
        pixmap = clean_page.get_pixmap(matrix=fitz.Matrix(image.width / page.rect.width, image.height / page.rect.height), alpha=False)
        preview = Image.frombytes('RGB', (pixmap.width, pixmap.height), pixmap.samples)
        if preview.size != image.size:
            preview = preview.resize(image.size, Image.Resampling.LANCZOS)
        sample = preview.resize((100, 100)).convert('L')
        histogram = sample.histogram()
        assert sum(histogram[220:]) / 10000 > .45, f'{sid}/{number}: missing paper background'
        assert sum(histogram[:180]) / 10000 > .004, f'{sid}/{number}: no readable print'
        temporary = target.with_suffix('.new.webp')
        preview.save(temporary, format='WEBP', quality=89)
        with Image.open(temporary) as check:
            assert check.size == image.size
            check.verify()
        temporary.replace(target)
        created.append({'sourceId': sid, 'page': number, 'width': image.width,
                        'height': image.height, 'bytes': target.stat().st_size,
                        'originalSha256': before, 'printedXref': largest[0]})
        clean_document.close()
    assert hashlib.sha256(original.read_bytes()).hexdigest() == before

missing = [f'{sid}/{number}' for sid, number in pages
           if not (root / 'data/previews' / sid / f'{number}-clean.webp').exists()]
assert not missing, missing
visible = []
for sid, number in sorted(pages):
    with Image.open(root / 'data/previews' / sid / f'{number}-clean.webp') as image:
        histogram = image.resize((100, 100)).convert('L').histogram()
        white = sum(histogram[220:]) / 10000
        dark = sum(histogram[:180]) / 10000
        # A continuation page can contain only two printed answer options.
        assert white > .45 and dark > .0003, f'{sid}/{number}: blank or black preview'
        visible.append({'sourceId': sid, 'page': number, 'whiteRatio': white, 'printRatio': dark})
report = {'version': 1, 'databaseVersion': db['version'], 'requiredPages': len(pages),
          'createdCount': len(created), 'created': created, 'missing': missing,
          'method': 'opaque original scanned printing at its exact PDF placement; exclude masked handwriting rasters',
          'visibilityChecked': len(visible),
          'sourceFilesUnchanged': True}
(root / 'data/question-clean-preview-audit.json').write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({key: value for key, value in report.items() if key != 'created'},
                 ensure_ascii=False))

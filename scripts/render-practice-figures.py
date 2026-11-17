"""Read the printed layer of scan PDFs to prepare answer-free practice crops."""
import argparse
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tmp/pdf-ocr-env"))
import pymupdf
from PIL import Image


def render_printed(document, page_number, size):
    page = document[page_number - 1]
    opaque = [item for item in page.get_images() if not item[1]]
    if not opaque or page.get_text().strip():
        raise ValueError("无法独立定位印刷底图")
    scan = max(opaque, key=lambda image: image[2] * image[3])
    placements = page.get_image_rects(scan[0], transform=True)
    if len(placements) != 1:
        raise ValueError("印刷底图放置位置不唯一")
    rect, placement = placements[0]
    if (rect.width < .75 * page.rect.width or rect.height < .9 * page.rect.height
            or placement.a <= 0 or placement.d <= 0 or placement.b or placement.c
            or page.rotation):
        raise ValueError("印刷底图坐标需手工核对")
    with pymupdf.open() as clean:
        copy = clean.new_page(width=page.rect.width, height=page.rect.height)
        copy.insert_image(rect, stream=document.extract_image(scan[0])["image"], keep_proportion=False)
        pixmap = copy.get_pixmap(matrix=pymupdf.Matrix(size[0]/page.rect.width, size[1]/page.rect.height))
        im = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
        return im if im.size == size else im.resize(size, Image.Resampling.LANCZOS)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source")
    parser.add_argument("page", nargs="*", type=int)
    args = parser.parse_args()
    db = json.loads((ROOT / "data/platform.json").read_text(encoding="utf8"))
    source = next(s for s in db["sources"] if s["id"] == args.source)
    pages = set(args.page)
    if not pages:
        for row in db["records"]:
            q = row.get("details", {}).get("question")
            if not isinstance(q, dict):
                continue
            pages.update(ref["page"] for ref in q.get("originalPages", []) + q.get("contextPages", [])
                         if ref["sourceId"] == args.source)
    folder = ROOT / "data/previews" / args.source
    done, errors = [], []
    with pymupdf.open(ROOT / "data/originals" / source["filename"]) as doc:
        for number in sorted(pages):
            target = folder / f"{number}-clean.webp"
            if target.exists():
                continue
            try:
                with Image.open(folder / f"{number}-hd.webp") as im:
                    clean = render_printed(doc, number, im.size)
                output = target.with_suffix(".pending.webp")
                clean.save(output, quality=88)
                with Image.open(output) as saved:
                    saved.verify()
                output.replace(target)
                done.append(number)
            except (ValueError, OSError) as exc:
                errors.append((number,str(exc)))
    print(json.dumps(dict(source=args.source, pages=len(pages), created=done, unresolved=errors), ensure_ascii=False))


if __name__ == "__main__":
    main()

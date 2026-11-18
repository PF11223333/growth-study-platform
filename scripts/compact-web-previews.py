"""Prepare smaller ordinary web previews while keeping all PDF and HD assets."""
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tmp/pdf-ocr-env"))
from PIL import Image


def compact(item):
    with Image.open(item) as original:
        image=original.convert("RGB")
    image.thumbnail((850,850),Image.Resampling.LANCZOS)
    buf=BytesIO()
    image.save(buf,format="WEBP",quality=69,method=3)
    payload=buf.getvalue()
    saved=item.stat().st_size-len(payload)
    if saved<=0:
        return 0
    with Image.open(BytesIO(payload)) as rendered:
        rendered.verify()
    target=ROOT/"data/web-previews"/item.parent.name/item.name
    target.parent.mkdir(parents=True,exist_ok=True)
    temporary=target.with_suffix(".tmp")
    temporary.write_bytes(payload)
    temporary.replace(target)
    return saved


if __name__=="__main__":
    files=[p for p in (ROOT/"data/previews").glob("*/*.webp") if p.stem.isdecimal() and p.stat().st_size>=115000]
    with ThreadPoolExecutor(5) as pool:
        savings=sum(pool.map(compact,files))
    print(f"{len(files)} ordinary previews, {savings} bytes saved")

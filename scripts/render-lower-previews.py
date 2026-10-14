"""Publish complete ink-preserving previews, and separate answer-free scans for practice."""
import pathlib,sys,json
root=pathlib.Path.cwd();sys.path.insert(0,str(root/'tmp/pdf-ocr-env'))
from PIL import Image
db=json.loads((root/'data/platform.json').read_text(encoding='utf-8'))
source=next(s for s in db['sources'] if s['sha256']=='cd3b8f3ba0a036a1b120b68d3c0cd04cfd073b026e90c98df10a056cd81f76d0')
out=root/'data/previews'/source['id'];out.mkdir(parents=True,exist_ok=True)
work=root/'tmp/pdfs/lower-book';pages=[]
for number in range(1,source['pageCount']+1):
    image=Image.open(work/f'{number}-render.jpg').convert('RGB');w,h=image.size
    high=out/f'{number}-hd.webp'
    if not high.exists():image.save(high,quality=86)
    small=out/f'{number}.webp'
    if not small.exists():image.thumbnail((1100,1100));image.save(small,quality=80)
    clean=work/f'{number}-clean.jpg';target=out/f'{number}-clean.webp'
    if clean.exists() and not target.exists():Image.open(clean).convert('RGB').save(target,quality=89)
    pages.append({'page':number,'width':w,'height':h,'rotation':0})
    if number%50==0:print(json.dumps({'previews':number}),flush=True)
(out/'manifest.json').write_text(json.dumps({'id':source['id'],'pages':pages},ensure_ascii=False),encoding='utf-8')
print(json.dumps({'sourceId':source['id'],'pages':len(pages)}),flush=True)

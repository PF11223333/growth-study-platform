"""Generate upright, page-addressable previews without modifying original files."""
import json,sys,pathlib,subprocess,concurrent.futures,os
from PIL import Image
root=pathlib.Path(__file__).resolve().parents[1]
data=pathlib.Path(os.environ.get('GROWTH_DATA_DIR',str(root/'data')))
db=json.loads((data/'platform.json').read_text(encoding='utf-8'))
only=sys.argv[1] if len(sys.argv)>1 else None
def render(s):
    if s.get('missing') or (only and s['id']!=only): return
    out=data/'previews'/s['id'];out.mkdir(parents=True,exist_ok=True)
    src=data/'originals'/s['filename']
    if (out/'manifest.json').exists(): return
    pages=[]
    if s['kind']=='pdf':
        prefix=str(out/'page')
        subprocess.run(['pdftoppm','-jpeg','-jpegopt','quality=82','-scale-to','2000',str(src),prefix],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
        imgs=sorted(out.glob('page-*.jpg'),key=lambda p:int(p.stem.split('-')[-1]))
    else:
        from PIL import ImageOps
        image=ImageOps.exif_transpose(Image.open(src)).convert('RGB');image.thumbnail((2400,2400));image.save(out/'page-1.jpg',quality=88);imgs=[out/'page-1.jpg']
    for i,f in enumerate(imgs,1):
        image=Image.open(f).convert('RGB');w,h=image.size
        high=out/f'{i}-hd.webp';image.save(high,quality=86)
        image.thumbnail((1100,1100));image.save(out/f'{i}.webp',quality=80)
        pages.append({'page':i,'width':w,'height':h,'rotation':0})
        image.close();f.unlink()
    (out/'manifest.json').write_text(json.dumps({'id':s['id'],'pages':pages},ensure_ascii=False),encoding='utf-8')
    print(json.dumps({'source':s['id'],'pages':len(pages)}),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    list(pool.map(render,db['sources']))

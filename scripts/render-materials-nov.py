import pathlib,sys,json,shutil,time
ROOT=pathlib.Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tmp/pdf-ocr-env'))
import pymupdf as fitz
from PIL import Image,ImageOps,ImageDraw
OUT=ROOT/'output/materials-20261105'
inventory=json.loads((OUT/'inventory.json').read_text(encoding='utf8'))
def render():
 for source in inventory:
  sid='source-'+source['sha256'][:24];folder=OUT/'previews'/sid;folder.mkdir(parents=True,exist_ok=True);doc=fitz.open(source['path']);pages=[]
  longside=2000 if source['key'] in ['mindmap','police-thinking'] else 1800
  for i,page in enumerate(doc):
   hd=folder/f'{i+1}-hd.webp';normal=folder/f'{i+1}.webp'
   if not hd.exists():
    pix=page.get_pixmap(matrix=fitz.Matrix(longside/max(page.rect.width,page.rect.height),longside/max(page.rect.width,page.rect.height)),alpha=False)
    im=Image.frombytes('RGB',(pix.width,pix.height),pix.samples);im.save(hd,'WEBP',quality=76,method=4);im.thumbnail((1100,1100));im.save(normal,'WEBP',quality=76,method=4)
   with Image.open(hd) as im:width,height=im.size
   pages.append({'page':i+1,'width':width,'height':height,'rotation':0})
  (folder/'manifest.json').write_text(json.dumps({'id':sid,'pages':pages},ensure_ascii=False),encoding='utf8')
  original=OUT/'originals'/f'{source["sha256"]}.pdf';original.parent.mkdir(exist_ok=True)
  if not original.exists():shutil.copy2(source['path'],original)
  print(json.dumps({'key':source['key'],'pages':len(doc),'previewMB':round(sum(p.stat().st_size for p in folder.iterdir())/1024**2,2)}),flush=True)
  if source['key'] in ['mindmap','police-thinking']:
   thumb=Image.new('RGB',(1000,1450),'#dddddd');draw=ImageDraw.Draw(thumb)
   for i in range(min(12,len(doc))):
    with Image.open(folder/f'{i+1}-hd.webp') as im:im.thumbnail((245,455));thumb.paste(im,(i%4*250,i//4*480+20));draw.text((i%4*250+4,i//4*480+3),str(i+1),fill='#000000')
   thumb.save(OUT/(source['key']+'-first12.jpg'))
def ocr(key,selected=None):
 import numpy as np
 from rapidocr_onnxruntime import RapidOCR
 import rapidocr_onnxruntime.utils as utils
 import onnxruntime as ort
 def opts():
  o=ort.SessionOptions();o.intra_op_num_threads=2;o.inter_op_num_threads=1;return o
 utils.SessionOptions=opts;engine=RapidOCR()
 s=next(s for s in inventory if s['key']==key);sid='source-'+s['sha256'][:24];folder=OUT/'ocr'/key;folder.mkdir(parents=True,exist_ok=True)
 for n in (selected or range(1,s['pages']+1)):
  f=folder/f'{n}.json'
  if f.exists():continue
  with Image.open(OUT/'previews'/sid/f'{n}-hd.webp') as im:a=np.asarray(im.convert('RGB'))
  result,elapsed=engine(a);f.write_text(json.dumps({'page':n,'width':a.shape[1],'height':a.shape[0],'lines':result or [],'text':'\n'.join(l[1] for l in result or [])},ensure_ascii=False),encoding='utf8')
  if n%10==0 or n<=3:print(json.dumps({'key':key,'page':n,'lines':len(result or [])}),flush=True)
if __name__=='__main__':
 if len(sys.argv)>1:ocr(sys.argv[1],[int(v) for v in sys.argv[2].split(',')] if len(sys.argv)>2 else None)
 else:render()

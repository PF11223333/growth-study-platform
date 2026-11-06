import pathlib,sys,json,hashlib,re
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tmp/pdf-ocr-env'))
import pymupdf as fitz
BASE=pathlib.Path('E:/weixinline/xwechat_files/wxid_t2ngylfr9wsu22_f9d1/temp/RWTemp/2026-11/9e20f478899dc29eb19741386f9343c8')
NAMES=['(1)--社区警务练习题.pdf','思维导图.pdf','桐哥公专 27 思维提升.pdf','2027年方法实战班袁东申论.pdf','【示意课时】言语规范搭配汇总-300词（已重新上传，辛苦重新下载）.pdf']
OUT=ROOT/'output/materials-20261105';OUT.mkdir(parents=True,exist_ok=True)
inventory=[]
for index,name in enumerate(NAMES):
 p=BASE/name;doc=fitz.open(p);digest=hashlib.sha256(p.read_bytes()).hexdigest();key=['community','mindmap','police-thinking','shenlun-yuandong','verbal-collocations'][index]
 pages=[{'page':i+1,'width':page.rect.width,'height':page.rect.height,'text':page.get_text(sort=True),'annotations':sum(1 for _ in (page.annots() or []))} for i,page in enumerate(doc)]
 row={'key':key,'name':name,'path':str(p),'size':p.stat().st_size,'sha256':digest,'pages':len(doc),'textChars':sum(len(t['text']) for t in pages),'textPages':sum(len(t['text'])>20 for t in pages),'sample':[t['text'][:1000] for t in pages[:5]]}
 (OUT/(key+'.json')).write_text(json.dumps(pages,ensure_ascii=False,indent=2),encoding='utf8');(OUT/(key+'.txt')).write_text('\n\n'.join(f'=== PDF PAGE {p["page"]} ===\n{p["text"]}' for p in pages),encoding='utf8');inventory.append(row)
(OUT/'inventory.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2),encoding='utf8')
sys.stdout.reconfigure(encoding='utf8');print(json.dumps(inventory,ensure_ascii=False,indent=2))

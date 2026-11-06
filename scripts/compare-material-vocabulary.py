import pathlib,json,importlib.util,sys,re,subprocess,xml.etree.ElementTree as ET
root=pathlib.Path(__file__).resolve().parents[1];out=root/'output/materials-20261105'
sys.path.insert(0,str(root/'tmp/pdf-ocr-env'))
import pymupdf as fitz
source=next(s for s in json.loads((out/'inventory.json').read_text(encoding='utf8')) if s['key']=='verbal-collocations')
if not (out/'source-bbox.html').exists():
 subprocess.run(['pdftotext','-bbox-layout',source['path'],str(out/'source-bbox.html')],check=True)
doc=fitz.open(source['path']);ns={'x':'http://www.w3.org/1999/xhtml'};xmls=ET.parse(out/'source-bbox.html').getroot().findall('.//x:page',ns);rows=[]
for n,(page,xml) in enumerate(zip(doc,xmls),1):
 bounds=sorted({round(p['rect'].y0,2) for p in page.get_drawings() if 50<p['rect'].x0<56 and 725<p['rect'].width<740 and 0<p['rect'].height<2})
 words=[{'text':w.text or '',**{k:float(v) for k,v in w.attrib.items()}} for w in xml.findall('.//x:word',ns)]
 for top,bottom in zip(bounds,bounds[1:]):
  line=sorted([w for w in words if top<=(w['yMin']+w['yMax'])/2<bottom],key=lambda w:(round(w['yMin'],1),w['xMin']));cols=[[] for _ in range(5)]
  for w in line:
   x=(w['xMin']+w['xMax'])/2;col=next((i for i,end in enumerate([102.6,243.6,389.16,676.68]) if x<end),4);cols[col].append(w['text'])
  cells=[''.join(c).strip() for c in cols]
  if not cells[0].isdigit():continue
  rows.append(dict(number=int(cells[0]),label=cells[1],meaning=cells[2],example=cells[3],documentLabel=cells[4],page=n,region={'x':53.52/page.rect.width,'y':top/page.rect.height,'width':732/page.rect.width,'height':(bottom-top)/page.rect.height}))
assert [r['number'] for r in rows]==list(range(1,306)),[r['number'] for r in rows]
old=json.loads((root/'data/vocabulary.json').read_text(encoding='utf8'));changes=[]
for r,e in zip(rows,old['entries']):
 for newkey,oldkey in [('label','originalLabel'),('meaning','originalMeaning'),('example','originalExample'),('documentLabel','documentLabel')]:
  if re.sub(r'\s+','',r[newkey])!=re.sub(r'\s+','',e['source'][oldkey]):changes.append({'number':r['number'],'field':newkey,'before':e['source'][oldkey],'after':r[newkey]})
(out/'new-vocabulary-rows.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf8')
(out/'vocabulary-diff.json').write_text(json.dumps({'rows':len(rows),'priorRows':len(old['entries']),'changes':changes,'sameNormalizedContent':not changes,'note':'空白标准化后逐行比较原始标签、含义、例句及来源简写；保留平台已有校正，不用新原表覆盖。'},ensure_ascii=False,indent=2),encoding='utf8')
sys.stdout.reconfigure(encoding='utf8');print(json.dumps({'rows':len(rows),'changes':changes},ensure_ascii=False,indent=2))

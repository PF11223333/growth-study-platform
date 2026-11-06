import pathlib,json,re,sys
sys.stdout.reconfigure(encoding='utf-8')
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'output/materials-20261105'
pages=json.loads((OUT/'community.json').read_text(encoding='utf8'))
text='';offsets=[]
for p in pages:
 s=p['text'].strip();s=re.sub(r'\n[ \t]*\d{1,3}[ \t]*$','',s)
 offsets.append((len(text),p['page']));text+=s+'\n\n'
headers=list(re.finditer(r'(?m)^[ \t]*(\d{1,3})[ \t]+(单选题|多选题)[ \t]*$',text))
out=[]
for i,h in enumerate(headers):
 end=headers[i+1].start() if i+1<len(headers) else len(text)
 segment=text[h.end():end].strip();a=re.search(r'正确答案[：:]\s*([A-D、，,\s]+)',segment);assert a,(i,segment)
 answer=''.join(c for c in a.group(1) if c in 'ABCD');question=segment[:a.start()]
 option_matches=list(re.finditer(r'(?m)^\s*([A-D])[.．、]\s*',question));assert len(option_matches)==4,(i,question)
 prompt=re.sub(r'\s+','',question[:option_matches[0].start()])
 options={m.group(1):re.sub(r'\s+','',question[m.end():(option_matches[j+1].start() if j+1<len(option_matches) else len(question))]) for j,m in enumerate(option_matches)}
 explanation=re.sub(r'^\s*解析[：:]\s*','',segment[a.end():]);explanation=re.sub(r'\s+','',explanation)
 actualend=h.end()+len(text[h.end():end].rstrip());startpage=max(n for offset,n in offsets if offset<=h.start());endpage=max(n for offset,n in offsets if offset<actualend)
 out.append(dict(number=int(h.group(1)),type='single' if h.group(2)=='单选题' else 'multi',prompt=prompt,options=options,answer=answer,explanation=explanation,pages=list(range(startpage,endpage+1))))
unique={}
for q in out:
 if q['number'] in unique:
  before=unique[q['number']]
  assert all(q[k]==before[k] for k in ['prompt','options','answer','explanation']),q['number']
  before['duplicatePages']=q['pages']
 else:unique[q['number']]=q
out=list(unique.values())
assert [q['number'] for q in out]==list(range(1,101))
assert all(q['explanation'] and len(q['options'])==4 and all(q['options'].values()) for q in out)
(OUT/'community-parsed.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf8')
for q in out:print(f"{q['number']} p{q['pages']} {q['prompt']} → {q['answer']} {q['explanation']}")
